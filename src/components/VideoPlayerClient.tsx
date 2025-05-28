'use client'

interface VideoPlayerClientProps {
  src: string
  poster?: string
  width?: number
  height?: number
}

export default function VideoPlayerClient({
  src,
  poster,
  width = 640,
  height = 360,
}: VideoPlayerClientProps) {
  return (
    <video
      src={src}
      poster={poster}
      width={width}
      height={height}
      controls
      style={{ maxWidth: '100%', backgroundColor: 'black' }}
    >
      <p>이 브라우저는 video 태그를 지원하지 않습니다.</p>
    </video>
  )
}
