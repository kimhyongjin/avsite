import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/prisma'
import puppeteer        from 'puppeteer'

export const runtime = 'edge'      // 또는 'nodejs', 필요에 따라
export const dynamic = 'force-dynamic'

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const rawId = await params.id
  const id    = parseInt(rawId, 10)
  if (isNaN(id)) {
    return new NextResponse('잘못된 ID입니다.', { status: 400 })
  }

  const record = await prisma.video.findUnique({ where: { id } })
  if (!record) {
    return new NextResponse('영상이 없습니다.', { status: 404 })
  }

  // Puppeteer 로 detailPageUrl 다시 크롤링 → 새 URL 얻기
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page    = await browser.newPage()
  await page.goto(record.detailPageUrl!, { waitUntil: 'networkidle0' })
  const newUrl  = await page.$eval(
    'source[type="video/mp4"], source[type="application/x-mpegURL"]',
    (el: any) => el.src
  )
  await browser.close()

  // DB 업데이트
  await prisma.video.update({
    where: { id },
    data: { videoUrl: newUrl },
  })

  return NextResponse.json({ url: newUrl })
}