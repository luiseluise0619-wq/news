import { prisma } from '@/lib/db';
import { generateObject } from '../ai/provider';
import { CATEGORY_NAMES } from '../data/sources';
import { z } from 'zod';

// One LLM call turns the freshly collected headlines into the entire report
// (clustering + scoring + summaries + overview), instead of one call per event.
// This keeps generation fast and well within the free-tier quota.
const MAX_INPUT_ARTICLES = 40;
const MAX_EVENTS = 15;

const schema = z.object({
  topChanges: z.string().describe('오늘 꼭 알아야 할 핵심 5가지, 한국어 불릿'),
  whatMatters: z.string().describe('가장 중요한 3가지를 왜 중요한지 한국어로 심층 설명'),
  events: z
    .array(
      z.object({
        title: z.string(),
        category: z.string(),
        what: z.string(),
        why: z.string(),
        future: z.string(),
        importance: z.number().min(1).max(10),
        articleIds: z.array(z.string()),
      }),
    )
    .describe(`중요도 높은 순 최대 ${MAX_EVENTS}개의 이벤트`),
});

export async function generateFastReport() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const articles = await prisma.article.findMany({
    where: { newsEventId: null },
    orderBy: { publishedAt: 'desc' },
    take: MAX_INPUT_ARTICLES,
    include: { source: { include: { category: true } } },
  });

  let report = await prisma.dailyReport.findUnique({ where: { date: startOfDay } });

  if (articles.length === 0) {
    if (!report) {
      report = await prisma.dailyReport.create({
        data: { date: startOfDay, topChanges: '오늘 수집된 새 뉴스가 없습니다.', whatMatters: '-' },
      });
    }
    return { report, eventsCreated: 0 };
  }

  const articleData = articles.map((a) => ({
    id: a.id,
    title: a.title,
    snippet: (a.content || '').slice(0, 300),
    category: a.source.category?.name || '기타',
    source: a.source.name,
  }));

  const prompt = `당신은 한국어 뉴스 브리핑 편집자입니다. 아래 오늘 수집된 기사들로 "데일리 인텔리전스" 리포트를 작성하세요.

기사 목록(JSON):
${JSON.stringify(articleData, null, 2)}

규칙:
1. 같은 사건을 다루는 기사는 하나의 event로 묶으세요.
2. 중요도 높은 순으로 최대 ${MAX_EVENTS}개의 event만 선정하세요. (클릭베이트·단순 연예가십 제외)
3. 각 event: title(한국어 제목), category(반드시 다음 중 하나: ${CATEGORY_NAMES.join(', ')}), what(무슨 일이 있었나), why(왜 중요한가), future(앞으로 주목할 점), importance(1~10), articleIds(그 event에 해당하는 기사 id 배열).
4. topChanges: 오늘 꼭 알아야 할 핵심 5가지를 한국어 불릿으로.
5. whatMatters: 가장 중요한 3가지를 골라 왜 중요한지 한국어로 심층 설명.

모든 텍스트는 한국어. 기사에 없는 사실은 지어내지 마세요.`;

  const result = await generateObject(prompt, schema, '당신은 정확하고 간결한 뉴스 편집자입니다.');

  if (!report) {
    report = await prisma.dailyReport.create({
      data: { date: startOfDay, topChanges: '생성 중…', whatMatters: '생성 중…' },
    });
  }

  if (!result || !result.events || result.events.length === 0) {
    return { report, eventsCreated: 0 };
  }

  const categories = await prisma.category.findMany();
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const validIds = new Set(articles.map((a) => a.id));

  let eventsCreated = 0;
  for (const ev of result.events.slice(0, MAX_EVENTS)) {
    const ids = (ev.articleIds || []).filter((id) => validIds.has(id));

    const newsEvent = await prisma.newsEvent.create({
      data: {
        title: ev.title,
        summaryWhat: ev.what,
        summaryWhy: ev.why,
        summaryFuture: ev.future,
        importanceScore: Math.min(10, Math.max(1, Math.round(ev.importance) || 5)),
        categoryId: catByName[ev.category] ?? null,
        dailyReportId: report.id,
      },
    });

    if (ids.length > 0) {
      await prisma.article.updateMany({ where: { id: { in: ids } }, data: { newsEventId: newsEvent.id } });
    }
    eventsCreated++;
  }

  await prisma.dailyReport.update({
    where: { id: report.id },
    data: { topChanges: result.topChanges, whatMatters: result.whatMatters },
  });

  console.log(`Fast report: created ${eventsCreated} events from ${articles.length} articles.`);
  return { report, eventsCreated };
}
