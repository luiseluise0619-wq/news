import { prisma } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const BATCH_SIZE = 10;
const defaultDeadline = () => Date.now() + 45_000;

const schema = z.object({
  clusters: z.array(z.object({
    theme: z.string().describe('A short unifying theme/title for this event in Korean'),
    articleIds: z.array(z.string()).describe('IDs of the articles that belong to this event'),
  })),
});

/**
 * Group unclustered articles into NewsEvents. Runs in batches until every
 * article is clustered or the deadline hits. Every article in a processed batch
 * is guaranteed to leave the queue — any the model doesn't group is given its
 * own single-article event — so the loop always makes progress.
 */
export async function clusterArticles(deadline: number = defaultDeadline(), maxNewEvents: number = Infinity) {
  let eventCount = 0;

  while (Date.now() < deadline && eventCount < maxNewEvents) {
    const batch = await prisma.article.findMany({
      where: { newsEventId: null },
      include: { source: { include: { category: true } } },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    // Group this batch by category so the model only compares related articles.
    const byCategory = batch.reduce((acc, article) => {
      const categoryName = article.source.category?.name || 'Uncategorized';
      (acc[categoryName] ||= []).push(article);
      return acc;
    }, {} as Record<string, typeof batch>);

    const assigned = new Set<string>();

    for (const [categoryName, articles] of Object.entries(byCategory)) {
      if (eventCount >= maxNewEvents) break; // daily cap reached — leave the rest queued
      const category = await prisma.category.findUnique({ where: { name: categoryName } });

      const articleData = articles.map((a) => ({ id: a.id, title: a.title, source: a.source.name }));
      const prompt = `Group the following news articles into distinct "News Events" if they are talking about the exact same story or event.
Category: ${categoryName}
Articles:
${JSON.stringify(articleData, null, 2)}

Return a JSON object with a list of "clusters".
Only group articles that describe the SAME event. If an article doesn't match others, put it in its own cluster. Theme should be in Korean.`;

      const result = await generateObject(prompt, schema, 'You are a helpful assistant that clusters news articles.');

      const validIds = new Set(articles.map((a) => a.id));

      for (const cluster of result?.clusters ?? []) {
        const ids = cluster.articleIds.filter((id) => validIds.has(id) && !assigned.has(id));
        if (ids.length === 0) continue;

        const newsEvent = await prisma.newsEvent.create({
          data: {
            title: cluster.theme,
            summaryWhat: '',
            summaryWhy: '',
            summaryFuture: '',
            importanceScore: 0,
            categoryId: category?.id,
          },
        });

        await prisma.article.updateMany({
          where: { id: { in: ids } },
          data: { newsEventId: newsEvent.id },
        });

        ids.forEach((id) => assigned.add(id));
        eventCount++;
      }

      // Drain guarantee: anything the model left out becomes its own event
      // (unless we've hit the daily cap, in which case it stays queued).
      for (const article of articles) {
        if (eventCount >= maxNewEvents) break;
        if (assigned.has(article.id)) continue;
        const newsEvent = await prisma.newsEvent.create({
          data: {
            title: article.title,
            summaryWhat: '',
            summaryWhy: '',
            summaryFuture: '',
            importanceScore: 0,
            categoryId: category?.id,
          },
        });
        await prisma.article.update({
          where: { id: article.id },
          data: { newsEventId: newsEvent.id },
        });
        assigned.add(article.id);
        eventCount++;
      }
    }
  }

  console.log(`Created ${eventCount} new events.`);
  return eventCount;
}
