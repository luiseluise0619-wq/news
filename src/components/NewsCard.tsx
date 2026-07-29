import React from 'react';
import { Newspaper, ChevronRight } from 'lucide-react';
import { NewsEvent, Article } from '@prisma/client';

type NewsCardProps = {
  event: NewsEvent & { articles?: Article[] };
};

export default function NewsCard({ event }: NewsCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {event.title}
        </h3>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Score: {event.importanceScore}/10
        </span>
      </div>

      <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">무슨 일이 있었나:</span>
          <p>{event.summaryWhat || '요약 진행 중...'}</p>
        </div>
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">왜 중요한가:</span>
          <p>{event.summaryWhy || '요약 진행 중...'}</p>
        </div>
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">앞으로 주목할 점:</span>
          <p>{event.summaryFuture || '요약 진행 중...'}</p>
        </div>
      </div>

      {event.articles && event.articles.length > 0 && (
        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center">
            <Newspaper className="w-3 h-3 mr-1" /> 출처 ({event.articles.length})
          </h4>
          <ul className="space-y-2">
            {event.articles.slice(0, 3).map((article) => (
              <li key={article.id}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center group"
                >
                  <span className="truncate flex-1">{article.title}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                </a>
              </li>
            ))}
            {event.articles.length > 3 && (
              <li className="text-xs text-zinc-500">
                + {event.articles.length - 3} more sources...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
