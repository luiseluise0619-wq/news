import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const prisma = new PrismaClient();
const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0' }
});

export async function fetchPapers() {
  const sources = await prisma.source.findMany({
    where: { isActive: true, category: { name: '최신 논문/연구' } }
  });

  if (sources.length === 0) return 0;

  let addedCount = 0;

  // 모든 논문 소스 가져오기 (제한 해제)
  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      // 최신 논문 최대 10개
      const recentItems = feed.items.slice(0, 10);

      for (const item of recentItems) {
        if (!item.link || !item.title) continue;

        const existingPaper = await prisma.paper.findUnique({
          where: { url: item.link }
        });

        if (!existingPaper) {
          const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

          const prompt = `Extract paper details from the following feed item in Korean:
Title: ${item.title}
Content: ${item.contentSnippet || item.content}

Return a JSON object with:
- coreFinding: A 1-2 sentence summary of the main finding in Korean.
- importance: Why this paper matters in Korean.
- limitations: Any limitations mentioned, or "명시되지 않음" in Korean.
- importanceScore: 1-10 scale of importance.
- field: The field of study in Korean (e.g., '기계학습', '생물학').
- authors: Authors list as a string.
- institution: The institution if mentioned, otherwise null.
`;

          const schema = z.object({
            coreFinding: z.string(),
            importance: z.string(),
            limitations: z.string().nullable(),
            importanceScore: z.number().min(1).max(10),
            field: z.string(),
            authors: z.string(),
            institution: z.string().nullable()
          });

          const result = await generateObject(prompt, schema, "You are a scientific researcher. Translate content accurately to Korean.");

          if (result) {
            await prisma.paper.create({
              data: {
                title: item.title.trim(),
                url: item.link,
                publishedAt,
                coreFinding: result.coreFinding,
                importance: result.importance,
                limitations: result.limitations,
                importanceScore: result.importanceScore,
                field: result.field,
                authors: result.authors,
                institution: result.institution
              }
            });
            addedCount++;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch papers from ${source.url}:`, (error as Error).message);
    }
  }

  console.log(`Fetched and processed ${addedCount} new papers.`);
  return addedCount;
}
