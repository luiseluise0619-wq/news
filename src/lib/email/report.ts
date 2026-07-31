// Minimal, dependency-free email sending via the Resend REST API.
// Fully optional: a no-op unless RESEND_API_KEY and REPORT_EMAIL_TO are set.

type ReportForEmail = {
  date: Date | string;
  topChanges: string;
  whatMatters: string;
  newsEvents: Array<{
    title: string;
    importanceScore: number;
    summaryWhat: string;
    summaryWhy: string;
    summaryFuture: string;
    category?: { name: string } | null;
    articles?: Array<{ title: string; url: string }>;
  }>;
  papers: Array<{
    title: string;
    field: string;
    coreFinding: string;
    importance: string;
    url: string;
  }>;
};

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildReportHtml(report: ReportForEmail): string {
  const dateStr = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date(report.date));

  const eventsHtml = report.newsEvents
    .map(
      (e) => `
      <div style="border:1px solid #e4e4e7;border-radius:10px;padding:16px 18px;margin:0 0 14px;">
        <div style="display:flex;justify-content:space-between;">
          <strong style="font-size:17px;color:#18181b;">${esc(e.title)}</strong>
        </div>
        <div style="color:#71717a;font-size:12px;margin:2px 0 10px;">${esc(e.category?.name || '기타')} · 중요도 ${e.importanceScore}/10</div>
        <p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>무슨 일:</strong> ${esc(e.summaryWhat)}</p>
        <p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>왜 중요:</strong> ${esc(e.summaryWhy)}</p>
        <p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>주목할 점:</strong> ${esc(e.summaryFuture)}</p>
        ${
          e.articles && e.articles.length > 0
            ? `<div style="margin-top:8px;font-size:12px;">출처: ${e.articles
                .slice(0, 3)
                .map((a) => `<a href="${esc(a.url)}" style="color:#2563eb;">${esc(a.title)}</a>`)
                .join(' · ')}</div>`
            : ''
        }
      </div>`,
    )
    .join('');

  const papersHtml = report.papers.length
    ? `<h2 style="font-size:18px;color:#18181b;margin:26px 0 12px;">🔬 논문 / 연구</h2>` +
      report.papers
        .map(
          (p) => `
        <div style="border:1px solid #e4e4e7;border-radius:10px;padding:16px 18px;margin:0 0 14px;">
          <strong style="font-size:16px;color:#18181b;">${esc(p.title)}</strong>
          <div style="color:#71717a;font-size:12px;margin:2px 0 8px;">${esc(p.field)}</div>
          <p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>핵심 발견:</strong> ${esc(p.coreFinding)}</p>
          <p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>왜 중요:</strong> ${esc(p.importance)}</p>
          <div style="margin-top:6px;font-size:12px;"><a href="${esc(p.url)}" style="color:#2563eb;">원문 보기 →</a></div>
        </div>`,
        )
        .join('')
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
      <h1 style="font-size:26px;font-weight:800;color:#18181b;margin:0 0 2px;letter-spacing:-.5px;">DAILY INTELLIGENCE</h1>
      <div style="color:#71717a;font-size:14px;margin:0 0 20px;">${esc(dateStr)}</div>

      <div style="background:#18181b;color:#fafafa;border-radius:14px;padding:20px 22px;margin:0 0 22px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.5px;margin-bottom:8px;">TODAY IN 30 SECONDS</div>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${esc(report.topChanges)}</div>
      </div>

      ${eventsHtml}
      ${papersHtml}

      <div style="background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:20px 22px;margin:22px 0 0;">
        <div style="font-size:15px;font-weight:700;color:#18181b;margin-bottom:8px;">WHAT MATTERS (심층 분석)</div>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#3f3f46;">${esc(report.whatMatters)}</div>
      </div>

      <div style="color:#a1a1aa;font-size:12px;margin-top:20px;text-align:center;">Daily Intelligence · 자동 생성 리포트</div>
    </div>
  </body></html>`;
}

export async function sendReportEmail(
  html: string,
  subject: string,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  const from = process.env.REPORT_EMAIL_FROM || 'Daily Intelligence <onboarding@resend.dev>';

  if (!apiKey || !to) {
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { sent: false, reason: `resend_${res.status}: ${text.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: (error as Error).message };
  }
}
