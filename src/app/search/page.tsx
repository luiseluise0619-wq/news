import Sidebar from '@/components/Sidebar';
import { Search } from 'lucide-react';

export default function SearchPage() {
  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 flex items-center">
            <Search className="mr-3" /> 뉴스 검색
          </h1>
          <div className="mb-8">
            <input
              type="text"
              placeholder="검색어를 입력하세요..."
              className="w-full p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <p className="text-zinc-500 text-center py-10">검색 결과가 여기에 표시됩니다.</p>
        </div>
      </main>
    </div>
  );
}
