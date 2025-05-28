'use client';

import Link from 'next/link';
import React, { useRef } from 'react';

interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
}

export default function VideoCard({ video }: { video: Video }) {
  const ref = useRef<HTMLVideoElement>(null);

  return (
    <Link
      href={`/video/${video.id}`}
      className="group block border border-gray-200 rounded-lg overflow-hidden"
    >
      <div className="relative w-full aspect-video">
        <video
          ref={ref}
          src={`/api/stream/${video.id}`}
          poster={video.thumbnailUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          onMouseOver={() => void ref.current?.play()}
          onMouseOut={() => {
            if (ref.current) {
              ref.current.pause();
              ref.current.currentTime = 0;
              ref.current.load();
            }
          }}
        />
      </div>
      <div className="p-1.5 bg-white">
        <p className="text-sm font-medium text-gray-900 truncate">
          {video.title}
        </p>
      </div>
    </Link>
  );
}