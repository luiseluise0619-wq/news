import { prisma } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const BATCH_SIZE = 10;
const defaultDeadline = () => Date.now() + 45_000;

const schema = z.object({
  score: z.number().min(1).max(10).describe('Importance score from 1 to 10'),
});

/**
 * Score every unscored event (importanceScore === 0) in batches until the queue
 * is empty or the deadline hits. Every event is always given a non-zero score
 * (falling back to a neutral 5), so the queue always drains.
 */
export async function scoreEvents(deadline: number = defaultDeadline()) {
  let scoredCount = 0;

  while (Date.now() < deadline) {
    const events = await prisma.newsEvent.findMany({
      where: { importanceScore: 0 },
      include: { articles: true },
      take: BATCH_SIZE,
    });

    if (events.length === 0) break;

    for (const event of events) {
      if (Date.now() >= deadline) break;

      if (event.articles.length === 0) {
        await prisma.newsEvent.update({ where: { id: event.id }, data: { importanceScore: 1 } });
        continue;
      }

      const articleTitles = event.articles.map((a) => a.title).join('\n- ');
      const prompt = `Evaluate the importance of the following news event on a scale of 1 to 10.
Event Title: ${event.title}
Articles:
- ${articleTitles}

Consider:
- Number of people affected
- Economic impact
- International impact
- Technical/Scientific importance
- Long-term implications
- Urgency
- Usefulness to the reader
(Clickbait or celebrity gossip should be scored low, e.g., 1-3).
`;

      const result = await generateObject(prompt, schema, 'You are a senior news editor evaluating story importance.');

      await prisma.newsEvent.update({
        where: { id: event.id },
        data: { importanceScore: result?.score || 5 },
      });
      if (result?.score) scoredCount++;
    }
  }

  console.log(`Successfully scored ${scoredCount} events.`);
  return scoredCount;
}
