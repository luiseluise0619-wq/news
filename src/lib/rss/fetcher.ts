import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';
import { CATEGORY_NAMES, SOURCES } from '@/lib/data/sources';

const prisma = new PrismaClient();
const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

const ITEMS_PER_FEED = 5;
// How many sources to pull per run. Sources are rotated by lastFetched, so a
// single run stays fast while consecutive runs cover the whole list.
const MAX_SOURCES_PER_RUN = 12;
// Cap concurrent feeds so we don't exhaust the (serverless) DB connection pool.
const CONCURRENCY = 6;

/**
 * Ensure categories and sources exist. On a fresh deploy the build only runs
 * `prisma migrate deploy` (no seed), so without this the Source table is empty
 * and collection silently returns 0. Idempotent: no-op once sources exist.
 */
export async function ensureSourcesSeeded() {
  const count = await prisma.source.count();
  if (count > 0) return;

  console.log('No sources found — seeding categories and sources...');

  const catByName: Record<string, string> = {};
  for (const name of CATEGORY_NAMES) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    catByName[name] = cat.id;
  }

  for (const s of SOURCES) {
    const categoryId = catByName[s.category];
    if (!categoryId) continue;
    const existing = await prisma.source.findFirst({ where: { url: s.url } });
    if (!existing) {
      await prisma.source.create({
        data: { name: s.name, url: s.url, type: s.type, categoryId },
      });
    }
  }
  console.log(`Seeding complete: ${SOURCES.length} sources initialized.`);
}

export async function fetchRss(sourceId: string, url: string) {
  let addedCount = 0;
  try {
    const feed = await parser.parseURL(url);

    const items = feed.items.slice(0, ITEMS_PER_FEED);

    for (const item of items) {
      if (!item.link || !item.title) continue;

      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

      // Skip if we already have this article.
      const existingArticle = await prisma.article.findUnique({
        where: { url: item.link },
      });

      if (!existingArticle) {
        await prisma.article.create({
          data: {
            title: item.title,
            url: item.link,
            content: item.contentSnippet || item.content || '',
            publishedAt,
            sourceId,
          },
        });
        addedCount++;
      }
    }

    console.log(`Fetched ${addedCount} new articles from ${url}`);
  } catch (error) {
    console.error(`Failed to fetch RSS from ${url}:`, (error as Error).message);
  } finally {
    // Always stamp the attempt time — even on failure — so the lastFetched
    // rotation advances past broken/slow feeds instead of retrying the same
    // few every run.
    await prisma.source
      .update({ where: { id: sourceId }, data: { lastFetched: new Date() } })
      .catch(() => {});
  }
  return addedCount;
}

export async function fetchAllActiveSources() {
  // Make sure there is something to fetch even on a freshly migrated DB.
  await ensureSourcesSeeded();

  const sources = await prisma.source.findMany({
    where: { isActive: true, type: 'rss', category: { name: { not: '최신 논문/연구' } } },
    // Oldest-fetched (and never-fetched) first, so each run rotates through the
    // full source list instead of always hitting the same first few.
    orderBy: { lastFetched: { sort: 'asc', nulls: 'first' } },
    take: MAX_SOURCES_PER_RUN,
  });

  let totalAdded = 0;

  // Fetch in bounded-concurrency batches. Promise.allSettled means one slow or
  // broken feed can never block the others.
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((source) => fetchRss(source.id, source.url))
    );
    for (const result of results) {
      if (result.status === 'fulfilled') totalAdded += result.value;
    }
  }

  return totalAdded;
}
