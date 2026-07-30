import { prisma } from '@/lib/db';
import { generateText } from '../ai/provider';

export async function buildDailyReport(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingReport = await prisma.dailyReport.findUnique({
    where: { date: startOfDay }
  });

  if (existingReport) {
    console.log(`Report for ${startOfDay.toISOString().split('T')[0]} already exists.`);

    // Always attach any unattached events/papers to today's report
    const topEvents = await prisma.newsEvent.findMany({
      where: { dailyReportId: null, importanceScore: { gte: 4 } }
    });

    if (topEvents.length > 0) {
      await prisma.newsEvent.updateMany({
        where: { id: { in: topEvents.map(e => e.id) } },
        data: { dailyReportId: existingReport.id }
      });
    }

    const topPapers = await prisma.paper.findMany({
      where: { dailyReportId: null, importanceScore: { gte: 4 } }
    });

    if (topPapers.length > 0) {
      await prisma.paper.updateMany({
        where: { id: { in: topPapers.map(p => p.id) } },
        data: { dailyReportId: existingReport.id }
      });
    }

    return existingReport;
  }

  // Get top scored events that haven't been reported yet
  const topEvents = await prisma.newsEvent.findMany({
    where: {
      dailyReportId: null,
      importanceScore: { gte: 4 },
    },
    orderBy: { importanceScore: 'desc' },
    include: { category: true },
    take: 30 // Reduced for timeout safety
  });

  const topPapers = await prisma.paper.findMany({
    where: {
      dailyReportId: null,
      importanceScore: { gte: 4 }
    },
    orderBy: { importanceScore: 'desc' },
    take: 5
  });

  if (topEvents.length === 0 && topPapers.length === 0) {
    console.log("No important events or papers found to build a report.");

    // Create an empty fallback report
    return await prisma.dailyReport.create({
      data: {
        date: startOfDay,
        topChanges: "오늘 수집된 새로운 뉴스가 없습니다. 잠시 후 다시 시도해주세요.",
        whatMatters: "새로운 이벤트가 수집되지 않았습니다."
      }
    });
  }

  // Generate "Today in 30 seconds" and "What Matters" using top 5 events
  const absoluteTopEvents = topEvents.slice(0, 5);
  const eventSummaries = absoluteTopEvents.map(e => `- ${e.title} (Score: ${e.importanceScore}): ${e.summaryWhat}`).join('\n');

  const topChangesPrompt = `Based on the following top news events today, write a summary of the 5 most critical changes or events that someone must know today.
Keep it very concise, bullet points, in Korean.

Events:
${eventSummaries}
`;

  const whatMattersPrompt = `Based on the following top news events today, pick the top 3 and explain *why* they matter most globally or locally. Write in Korean.

Events:
${eventSummaries}
`;

  const topChanges = await generateText(topChangesPrompt, "You are a concise executive summarizer.");
  const whatMatters = await generateText(whatMattersPrompt, "You are a senior analyst.");

  const report = await prisma.dailyReport.create({
    data: {
      date: startOfDay,
      topChanges: topChanges || "오늘의 핵심 변화 요약에 실패했습니다.",
      whatMatters: whatMatters || "오늘의 중요한 이유 요약에 실패했습니다.",
    }
  });

  await prisma.newsEvent.updateMany({
    where: { id: { in: topEvents.map(e => e.id) } },
    data: { dailyReportId: report.id }
  });

  await prisma.paper.updateMany({
    where: { id: { in: topPapers.map(p => p.id) } },
    data: { dailyReportId: report.id }
  });

  console.log(`Generated daily report for ${startOfDay.toISOString().split('T')[0]} with ${topEvents.length} events and ${topPapers.length} papers.`);
  return report;
}
