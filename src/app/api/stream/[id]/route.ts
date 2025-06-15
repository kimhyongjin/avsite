import '@/lib/globalError';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

// AWS S3 client
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

// 동시 in-flight 요청 중복 제거용
const inFlight = new Map<string, Promise<Response>>();

// fetch에 재시도 + abort 지원
async function fetchWithRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal } = {},
  retries = 2
): Promise<Response> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err: any) {
      lastError = err;
      // 클라이언트가 중단한 경우 바로 던지기
      if (err.name === 'AbortError') throw err;
      console.error(`Fetch attempt ${attempt} failed for ${url}:`, err);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastError;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const vid = Number(id);
  console.log(`🔸 Stream request for video ID: ${vid}`);

  if (isNaN(vid)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  // 1) DB에서 videoUrl + detailPageUrl 가져오기
  const rec = await prisma.video.findUnique({
    where: { id: vid },
    select: { videoUrl: true, detailPageUrl: true },
  });
  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let videoUrl = rec.videoUrl;
  const detailPageUrl = rec.detailPageUrl!;
  console.log('• Original URL from DB:', videoUrl);

  // 2) xhcdn 단기 만료 URL 처리 (캐시 + fallback)
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
          return NextResponse.json(
            { error: 'MP4 URL not found' },
            { status: 404 }
          );
        }
        videoUrl = picks[0];
        console.log('• Fallback URL from detail page:', videoUrl);
        videoCache.set(vid, { url: videoUrl, expires: now + CACHE_TTL });
      } catch (e: any) {
        if (axios.isAxiosError(e) && e.response?.status === 500) {
          console.warn(
            '⚠️ xhcdn detail page returned 500; skipping fallback, using original URL'
          );
        } else {
          console.error('Error fetching detail page for xhcdn fallback:', e);
          return NextResponse.json(
            { error: 'Detail fetch failed' },
            { status: 502 }
          );
        }
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

  // 4) fetch upstream (+ in-flight dedupe + retry + abort)
  const cacheKey = `${videoUrl}|${range ?? ''}`;
  let upstream: Response;
  if (inFlight.has(cacheKey)) {
    upstream = await inFlight.get(cacheKey)!;
  } else {
    const p = (async () => {
      try {
        const host = new URL(videoUrl).host.toLowerCase();
        if (host.endsWith('xhcdn.com')) {
          console.log('→ Fetching from xhcdn with headers:', upstreamHeaders);
          return await fetchWithRetry(videoUrl, {
            headers: upstreamHeaders,
            signal: req.signal,
          });
        } else if (
          host.includes('s3.amazonaws.com') ||
          host.includes('.s3.')
        ) {
          // S3 signed URL
          const urlObj = new URL(videoUrl);
          const bucket = urlObj.host.split('.')[0];
          const rawKey = urlObj.pathname.slice(1);
          const [encFolder, encFile] = rawKey.split('/', 2);
          const key = `${decodeURIComponent(encFolder)}/${encFile}`;
          const cmd = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: range,
          });
          const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
          console.log('→ Fetching from S3 signed URL');
          return await fetchWithRetry(signedUrl, {
            headers: range ? { Range: range } : {},
            signal: req.signal,
          });
        } else {
          console.log('→ Fetching from other host with headers:', upstreamHeaders);
          return await fetchWithRetry(videoUrl, {
            headers: upstreamHeaders,
            signal: req.signal,
          });
        }
      } finally {
        inFlight.delete(cacheKey);
      }
    })();
    inFlight.set(cacheKey, p);
    upstream = await p;
  }

  // 5) upstream 상태 체크
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream error: ${upstream.status}` },
      { status: upstream.status }
    );
  }
  console.log(`✨ Upstream responded OK (${upstream.status})`);

  // 6) 스트림 응답
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
  });
  const contentRange = upstream.headers.get('content-range');
  const contentLength = upstream.headers.get('content-length');
  if (contentRange) {
    headers.set('Content-Range', contentRange);
    if (contentLength) headers.set('Content-Length', contentLength);
  } else if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return new NextResponse(upstream.body, {
    status: contentRange ? 206 : 200,
    headers,
  });
}