import { prisma } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const BATCH_SIZE = 10;
const defaultDeadline = () => Date.now() + 45_000;

// One LLM call per event does both the importance score AND the 3-part summary,
// so we don't spend a separate scoring request per event (~33% fewer calls).
const schema = z.object({
  score: z.number().min(1).max(10).describe('중요도 1~10 (클릭베이트/연예 가십은 1~3)'),
  what: z.string().describe('무슨 일이 있었나: 2-3 sentences max'),
  why: z.string().describe('왜 중요한가: 1-2 sentences max'),
  future: z.string().describe('앞으로 주목할 점: 1 sentence max'),
});

/**
 * Score AND summarize every unprocessed event (summaryWhat === '') in a single
 * LLM call each, in batches until the queue is empty or the deadline hits.
 * Every processed event always gets both a non-zero importanceScore and a
 * non-empty summaryWhat, so the queue always drains and nothing is redone.
 */
export async function extractSummaries(deadline: number = defaultDeadline()) {
  let summarizedCount = 0;

  while (Date.now() < deadline) {
    const events = await prisma.newsEvent.findMany({
      where: { summaryWhat: '' },
      include: { articles: true },
      take: BATCH_SIZE,
    });

    if (events.length === 0) break;

    for (const event of events) {
      if (Date.now() >= deadline) break;

      if (event.articles.length === 0) {
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: { importanceScore: 1, summaryWhat: '본문 없음', summaryWhy: '-', summaryFuture: '-' },
        });
        continue;
      }

      const articleContents = event.articles
        .slice(0, 2)
        .map((a) => `Title: ${a.title}\nContent: ${a.content}`)
        .join('\n\n---\n\n');

      const prompt = `Summarize the following news event in Korean based ONLY on the provided articles, and rate its importance. Do not invent facts.

Event: ${event.title}

Articles:
${articleContents}

Return:
- score: importance from 1 to 10 (people affected, economic/international impact, scientific importance, long-term implications, urgency, usefulness; clickbait or celebrity gossip is 1-3).
- what (무슨 일이 있었나)
- why (왜 중요한가)
- future (앞으로 주목할 점)
`;

      const result = await generateObject(prompt, schema, 'You are an AI journalist writing clear, concise, factual summaries and rating story importance.');

      if (result && result.what && result.why && result.future) {
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: {
            importanceScore: result.score || 5,
            summaryWhat: result.what,
            summaryWhy: result.why,
            summaryFuture: result.future,
          },
        });
        summarizedCount++;
      } else {
        // Low score so failed items don't surface in the report; non-empty
        // summaryWhat so the event still drains out of the queue.
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: {
            importanceScore: 2,
            summaryWhat: '요약 생성 실패',
            summaryWhy: '요약 생성 실패',
            summaryFuture: '요약 생성 실패',
          },
        });
      }
    }
  }

  console.log(`Successfully scored & summarized ${summarizedCount} events.`);
  return summarizedCount;
}
