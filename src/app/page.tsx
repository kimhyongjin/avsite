'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoCard from '@/components/VideoCard';

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
  const page = parseInt(search.get('page') || '1', 10);

  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch(`/api/videos?page=${page}&limit=12`)
      .then((res) => res.json())
      .then((json: ApiResponse) => setData(json))
      .catch(console.error);
  }, [page]);

  if (!data) {
    return <p className="p-6">로딩 중…</p>;
  }

  const { videos, pagination } = data;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AV 콘텐츠</h1>

      {videos.length === 0 ? (
        <p className="text-center text-gray-500">등록된 영상이 없습니다.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>

          <nav className="flex justify-center items-center space-x-4">
            <button
              onClick={() => router.push(`/?page=${pagination.page - 1}`)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-gray-700">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => router.push(`/?page=${pagination.page + 1}`)}
              disabled={pagination.page >= pagination.pages}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </>
      )}
    </main>
);
}