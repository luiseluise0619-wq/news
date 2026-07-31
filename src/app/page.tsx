'use client';

import React, { useState, useEffect } from 'react';
import NewsCard from '@/components/NewsCard';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function Home() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendEmail = async () => {
    setEmailing(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/email');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '이메일 발송에 실패했습니다.');
      }
      alert('이메일을 보냈습니다.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailing(false);
    }
  };

  const fetchReport = async () => {
    try {
      const res = await fetch('/api/reports/latest');
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        return data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    return null;
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/cron/daily');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '리포트 생성 중 오류가 발생했습니다.');
      }
      await fetchReport();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const getEventsByCategory = (categoryMap: Record<string, string[]>, report: any) => {
    if (!report || !report.newsEvents) return {};
    const result: Record<string, any[]> = {};

    report.newsEvents.forEach((event: any) => {
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

  const categorizedEvents = getEventsByCategory(sections, reportData);

  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center p-6 md:p-10 overflow-y-auto">
        <div className="w-full max-w-4xl">
          <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter mb-2">
                DAILY INTELLIGENCE
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium h-8">
                {loading
                  ? '로딩 중...'
                  : reportData
                    ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date(reportData.date))
                    : '오늘의 리포트를 준비 중입니다.'}
              </p>
            </div>

            {/* Interactive controls — hidden when printing to PDF. */}
            {!loading && (
              <div className="no-print flex items-center gap-2 shrink-0">
                {reportData && (
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium text-sm transition-all"
                  >
                    PDF로 저장
                  </button>
                )}
                {reportData && (
                  <button
                    onClick={handleSendEmail}
                    disabled={emailing}
                    className="inline-flex items-center px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {emailing ? '보내는 중…' : '메일로 보내기'}
                  </button>
                )}
                <button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      수집·분석 중...
                    </>
                  ) : reportData ? (
                    '리포트 새로고침'
                  ) : (
                    '리포트 생성'
                  )}
                </button>
              </div>
            )}
          </header>

          {error && !loading && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800 text-sm break-all">
              {error}
            </div>
          )}

          {loading ? (
             <div className="flex justify-center items-center py-20">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
             </div>
          ) : reportData ? (
            <div id="report" className="space-y-12">
              <section className="report-hero bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 p-8 rounded-2xl shadow-lg">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                  TODAY IN 30 SECONDS
                </h2>
                <div className="prose prose-invert dark:prose-neutral whitespace-pre-wrap font-medium">
                  {reportData.topChanges}
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
                  {reportData.papers && reportData.papers.length > 0 ? (
                    reportData.papers.map((paper: any) => (
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
                  {(categorizedEvents['기타'] || []).filter((e: any) => e.category?.name === '과학').map((event: any) => (
                    <NewsCard key={event.id} event={event} />
                  ))}
                </div>
              </section>

              <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm mt-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                  WHAT MATTERS (심층 분석)
                </h2>
                <div className="prose dark:prose-invert whitespace-pre-wrap">
                  {reportData.whatMatters}
                </div>
              </section>

            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-zinc-500 mb-4">아직 생성된 리포트가 없습니다.</p>

              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generating ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    데이터 수집 및 AI 분석 중...
                  </span>
                ) : (
                  '데이터 수집 및 리포트 생성 시작'
                )}
              </button>

              {generating && (
                <p className="mt-4 text-xs text-zinc-500 max-w-md mx-auto">
                  참고: Vercel의 취미(Hobby) 요금제를 사용 중이신 경우, 10~60초의 서버 실행 시간 제한으로 인해 "504 Gateway Timeout" 에러가 발생할 수 있습니다.
                  운영을 위해서는 로컬 환경이나 Vercel Pro 요금제 권장.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
