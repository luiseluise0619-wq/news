import { PrismaClient, Article } from '@prisma/client';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function clusterArticles() {
  const unclusteredArticles = await prisma.article.findMany({
    where: { newsEventId: null },
    include: { source: { include: { category: true } } }
  });

  if (unclusteredArticles.length === 0) {
    console.log("No unclustered articles found.");
    return 0;
  }

  console.log(`Clustering ${unclusteredArticles.length} articles...`);

  let eventCount = 0;

  const articlesByCategory = unclusteredArticles.reduce((acc, article) => {
    const categoryName = article.source.category?.name || 'Uncategorized';
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(article);
    return acc;
  }, {} as Record<string, typeof unclusteredArticles>);

  const schema = z.object({
    clusters: z.array(z.object({
      theme: z.string().describe("A short unifying theme/title for this event in Korean"),
      articleIds: z.array(z.string()).describe("IDs of the articles that belong to this event")
    }))
  });

  // Limit processing for Vercel timeouts
  let categoriesProcessed = 0;

  for (const [categoryName, articles] of Object.entries(articlesByCategory)) {
    if (categoriesProcessed >= 3) break; // Limit to 3 categories at a time

    // Process in chunks of 10 to avoid context limits and speed up
    for (let i = 0; i < articles.length && i < 10; i += 10) {
      const chunk = articles.slice(i, i + 10);

      const articleData = chunk.map(a => ({
        id: a.id,
        title: a.title,
        source: a.source.name
      }));

      const prompt = `Group the following news articles into distinct "News Events" if they are talking about the exact same story or event.
Category: ${categoryName}
Articles:
${JSON.stringify(articleData, null, 2)}

Return a JSON object with a list of "clusters".
Only group articles that describe the SAME event. If an article doesn't match others, put it in its own cluster. Theme should be in Korean.`;

      const result = await generateObject(prompt, schema, "You are a helpful assistant that clusters news articles.");

      if (!result || !result.clusters) continue;

      const category = await prisma.category.findUnique({ where: { name: categoryName } });

      for (const cluster of result.clusters) {
        if (cluster.articleIds.length === 0) continue;

        const newsEvent = await prisma.newsEvent.create({
          data: {
            title: cluster.theme,
            summaryWhat: "",
            summaryWhy: "",
            summaryFuture: "",
            importanceScore: 0,
            categoryId: category?.id
          }
        });

        await prisma.article.updateMany({
          where: { id: { in: cluster.articleIds } },
          data: { newsEventId: newsEvent.id }
        });

        eventCount++;
      }
    }
    categoriesProcessed++;
  }

  console.log(`Created ${eventCount} new events.`);
  return eventCount;
}
