import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parser = new Parser();

export async function fetchRss(sourceId: string, url: string) {
  try {
    const feed = await parser.parseURL(url);

    let addedCount = 0;

    for (const item of feed.items) {
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

    // Update lastFetched for source
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastFetched: new Date() }
    });

    console.log(`Fetched ${addedCount} new articles from ${url}`);
    return addedCount;
  } catch (error) {
    console.error(`Failed to fetch RSS from ${url}:`, error);
    return 0;
  }
}

export async function fetchAllActiveSources() {
  const sources = await prisma.source.findMany({
    where: { isActive: true, type: 'rss' }
  });

  let totalAdded = 0;
  for (const source of sources) {
    const added = await fetchRss(source.id, source.url);
    totalAdded += added;
  }

  return totalAdded;
}
