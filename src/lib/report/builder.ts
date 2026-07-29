import { PrismaClient } from '@prisma/client';
import { generateText } from '../ai/provider';

const prisma = new PrismaClient();

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
    take: 50
  });

  const topPapers = await prisma.paper.findMany({
    where: {
      dailyReportId: null,
      importanceScore: { gte: 4 }
    },
    orderBy: { importanceScore: 'desc' },
    take: 10
  });

  if (topEvents.length === 0 && topPapers.length === 0) {
    console.log("No important events or papers found to build a report.");
    return null;
  }

  // Generate "Today in 30 seconds" and "What Matters" using top 10 events
  const absoluteTopEvents = topEvents.slice(0, 10);
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
