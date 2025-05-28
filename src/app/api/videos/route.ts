import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category   = searchParams.get('category') || undefined;
  const searchTerm = searchParams.get('search')   || undefined;
  const page       = parseInt(searchParams.get('page')  || '1', 10);
  const limit      = parseInt(searchParams.get('limit') || '12', 10);

  // build where clause with category and search term
  const where: any = {};
  if (category) {
    where.category = category;
  }
  if (searchTerm) {
    where.title = { contains: searchTerm, mode: 'insensitive' };
  }

  // count total matching videos
  const total = await prisma.video.count({ where });

  // fetch videos with pagination
  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id:           true,
      title:        true,
      thumbnailUrl: true,
      category:     true,
    },
  });

  return NextResponse.json({
    videos,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
}