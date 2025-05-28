import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// 간단한 in-memory 캐시 (optional)
const videoCache = new Map<number, { url: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const vid = Number(id);
  console.log(`🔸 Stream request for video ID: ${vid}`);
  if (isNaN(vid)) {
    console.error('Invalid video ID:', id);
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  // 1) DB에서 videoUrl + detailPageUrl 가져오기
  const rec = await prisma.video.findUnique({
    where: { id: vid },
    select: { videoUrl: true, detailPageUrl: true },
  });
  if (!rec) {
    console.error('Video not found in DB:', vid);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let videoUrl = rec.videoUrl;
  const detailPageUrl = rec.detailPageUrl!;
  console.log('• Original URL from DB:', videoUrl);

  // 2) xhcdn의 단기 만료 URL 처리 (캐시 & detail-page fallback)
  const now = Date.now();
  const cached = videoCache.get(vid);
  if (cached && cached.expires > now) {
    videoUrl = cached.url;
    console.log('• Using cached URL');
  } else {
    const host0 = new URL(videoUrl).host.toLowerCase();
    if (host0.endsWith('xhcdn.com')) {
      try {
        const { data: html } = await axios.get(detailPageUrl, {
          headers: { Referer: detailPageUrl },
        });
        const picks =
          html.match(/https?:\/\/[^\s'"]+\d+p\.h264\.mp4/gi) ||
          html.match(/https?:\/\/[^\s'"]+\.mp4/gi) ||
          [];
        if (!picks.length) {
          console.error('MP4 URL not found in fallback HTML');
          return NextResponse.json({ error: 'MP4 URL not found' }, { status: 404 });
        }
        videoUrl = picks[0];
        console.log('• Fallback URL from detail page:', videoUrl);
        videoCache.set(vid, { url: videoUrl, expires: now + CACHE_TTL });
      } catch (e) {
        console.error('Error fetching detail page for xhcdn fallback:', e);
        return NextResponse.json({ error: 'Detail fetch failed' }, { status: 502 });
      }
    }
  }

  // 3) 공통 upstream 헤더
  const range = req.headers.get('range') ?? undefined;
  const upstreamHeaders: Record<string, string> = {
    Referer: detailPageUrl,
    Origin: 'https://yapl.tv',
    'User-Agent': req.headers.get('user-agent') || '',
    ...(range ? { Range: range } : {}),
  };

  // 4) fetch upstream
  let upstream: Response;
  const host = new URL(videoUrl).host.toLowerCase();
  if (host.endsWith('xhcdn.com')) {
    console.log('→ Fetching from xhcdn with headers:', upstreamHeaders);
    upstream = await fetch(videoUrl, { headers: upstreamHeaders });
  } else if (host.includes('s3.amazonaws.com') || host.includes('.s3.')) {
    // AWS S3 signed URL logic
    const urlObj = new URL(videoUrl);
    const bucket = urlObj.host.split('.')[0];
    const rawKey = urlObj.pathname.slice(1);
    const [encFolder, encFile] = rawKey.split('/', 2);
    const key = `${decodeURIComponent(encFolder)}/${encFile}`;
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key, Range: range });
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    console.log('→ Fetching from S3 signed URL');
    upstream = await fetch(signedUrl, {
      headers: range ? { Range: range } : {},
    });
  } else {
    console.log('→ Fetching from other host with headers:', upstreamHeaders);
    upstream = await fetch(videoUrl, { headers: upstreamHeaders });
  }

  // 5) upstream 에러 체크
  if (!upstream.ok) {
    console.error(`Upstream error ${upstream.status} for ${videoUrl}`);
    return NextResponse.json(
      { error: `Upstream error: ${upstream.status}` },
      { status: upstream.status }
    );
  }
  console.log(`✨ Upstream responded OK (${upstream.status})`);

  // 6) 스트림 응답
  const resHeaders = new Headers();
  resHeaders.set('Content-Type', 'video/mp4');
  resHeaders.set('Accept-Ranges', 'bytes');
  resHeaders.set('Access-Control-Allow-Origin', '*');

  const contentRange = upstream.headers.get('content-range');
  const contentLength = upstream.headers.get('content-length');
  if (contentRange) {
    resHeaders.set('Content-Range', contentRange);
    if (contentLength) resHeaders.set('Content-Length', contentLength);
    return new NextResponse(upstream.body, { status: 206, headers: resHeaders });
  }
  if (contentLength) {
    resHeaders.set('Content-Length', contentLength);
  }
  return new NextResponse(upstream.body, { status: contentRange ? 206 : 200, headers: resHeaders });
}