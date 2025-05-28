import VideoCard from '@/components/VideoCard';
import SkeletonGrid from '@/components/SkeletonGrid';
import { use } from 'react';

// Next.js App Router 에서는 기본이 Server Component, 직접 fetch 해 올 수 있습니다
async function fetchVideos() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/videos`);
  if (!res.ok) throw new Error('Failed to fetch videos');
  return res.json() as Promise<{
    id: number;
    title: string;
    thumbnailUrl: string;
    createdAt: string;
  }[]>;
}

export default function VideosPage() {
  // React 18 use()로 Promise를 간단히 처리
  const videos = use(fetchVideos());

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">전체 영상</h1>
      {videos.length === 0 ? (
        <p className="text-center">등록된 영상이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
         {videos.map((v) => (
           <VideoCard
             key={v.id}
             video={v}
           />
         ))}
        </div>
      )}
    </div>
  );
}
