'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoCard from '@/components/VideoCard';
import FooterText from '@/components/Footer';

interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
  category: string;
}

interface ApiResponse {
  videos: Video[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
}

export default function HomePage() {
  const router = useRouter();
  const search = useSearchParams();
  const page       = parseInt(search.get('page')   || '1', 10);
  const searchTerm = search.get('search') ?? '';

  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch(
      `/api/videos?` +
      `page=${page}&limit=40` +                                // 한 페이지에 40개
      (searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '')
    )
      .then((res) => res.json())
      .then((json: ApiResponse) => setData(json))
      .catch(console.error);
  }, [page, searchTerm]);

  if (!data) {
    return <p className="p-6">로딩 중…</p>;
  }

  const { videos, pagination } = data;

  return (
    <main className="p-6 max-w-7xl mx-auto">

      {/* 4열 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>

      {/* 숫자 페이징 */}
      <nav className="flex justify-center items-center space-x-2 mt-8">
        <button
          onClick={() => router.push(`/?page=${pagination.page - 1}`)}
          disabled={pagination.page <= 1}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          이전
        </button>
        {Array.from({ length: Math.min(10, pagination.pages) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              onClick={() => router.push(`/?page=${p}`)}
              className={`px-3 py-1 rounded ${
                p === pagination.page
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => router.push(`/?page=${pagination.page + 1}`)}
          disabled={pagination.page >= pagination.pages}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
        >
          다음
        </button>
      </nav>

      <FooterText />
    </main>
  );
}