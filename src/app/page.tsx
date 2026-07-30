export const dynamic = 'force-dynamic';

import { PrismaClient, NewsEvent, Paper } from '@prisma/client';
import NewsCard from '@/components/NewsCard';
import Sidebar from '@/components/Sidebar';

const prisma = new PrismaClient();
export const revalidate = 3600;

export default async function Home() {
  const latestReport = await prisma.dailyReport.findFirst({
    orderBy: { date: 'desc' },
    include: {
      newsEvents: {
        include: { articles: true, category: true },
        orderBy: { importanceScore: 'desc' }
      },
      papers: true
    }
  });

  const getEventsByCategory = (categoryMap: Record<string, string[]>) => {
    if (!latestReport) return {};
    const result: Record<string, any[]> = {};

    latestReport.newsEvents.forEach(event => {
      const catName = event.category?.name || '기타';

      let assigned = false;
      for (const [section, categories] of Object.entries(categoryMap)) {
        if (categories.includes(catName)) {
          if (!result[section]) result[section] = [];
          result[section].push(event);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        if (!result['기타']) result['기타'] = [];
        result['기타'].push(event);
      }
    });

    return result;
  };

  const sections = {
    '🇰🇷 KOREA': ['대한민국', '정치/국제'],
    '🌎 WORLD': ['세계', '정치/국제'],
    '💰 ECONOMY': ['경제/금융'],
    '🤖 AI & TECHNOLOGY': ['AI', 'IT/테크'],
    '🧬 MEDICAL & BIO': ['의료/바이오'],
    '🇪🇺 EUROPE': ['독일/유럽'],
    '🏢 BUSINESS & STARTUPS': ['기업/산업', '스타트업'],
  };

  const categorizedEvents = getEventsByCategory(sections);

  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center p-6 md:p-10 overflow-y-auto">
        <div className="w-full max-w-4xl">
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter mb-2">
              DAILY INTELLIGENCE
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">
              {latestReport
                ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(latestReport.date)
                : '오늘의 리포트를 준비 중입니다.'}
            </p>
          </header>

          {latestReport ? (
            <div className="space-y-12">
              <section className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 p-8 rounded-2xl shadow-lg">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                  TODAY IN 30 SECONDS
                </h2>
                <div className="prose prose-invert dark:prose-neutral whitespace-pre-wrap font-medium">
                  {latestReport.topChanges}
                </div>
              </section>

              {Object.entries(sections).map(([sectionName, _]) => {
                const events = categorizedEvents[sectionName] || [];
                if (events.length === 0) return null;
                return (
                  <section key={sectionName}>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                      {sectionName}
                    </h2>
                    <div className="space-y-6">
                      {events.map((event) => (
                        <NewsCard key={event.id} event={event} />
                      ))}
                    </div>
                  </section>
                );
              })}

              <section>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  🔬 SCIENCE & PAPERS
                </h2>
                <div className="space-y-6">
                  {latestReport.papers.length > 0 ? (
                    latestReport.papers.map((paper) => (
                      <div key={paper.id} className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{paper.title}</h3>
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 ml-2 whitespace-nowrap">
                            {paper.field}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{paper.authors} {paper.institution ? `(${paper.institution})` : ''}</p>
                        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                          <div><span className="font-semibold block">핵심 발견:</span> {paper.coreFinding}</div>
                          <div><span className="font-semibold block">왜 중요한가:</span> {paper.importance}</div>
                          {paper.limitations && paper.limitations !== '명시되지 않음' && (
                            <div><span className="font-semibold block">한계점:</span> {paper.limitations}</div>
                          )}
                        </div>
                        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                          원문 보기 &rarr;
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500">주목할 만한 논문이 없습니다.</p>
                  )}
                  {/* Also show Science news events here */}
                  {(categorizedEvents['기타'] || []).filter(e => e.category?.name === '과학').map((event) => (
                    <NewsCard key={event.id} event={event} />
                  ))}
                </div>
              </section>

              <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm mt-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                  WHAT MATTERS (심층 분석)
                </h2>
                <div className="prose dark:prose-invert whitespace-pre-wrap">
                  {latestReport.whatMatters}
                </div>
              </section>

            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-zinc-500 mb-4">아직 생성된 리포트가 없습니다.</p>
              <form action="/api/cron/daily" method="GET">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                  데이터 수집 및 리포트 생성 시작
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
