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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const vid = Number(id);
  if (isNaN(vid)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  // 1) DB에서 detailPageUrl + videoUrl 가져오기
  const rec = await prisma.video.findUnique({
    where: { id: vid },
    select: { videoUrl: true, detailPageUrl: true },
  });
  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let { videoUrl } = rec;
  const range = req.headers.get('range') ?? undefined;
  const host = new URL(videoUrl).host;

  // 2) xhcdn.com URL은 유효기간이 짧으니 detailPageUrl로 재추출
  if (host.endsWith('xhcdn.com')) {
    try {
      const { data: html } = await axios.get(rec.detailPageUrl, {
        headers: { Referer: 'https://yapl.tv' }
      });
      // 정규식으로 최신 MP4 링크 뽑기 (해상도 우선)
      const picks = html.match(/https?:\/\/[^\s'"]+\d+p\.h264\.mp4/gi)
                 || html.match(/https?:\/\/[^\s'"]+\.mp4/gi)
                 || [];
      if (picks.length === 0) {
        return NextResponse.json({ error: 'MP4 URL not found' }, { status: 404 });
      }
      videoUrl = picks[0];
    } catch (e: any) {
      return NextResponse.json({ error: 'Detail fetch failed' }, { status: 502 });
    }
  }

  let upstream: Response;
  // 3) 이제 videoUrl에 올바른 key–end 파라 포함된 최신 URL
  if (new URL(videoUrl).host.endsWith('xhcdn.com')) {
    upstream = await fetch(videoUrl, {
      headers: {
        Referer: 'https://yapl.tv',
        ...(range ? { Range: range } : {}),
      },
    });
  } else {
    // 기존 S3 프록시 로직
    const url = new URL(videoUrl);
    const bucket = url.host.split('.')[0];
    const rawKey = url.pathname.slice(1);
    const [encFolder, encFile] = rawKey.split('/', 2);
    const folder = decodeURIComponent(encFolder);
    const key = `${folder}/${encFile}`;

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key, Range: range });
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    upstream = await fetch(signedUrl, {
      headers: range ? { Range: range } : {},
    });
  }

  // 4) upstream 에러 체크
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream error: ${upstream.status}` },
      { status: upstream.status }
    );
  }

  // 5) 스트림 응답
  const headers = new Headers();
  headers.set('Content-Type', 'video/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Allow-Origin', '*');
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) {
    headers.set('Content-Range', contentRange);
    headers.set('Content-Length', upstream.headers.get('content-length')!);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}