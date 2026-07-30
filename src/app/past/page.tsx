export const dynamic = 'force-dynamic';

import { PrismaClient } from '@prisma/client';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

const prisma = new PrismaClient();

export default async function PastReports() {
  const reports = await prisma.dailyReport.findMany({
    orderBy: { date: 'desc' },
    select: { id: true, date: true, topChanges: true }
  });

  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 flex items-center">
            <Calendar className="mr-3" /> 과거 리포트
          </h1>
          <div className="space-y-4">
            {reports.map(report => (
              <Link href={`/?date=${report.date.toISOString().split('T')[0]}`} key={report.id}>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-xl font-semibold mb-2">
                    {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(report.date)}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">
                    {report.topChanges}
                  </p>
                </div>
              </Link>
            ))}
            {reports.length === 0 && <p>과거 리포트가 없습니다.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
