'use client';

import Link from 'next/link';

interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
  category: string;
}

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  return (
    <Link href={`/video/${video.id}`} className="block border rounded-lg overflow-hidden shadow hover:shadow-lg transition">
      <img
        src={video.thumbnailUrl}
        alt={video.title}
        className="w-full h-44 object-cover"
      />
      <div className="p-4">
        <h3 className="font-medium truncate">{video.title}</h3>
        <p className="text-sm text-gray-500">{video.category}</p>
      </div>
    </Link>
  );
}