import { prisma } from '@/lib/db';
import { generateText } from '../ai/provider';

/**
 * Assemble today's report incrementally.
 *
 * Called on every pipeline pass. It ensures a report row exists right away and
 * attaches whatever important events/papers have been summarized so far, so the
 * UI can show the report growing instead of waiting for the whole pipeline.
 *
 * Only on the final pass (`finalize`) does it spend two LLM calls regenerating
 * the "TODAY IN 30 SECONDS" and "WHAT MATTERS" overview from the finished set.
 */
export async function buildDailyReport(date: Date, finalize = true) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  // Ensure a report row for today exists (with placeholder overview text).
  let report = await prisma.dailyReport.findUnique({ where: { date: startOfDay } });
  if (!report) {
    report = await prisma.dailyReport.create({
      data: {
        date: startOfDay,
        topChanges: '오늘의 핵심 요약을 준비하고 있습니다…',
        whatMatters: '심층 분석을 준비하고 있습니다…',
      },
    });
  }

  // Attach any important, summarized events/papers not yet on a report (cheap,
  // no LLM) so they appear immediately.
  const newEvents = await prisma.newsEvent.findMany({
    where: { dailyReportId: null, importanceScore: { gte: 4 } },
    select: { id: true },
  });
  if (newEvents.length > 0) {
    await prisma.newsEvent.updateMany({
      where: { id: { in: newEvents.map((e) => e.id) } },
      data: { dailyReportId: report.id },
    });
  }

  const newPapers = await prisma.paper.findMany({
    where: { dailyReportId: null, importanceScore: { gte: 4 } },
    select: { id: true },
  });
  if (newPapers.length > 0) {
    await prisma.paper.updateMany({
      where: { id: { in: newPapers.map((p) => p.id) } },
      data: { dailyReportId: report.id },
    });
  }

  if (!finalize) {
    return report;
  }

  // Final pass: regenerate the overview from the top events on this report.
  const topEvents = await prisma.newsEvent.findMany({
    where: { dailyReportId: report.id },
    orderBy: { importanceScore: 'desc' },
    take: 5,
  });

  if (topEvents.length === 0) {
    await prisma.dailyReport.update({
      where: { id: report.id },
      data: {
        topChanges: '오늘 주목할 만한 새로운 뉴스가 없습니다.',
        whatMatters: '수집된 중요 이벤트가 없습니다.',
      },
    });
    return report;
  }

  const eventSummaries = topEvents
    .map((e) => `- ${e.title} (Score: ${e.importanceScore}): ${e.summaryWhat}`)
    .join('\n');

  const topChanges = await generateText(
    `Based on the following top news events today, write a summary of the 5 most critical changes or events that someone must know today.
Keep it very concise, bullet points, in Korean.

Events:
${eventSummaries}
`,
    'You are a concise executive summarizer.',
  );

  const whatMatters = await generateText(
    `Based on the following top news events today, pick the top 3 and explain *why* they matter most globally or locally. Write in Korean.

Events:
${eventSummaries}
`,
    'You are a senior analyst.',
  );

  const updated = await prisma.dailyReport.update({
    where: { id: report.id },
    data: {
      topChanges: topChanges || '오늘의 핵심 변화 요약에 실패했습니다.',
      whatMatters: whatMatters || '오늘의 중요한 이유 요약에 실패했습니다.',
    },
  });

  console.log(`Finalized daily report for ${startOfDay.toISOString().split('T')[0]}.`);
  return updated;
}
