import { prisma } from '@/lib/db';
import { generateObject, generateText } from '../ai/provider';
import { CATEGORY_NAMES } from '../data/sources';
import { z } from 'zod';

// One LLM call turns the freshly collected headlines into the entire report
// (clustering + scoring + summaries + overview), instead of one call per event.
// This keeps generation fast and well within the free-tier quota.
const MAX_INPUT_ARTICLES = 25;
const MAX_EVENTS = 15;

const eventSchema = z.object({
  title: z.string(),
  category: z.string(),
  what: z.string(),
  why: z.string(),
  future: z.string(),
  importance: z.number().min(1).max(10),
  articleIds: z.array(z.string()),
});

const schema = z.object({
  topChanges: z.string().describe('오늘 꼭 알아야 할 핵심 5가지, 한국어 불릿'),
  whatMatters: z.string().describe('가장 중요한 3가지를 왜 중요한지 한국어로 심층 설명'),
  events: z.array(eventSchema).describe(`중요도 높은 순 최대 ${MAX_EVENTS}개의 이벤트`),
});

type ReportResult = z.infer<typeof schema>;

/** Best-effort JSON extraction from a plain-text LLM response. */
function parseLenient(raw: string): ReportResult | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const parsed = schema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

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

  const ensureReport = async () => {
    if (!report) {
      report = await prisma.dailyReport.create({
        data: { date: startOfDay, topChanges: '생성 중…', whatMatters: '생성 중…' },
      });
    }
    return report;
  };

  if (articles.length === 0) {
    await ensureReport();
    return { report: report!, eventsCreated: 0, llmFailed: false };
  }

  const articleData = articles.map((a) => ({
    id: a.id,
    title: a.title,
    snippet: (a.content || '').slice(0, 250),
    category: a.source.category?.name || '기타',
    source: a.source.name,
  }));

  const prompt = `당신은 한국어 뉴스 브리핑 편집자입니다. 아래 오늘 수집된 기사들로 "데일리 인텔리전스" 리포트를 작성하세요.

기사 목록(JSON):
${JSON.stringify(articleData)}

규칙:
1. 같은 사건을 다루는 기사는 하나의 event로 묶으세요.
2. 중요도 높은 순으로 최대 ${MAX_EVENTS}개의 event만 선정하세요. (클릭베이트·단순 연예가십 제외)
3. 각 event: title(한국어 제목), category(반드시 다음 중 하나: ${CATEGORY_NAMES.join(', ')}), what(무슨 일이 있었나), why(왜 중요한가), future(앞으로 주목할 점), importance(1~10), articleIds(그 event에 해당하는 기사 id 배열).
4. topChanges: 오늘 꼭 알아야 할 핵심 5가지를 한국어 불릿으로.
5. whatMatters: 가장 중요한 3가지를 골라 왜 중요한지 한국어로 심층 설명.

모든 텍스트는 한국어. 기사에 없는 사실은 지어내지 마세요.`;

  const system = '당신은 정확하고 간결한 뉴스 편집자입니다.';

  // Primary: structured output. Fallback: plain text JSON parsed leniently —
  // structured output can fail on large nested schemas.
  let result = await generateObject(prompt, schema, system);
  if (!result) {
    const raw = await generateText(`${prompt}\n\n반드시 유효한 JSON 객체 하나만 출력하세요.`, system);
    result = parseLenient(raw);
  }

  await ensureReport();

  if (!result || !result.events || result.events.length === 0) {
    // Make the failure visible instead of leaving a stale "생성 중…".
    await prisma.dailyReport.update({
      where: { id: report!.id },
      data: {
        topChanges: '요약 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
        whatMatters: '-',
      },
    });
    return { report: report!, eventsCreated: 0, llmFailed: true };
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
        dailyReportId: report!.id,
      },
    });

    if (ids.length > 0) {
      await prisma.article.updateMany({ where: { id: { in: ids } }, data: { newsEventId: newsEvent.id } });
    }
    eventsCreated++;
  }

  await prisma.dailyReport.update({
    where: { id: report!.id },
    data: { topChanges: result.topChanges, whatMatters: result.whatMatters },
  });

  console.log(`Fast report: created ${eventsCreated} events from ${articles.length} articles.`);
  return { report: report!, eventsCreated, llmFailed: false };
}
