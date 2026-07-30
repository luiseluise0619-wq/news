import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parser = new Parser({
  timeout: 5000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

export async function fetchRss(sourceId: string, url: string) {
  try {
    const feed = await parser.parseURL(url);

    let addedCount = 0;

    // Only take top 3 items to speed up processing for testing
    const items = feed.items.slice(0, 3);

    for (const item of items) {
      if (!item.link || !item.title) continue;

      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

      // Check for duplication
      const existingArticle = await prisma.article.findUnique({
        where: { url: item.link }
      });

      if (!existingArticle) {
        await prisma.article.create({
          data: {
            title: item.title,
            url: item.link,
            content: item.contentSnippet || item.content || '',
            publishedAt,
            sourceId: sourceId
          }
        });
        addedCount++;
      }
    }

    await prisma.source.update({
      where: { id: sourceId },
      data: { lastFetched: new Date() }
    });

    console.log(`Fetched ${addedCount} new articles from ${url}`);
    return addedCount;
  } catch (error) {
    console.error(`Failed to fetch RSS from ${url}:`, (error as Error).message);
    return 0;
  }
}

export async function fetchAllActiveSources() {
  const sources = await prisma.source.findMany({
    where: { isActive: true, type: 'rss', category: { name: { not: '최신 논문/연구' } } }
  });

  let totalAdded = 0;
  // Limit to first 5 sources to prevent Vercel Timeout
  const activeSources = sources.slice(0, 5);

  for (const source of activeSources) {
    const added = await fetchRss(source.id, source.url);
    totalAdded += added;
  }

  return totalAdded;
}
