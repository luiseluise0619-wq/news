import Parser from 'rss-parser';
import { prisma, STALE_SOURCE_MS } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { z } from 'zod';

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'Mozilla/5.0' }
});

const ITEMS_PER_FEED = 2;
const defaultDeadline = () => Date.now() + 45_000;

const schema = z.object({
  coreFinding: z.string(),
  importance: z.string(),
  limitations: z.string().nullable(),
  importanceScore: z.number().min(1).max(10),
  field: z.string(),
  authors: z.string(),
  institution: z.string().nullable(),
});

export async function fetchPapers(deadline: number = defaultDeadline()) {
  const staleBefore = new Date(Date.now() - STALE_SOURCE_MS);
  let addedCount = 0;

  while (Date.now() < deadline) {
    // Rotate paper sources the same way as news sources so we cover them all.
    const source = await prisma.source.findFirst({
      where: {
        isActive: true,
        category: { name: '최신 논문/연구' },
        OR: [{ lastFetched: null }, { lastFetched: { lt: staleBefore } }],
      },
      orderBy: { lastFetched: { sort: 'asc', nulls: 'first' } },
    });

    if (!source) break; // all paper sources fresh — done

    try {
      const feed = await parser.parseURL(source.url);
      const recentItems = feed.items.slice(0, ITEMS_PER_FEED);

      for (const item of recentItems) {
        if (Date.now() >= deadline) break;
        if (!item.link || !item.title) continue;

        const existingPaper = await prisma.paper.findUnique({ where: { url: item.link } });
        if (existingPaper) continue;

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

        const result = await generateObject(prompt, schema, 'You are a scientific researcher. Translate content accurately to Korean.');

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
              institution: result.institution,
            },
          });
          addedCount++;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch papers from ${source.url}:`, (error as Error).message);
    } finally {
      // Mark attempted so rotation advances past this source this cycle.
      await prisma.source
        .update({ where: { id: source.id }, data: { lastFetched: new Date() } })
        .catch(() => {});
    }
  }

  console.log(`Fetched and processed ${addedCount} new papers.`);
  return addedCount;
}
