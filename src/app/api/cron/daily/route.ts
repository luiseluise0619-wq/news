import { NextResponse } from 'next/server';
import { fetchAllActiveSources } from '@/lib/rss/fetcher';
import { fetchPapers } from '@/lib/rss/paperFetcher';
import { clusterArticles } from '@/lib/pipeline/cluster';
import { scoreEvents } from '@/lib/pipeline/score';
import { extractSummaries } from '@/lib/pipeline/extract';
import { buildDailyReport } from '@/lib/report/builder';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    console.log("Starting daily pipeline...");

    // Check if we can reach the DB
    await prisma.$connect();

    console.log("Step 1: Fetching RSS...");
    const articlesAdded = await fetchAllActiveSources();

    console.log("Step 1.5: Fetching Papers...");
    const papersAdded = await fetchPapers();

    console.log("Step 2: Clustering articles into events...");
    const eventsCreated = await clusterArticles();

    console.log("Step 3: Scoring events...");
    const eventsScored = await scoreEvents();

    console.log("Step 4: Extracting summaries...");
    const eventsSummarized = await extractSummaries();

    console.log("Step 5: Building daily report...");
    const today = new Date();
    const report = await buildDailyReport(today);

    return NextResponse.json({
      success: true,
      data: {
        articlesAdded,
        papersAdded,
        eventsCreated,
        eventsScored,
        eventsSummarized,
        reportId: report ? report.id : null
      }
    });

  } catch (error) {
    console.error("Daily pipeline failed:", error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
