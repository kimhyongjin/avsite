import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new Response('url query parameter is required', { status: 400 });
  }

  try {
    // upstream 에 GET 요청
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        referer: 'https://bestyadong.net/',
      },
    });

    if (upstream.status === 410) {
      return new Response('Gone', { status: 410 });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch (e) {
    console.error('proxy fetch error:', e);
    return new Response('Bad Gateway', { status: 502 });
  }
}
