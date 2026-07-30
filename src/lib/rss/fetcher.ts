import Parser from 'rss-parser';
import { prisma, STALE_SOURCE_MS } from '@/lib/db';
import { CATEGORY_NAMES, SOURCES } from '@/lib/data/sources';

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

const ITEMS_PER_FEED = 5;
// Cap concurrent feeds so we don't exhaust the (serverless) DB connection pool.
const CONCURRENCY = 6;

const defaultDeadline = () => Date.now() + 45_000;

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
    // Always stamp the attempt — even on failure — so a source drops out of the
    // "stale" set for this run cycle instead of being retried every pass.
    await prisma.source
      .update({ where: { id: sourceId }, data: { lastFetched: new Date() } })
      .catch(() => {});
  }
  return addedCount;
}

/**
 * Collect from every active news source that hasn't been fetched this cycle,
 * in bounded-concurrency batches, until none remain stale or the deadline hits.
 * Because fetchRss stamps lastFetched, each batch advances through the list and
 * the whole thing terminates once all sources are fresh.
 */
export async function fetchAllActiveSources(deadline: number = defaultDeadline()) {
  await ensureSourcesSeeded();

  const staleBefore = new Date(Date.now() - STALE_SOURCE_MS);
  let totalAdded = 0;

  while (Date.now() < deadline) {
    const sources = await prisma.source.findMany({
      where: {
        isActive: true,
        type: 'rss',
        category: { name: { not: '최신 논문/연구' } },
        OR: [{ lastFetched: null }, { lastFetched: { lt: staleBefore } }],
      },
      orderBy: { lastFetched: { sort: 'asc', nulls: 'first' } },
      take: CONCURRENCY,
    });

    if (sources.length === 0) break; // everything fresh — done

    const results = await Promise.allSettled(
      sources.map((source) => fetchRss(source.id, source.url))
    );
    for (const result of results) {
      if (result.status === 'fulfilled') totalAdded += result.value;
    }
  }

  return totalAdded;
}

/** How many sources still need collecting this cycle (used to decide continuation). */
export async function countStaleSources() {
  const staleBefore = new Date(Date.now() - STALE_SOURCE_MS);
  return prisma.source.count({
    where: {
      isActive: true,
      type: 'rss',
      category: { name: { not: '최신 논문/연구' } },
      OR: [{ lastFetched: null }, { lastFetched: { lt: staleBefore } }],
    },
  });
}
