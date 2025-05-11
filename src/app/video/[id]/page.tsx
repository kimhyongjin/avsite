import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import VideoPlayerClient from '@/components/VideoPlayerClient'

interface Props {
  // Next.js 15+: params는 Promise로 감싸져 전달됩니다
  params: Promise<{ id: string }>
}

export default async function VideoPage({ params }: Props) {
  // ① params를 await 해서 풀어냅니다
  const { id: idStr } = await params
  const videoId = Number(idStr)
  if (isNaN(videoId)) {
    return notFound()
  }

  // ② 비디오 메타데이터 조회
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      title: true,
      thumbnailUrl: true,
    },
  })
  if (!video) {
    return notFound()
  }

  // ③ VideoPlayerClient에 스트림 API 경로를 전달
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
      <VideoPlayerClient
        src={`/api/stream/${videoId}`}
        poster={video.thumbnailUrl}
        width={800}
        height={450}
      />
    </main>
  )
}