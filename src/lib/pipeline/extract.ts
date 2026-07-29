import { PrismaClient } from '@prisma/client';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function extractSummaries() {
  const unsummarizedEvents = await prisma.newsEvent.findMany({
    where: { summaryWhat: "" },
    include: { articles: true }
  });

  console.log(`Summarizing ${unsummarizedEvents.length} events...`);

  const schema = z.object({
    what: z.string().describe("무슨 일이 있었나: 2-3 sentences max"),
    why: z.string().describe("왜 중요한가: 1-2 sentences max"),
    future: z.string().describe("앞으로 주목할 점: 1 sentence max")
  });

  let summarizedCount = 0;

  for (const event of unsummarizedEvents) {
    if (event.articles.length === 0) continue;

    const articleContents = event.articles.map(a => `Title: ${a.title}\nContent: ${a.content}`).join("\n\n---\n\n");

    const prompt = `Summarize the following news event in Korean based ONLY on the provided articles. Do not invent facts.

Event: ${event.title}

Articles:
${articleContents}

Provide the following sections:
1. 무슨 일이 있었나 (What happened)
2. 왜 중요한가 (Why it matters)
3. 앞으로 주목할 점 (What to watch)
`;

    const result = await generateObject(prompt, schema, "You are an AI journalist writing clear, concise, and factual summaries.");

    if (result && result.what && result.why && result.future) {
      await prisma.newsEvent.update({
        where: { id: event.id },
        data: {
          summaryWhat: result.what,
          summaryWhy: result.why,
          summaryFuture: result.future
        }
      });
      summarizedCount++;
    }
  }

  console.log(`Successfully summarized ${summarizedCount} events.`);
  return summarizedCount;
}
