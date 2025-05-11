'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;       // .m3u8 URL 혹은 mp4 URL
  poster?: string;
  width?: number;
  height?: number;
}

export default function VideoPlayer({
  src,
  poster,
  width = 640,
  height = 360,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // HLS 스트림인 경우 Hls.js로 처리
    if (src.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    // mp4 등 일반 파일인 경우 직접 src 설정
    video.src = src;
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      width={width}
      height={height}
      controls
      style={{ maxWidth: '100%', backgroundColor: 'black' }}
    >
      이 브라우저는 video 태그를 지원하지 않습니다.
    </video>
  );
}