import Sidebar from '@/components/Sidebar';
import { Bookmark } from 'lucide-react';

export default function Bookmarks() {
  // In a real app, you'd fetch bookmarks from the database here based on user ID
  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 flex items-center">
            <Bookmark className="mr-3" /> 북마크된 뉴스 및 논문
          </h1>
          <p className="text-zinc-500">북마크 기능은 로컬 스토리지 또는 사용자 인증 후 지원될 예정입니다.</p>
        </div>
      </main>
    </div>
  );
}
