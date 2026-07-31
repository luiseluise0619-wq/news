import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildReportHtml, sendReportEmail } from '@/lib/email/report';

export const dynamic = 'force-dynamic';

// Emails the latest report to REPORT_EMAIL_TO (via Resend). No-op with a clear
// message if email env vars aren't configured.
export async function GET() {
  try {
    const report = await prisma.dailyReport.findFirst({
      orderBy: { date: 'desc' },
      include: {
        newsEvents: { include: { articles: true, category: true }, orderBy: { importanceScore: 'desc' } },
        papers: true,
      },
    });

    if (!report) {
      return NextResponse.json({ success: false, error: '보낼 리포트가 없습니다.' }, { status: 404 });
    }

    const dateStr = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(report.date));
    const result = await sendReportEmail(buildReportHtml(report), `[Daily Intelligence] ${dateStr}`);

    if (!result.sent) {
      const status = result.reason === 'not_configured' ? 400 : 502;
      const error =
        result.reason === 'not_configured'
          ? '이메일이 설정되지 않았습니다. RESEND_API_KEY와 REPORT_EMAIL_TO 환경변수를 추가하세요.'
          : `이메일 발송 실패: ${result.reason}`;
      return NextResponse.json({ success: false, error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
