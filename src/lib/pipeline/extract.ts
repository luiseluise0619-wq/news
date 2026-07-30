import { prisma } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const BATCH_SIZE = 10;
const defaultDeadline = () => Date.now() + 45_000;

const schema = z.object({
  what: z.string().describe('무슨 일이 있었나: 2-3 sentences max'),
  why: z.string().describe('왜 중요한가: 1-2 sentences max'),
  future: z.string().describe('앞으로 주목할 점: 1 sentence max'),
});

/**
 * Write the 3-part Korean summary for every event that doesn't have one yet
 * (summaryWhat === ''), in batches until the queue is empty or the deadline
 * hits. Every processed event always gets a non-empty summaryWhat (even on
 * failure), so the queue always drains and events are never re-summarized.
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
          data: { summaryWhat: '본문 없음', summaryWhy: '-', summaryFuture: '-' },
        });
        continue;
      }

      const articleContents = event.articles
        .slice(0, 2)
        .map((a) => `Title: ${a.title}\nContent: ${a.content}`)
        .join('\n\n---\n\n');

      const prompt = `Summarize the following news event in Korean based ONLY on the provided articles. Do not invent facts.

Event: ${event.title}

Articles:
${articleContents}

Provide the following sections:
1. 무슨 일이 있었나 (What happened)
2. 왜 중요한가 (Why it matters)
3. 앞으로 주목할 점 (What to watch)
`;

      const result = await generateObject(prompt, schema, 'You are an AI journalist writing clear, concise, and factual summaries.');

      if (result && result.what && result.why && result.future) {
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: { summaryWhat: result.what, summaryWhy: result.why, summaryFuture: result.future },
        });
        summarizedCount++;
      } else {
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: { summaryWhat: '요약 생성 실패', summaryWhy: '요약 생성 실패', summaryFuture: '요약 생성 실패' },
        });
      }
    }
  }

  console.log(`Successfully summarized ${summarizedCount} events.`);
  return summarizedCount;
}
