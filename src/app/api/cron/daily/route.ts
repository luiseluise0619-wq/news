import { NextResponse } from 'next/server';
import { fetchAllActiveSources } from '@/lib/rss/fetcher';
import { fetchPapers } from '@/lib/rss/paperFetcher';
import { clusterArticles } from '@/lib/pipeline/cluster';
import { extractSummaries } from '@/lib/pipeline/extract';
import { buildDailyReport } from '@/lib/report/builder';
import { prisma, STALE_SOURCE_MS } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Per-invocation work budget. Kept under the Vercel Hobby ~60s limit; when a
// pass runs out of budget with work still pending, it hands off to a fresh
// invocation (see continuation below) so the full report completes across a
// few short passes instead of dying in one long one.
const PASS_BUDGET_MS = Number(process.env.PIPELINE_BUDGET_MS) || 30_000;
// Cap how much of each pass collection may consume, so the AI steps are never
// starved (e.g. right after a reset when every source is stale and slow).
const COLLECTION_BUDGET_MS = 15_000;
const MAX_PASSES = 40;
// Max NewsEvents to create (and therefore score+summarize) per calendar day, to
// stay within the Gemini free-tier daily request quota. Leftover articles wait
// for the next day. Override with DAILY_EVENT_CAP (e.g. raise it on a paid tier).
const DAILY_EVENT_CAP = Number(process.env.DAILY_EVENT_CAP) || 15;

function aiKeyPresent() {
  return !!(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

/**
 * Remove data produced while no LLM key was configured ("테스트 모드"/mock and
 * failed summaries), and drop today's report, so the next run regenerates
 * everything with the real model. The pipeline never overwrites an existing
 * summary, so without this the old mock text would persist forever.
 */
async function resetMockData() {
  const mockEvents = await prisma.newsEvent.findMany({
    where: {
      OR: [
        { summaryWhat: { contains: '테스트 모드' } },
        { summaryWhy: { contains: '테스트 모드' } },
        { title: { contains: '테스트 뉴스 클러스터' } },
        { summaryWhat: '요약 생성 실패' },
      ],
    },
    select: { id: true },
  });
  const ids = mockEvents.map((e) => e.id);
  if (ids.length > 0) {
    // Re-queue their articles for clustering, then remove the mock events.
    await prisma.article.updateMany({ where: { newsEventId: { in: ids } }, data: { newsEventId: null } });
    await prisma.newsEvent.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.paper.deleteMany({ where: { coreFinding: { contains: '테스트 모드' } } });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const report = await prisma.dailyReport.findUnique({ where: { date: startOfDay } });
  if (report) {
    await prisma.newsEvent.updateMany({ where: { dailyReportId: report.id }, data: { dailyReportId: null } });
    await prisma.paper.updateMany({ where: { dailyReportId: report.id }, data: { dailyReportId: null } });
    await prisma.dailyReport.delete({ where: { id: report.id } });
  }

  return ids.length;
}

/** Kick off the next pass in a fresh invocation (fire-and-forget). */
async function triggerNextPass(origin: string, pass: number) {
  const params = new URLSearchParams({ pass: String(pass) });
  if (process.env.CRON_SECRET) params.set('key', process.env.CRON_SECRET);
  const nextUrl = `${origin}/api/cron/daily?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    // Await only long enough to dispatch; the receiving invocation runs on its
    // own regardless of this abort.
    await fetch(nextUrl, { signal: controller.signal });
  } catch {
    /* expected: we abort as soon as the request is dispatched */
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pass = Number(url.searchParams.get('pass') || '0');
    const reset = url.searchParams.get('reset') === '1';

    // Protect continuation/cron passes when a secret is configured. The very
    // first pass (manual button / Vercel cron) is allowed without a key.
    if (pass > 0 && process.env.CRON_SECRET) {
      if (url.searchParams.get('key') !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
      }
    }

    const deadline = Date.now() + PASS_BUDGET_MS;
    console.log(`Daily pipeline pass ${pass} (reset=${reset})`);

    await prisma.$connect();

    let mockCleared = 0;
    if (pass === 0 && reset) {
      mockCleared = await resetMockData();
      console.log(`Reset cleared ${mockCleared} mock/failed events.`);
    }

    // Collection gets a bounded slice of the pass so clustering/scoring always
    // get their share; the rest of the pass belongs to the AI steps.
    const collectionDeadline = Math.min(deadline, Date.now() + COLLECTION_BUDGET_MS);
    const articlesAdded = await fetchAllActiveSources(collectionDeadline);
    const papersAdded = await fetchPapers(collectionDeadline);

    // Enforce the daily event cap cumulatively across all of today's passes.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const eventsCreatedToday = await prisma.newsEvent.count({ where: { createdAt: { gte: startOfToday } } });
    const maxNewEvents = Math.max(0, DAILY_EVENT_CAP - eventsCreatedToday);

    const eventsCreated = await clusterArticles(deadline, maxNewEvents);
    // Scoring is now folded into summarization (one LLM call per event).
    const eventsSummarized = await extractSummaries(deadline);

    // How much work is still outstanding across the whole pipeline.
    const staleBefore = new Date(Date.now() - STALE_SOURCE_MS);
    const [pendingArticles, pendingEvents, staleSources, sourceCount, articleCount] = await Promise.all([
      prisma.article.count({ where: { newsEventId: null } }),
      prisma.newsEvent.count({ where: { summaryWhat: '' } }),
      prisma.source.count({
        where: { isActive: true, OR: [{ lastFetched: null }, { lastFetched: { lt: staleBefore } }] },
      }),
      prisma.source.count(),
      prisma.article.count(),
    ]);

    // Once today's cap is hit, stop chewing through the article backlog — those
    // wait for tomorrow. Still continue to finish scoring/summarizing whatever
    // events already exist, and to finish collecting.
    const capReached = eventsCreatedToday + eventsCreated >= DAILY_EVENT_CAP;
    const moreArticlesToday = pendingArticles > 0 && !capReached;
    const willContinue = (pendingEvents > 0 || staleSources > 0 || moreArticlesToday) && pass < MAX_PASSES;

    // Assemble the report every pass so it appears fast and fills in as events
    // are summarized. Finalize the overview on pass 0 too (not just the last
    // pass), so the very first request yields a complete report even if the
    // background continuation chain never runs — no "stuck summarizing" state.
    const report = await buildDailyReport(new Date(), pass === 0 || !willContinue);
    const reportId = report ? report.id : null;

    if (willContinue) {
      await triggerNextPass(url.origin, pass + 1);
    }

    return NextResponse.json({
      success: true,
      data: {
        pass,
        aiConfigured: aiKeyPresent(),
        mockCleared,
        dailyEventCap: DAILY_EVENT_CAP,
        eventsCreatedToday: eventsCreatedToday + eventsCreated,
        sourceCount,
        articleCount,
        articlesAdded,
        papersAdded,
        eventsCreated,
        eventsSummarized,
        pendingArticles,
        pendingEvents,
        staleSources,
        continued: willContinue,
        reportId,
      },
    });
  } catch (error) {
    console.error('Daily pipeline failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
