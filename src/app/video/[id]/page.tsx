export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import VideoCard from '@/components/VideoCard';
import { prisma } from '@/lib/prisma';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: Props) {
  const { id } = await params;
  const videoId = parseInt(id, 10);

  // ── 2. 메인 비디오 조회 ──
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id:           true,
      title:        true,
      videoUrl:     true,
      thumbnailUrl: true,
      category:     true,
    },
  });
  if (!video) {
    return <p>영상이 존재하지 않습니다.</p>;
  }

  // ── 3. 추천 영상 10개 조회 ──
  const recommendedVideos = await prisma.video.findMany({
    where: {
      category: video.category,
      id:       { not: video.id },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id:           true,
      title:        true,
      thumbnailUrl: true,
      videoUrl:     true,
      category:     true,
    },
  });

  return (
    <main className="p-6 max-w-7xl mx-auto">
      {/* 비디오 타이틀 */}
      <h1 className="text-2xl font-bold mb-4">{video.title}</h1>

      {/* 비디오 플레이어: API 스트림 라우트로 변경 */}
      <video
        src={`/api/stream/${videoId}`}
        poster={video.thumbnailUrl}
        controls
        autoPlay
        muted
        playsInline
        preload="metadata"
        className="block mx-auto mb-8 w-full max-w-4xl rounded-lg bg-black"
      />

      {/* ↓ 추천 영상 섹션 시작 ↓ */}
      <h2 className="text-2xl font-semibold mt-12 mb-4">추천 영상</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
        {recommendedVideos.map((rec) => (
          <VideoCard key={rec.id} video={rec} />
        ))}
      </div>
      {/* ↑ 추천 영상 섹션 끝 ↑ */}
    </main>
  );
}