'use client';

import Link from 'next/link';

interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
}

interface Props {
  videos: Video[];
}

export default function VideoList({ videos }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      }}
    >
      {videos.map((video) => (
        <Link key={video.id} href={`/video/${video.id}`}>
          <div style={{ cursor: 'pointer' }}>
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              style={{ width: '100%', height: 'auto' }}
            />
            <p style={{ margin: '0.5rem 0' }}>{video.title}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
