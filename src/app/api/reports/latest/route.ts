import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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

    if (!latestReport) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json(latestReport);
  } catch (error) {
    console.error("Failed to fetch latest report:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
