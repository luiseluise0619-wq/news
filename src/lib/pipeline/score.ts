import { PrismaClient, NewsEvent } from '@prisma/client';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function scoreEvents() {
  const unscoredEvents = await prisma.newsEvent.findMany({
    where: { importanceScore: 0 },
    include: { articles: true }
  });

  console.log(`Scoring ${unscoredEvents.length} events...`);

  const schema = z.object({
    score: z.number().min(1).max(10).describe("Importance score from 1 to 10")
  });

  let scoredCount = 0;

  for (const event of unscoredEvents) {
    if (event.articles.length === 0) continue;

    const articleTitles = event.articles.map(a => a.title).join("\n- ");

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

    const result = await generateObject(prompt, schema, "You are a senior news editor evaluating story importance.");

    if (result && result.score) {
      await prisma.newsEvent.update({
        where: { id: event.id },
        data: { importanceScore: result.score }
      });
      scoredCount++;
    }
  }

  console.log(`Successfully scored ${scoredCount} events.`);
  return scoredCount;
}
