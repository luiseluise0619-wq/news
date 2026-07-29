import React from 'react';
import { Home, Calendar, Bookmark, Search, Settings } from 'lucide-react';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black hidden md:flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center">
          <div className="w-6 h-6 bg-blue-600 rounded-md mr-2 flex items-center justify-center">
            <span className="text-white text-xs font-bold">DI</span>
          </div>
          Daily Intelligence
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <Link href="/" className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-white">
          <Home className="mr-3 h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          오늘의 리포트
        </Link>

        <Link href="/past" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <Calendar className="mr-3 h-5 w-5 text-zinc-400" />
          과거 리포트
        </Link>

        <Link href="/bookmarks" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <Bookmark className="mr-3 h-5 w-5 text-zinc-400" />
          북마크
        </Link>

        <Link href="/search" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <Search className="mr-3 h-5 w-5 text-zinc-400" />
          뉴스 검색
        </Link>
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <Settings className="mr-3 h-5 w-5 text-zinc-400" />
          설정
        </button>
      </div>
    </aside>
  );
}
