import { NextResponse } from 'next/server';
import { fetchAllActiveSources } from '@/lib/rss/fetcher';
import { fetchPapers } from '@/lib/rss/paperFetcher';
import { generateFastReport } from '@/lib/pipeline/fastReport';
import { buildReportHtml, sendReportEmail } from '@/lib/email/report';
import { prisma } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Collection may re-fetch stale feeds; bound it so the (single) LLM report call
// always gets to run within the request.
const COLLECTION_BUDGET_MS = 12_000;

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
 * everything with the real model.
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const reset = url.searchParams.get('reset') === '1';

    await prisma.$connect();

    let mockCleared = 0;
    if (reset) {
      mockCleared = await resetMockData();
    }

    // 1) Collect (bounded).
    const collectionDeadline = Date.now() + COLLECTION_BUDGET_MS;
    const articlesAdded = await fetchAllActiveSources(collectionDeadline);
    const papersAdded = await fetchPapers(collectionDeadline);

    // 2) Build the whole report in a single LLM call.
    const { report, eventsCreated, llmFailed } = await generateFastReport();

    // 3) Optionally email it (used by the daily cron: ?email=1). No-op unless
    // the email env vars are configured.
    let emailed: boolean | undefined;
    if (url.searchParams.get('email') === '1' && report) {
      const full = await prisma.dailyReport.findUnique({
        where: { id: report.id },
        include: {
          newsEvents: { include: { articles: true, category: true }, orderBy: { importanceScore: 'desc' } },
          papers: true,
        },
      });
      if (full) {
        const dateStr = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(full.date));
        const result = await sendReportEmail(buildReportHtml(full), `[Daily Intelligence] ${dateStr}`);
        emailed = result.sent;
        if (!result.sent && result.reason !== 'not_configured') {
          console.error('Report email failed:', result.reason);
        }
      }
    }

    const [sourceCount, articleCount, pendingArticles] = await Promise.all([
      prisma.source.count(),
      prisma.article.count(),
      prisma.article.count({ where: { newsEventId: null } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        aiConfigured: aiKeyPresent(),
        mockCleared,
        sourceCount,
        articleCount,
        articlesAdded,
        papersAdded,
        eventsCreated,
        llmFailed,
        pendingArticles,
        emailed,
        reportId: report ? report.id : null,
      },
    });
  } catch (error) {
    console.error('Daily pipeline failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
