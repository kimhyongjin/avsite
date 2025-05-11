import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import { PrismaClient } from '@prisma/client';

puppeteer.use(StealthPlugin());
const prisma = new PrismaClient();

// Puppeteer로 HTML만 가져오는 유틸 함수
async function fetchHtml(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });
  const html = await page.content();
  await browser.close();
  return html;
}

async function main() {
  // 모든 레코드 조회
  const records = await prisma.video.findMany();

  for (const rec of records) {
    const originalUrl = rec.videoUrl ?? '';

    // detail 페이지 패턴이 아닌 URL은 스킵
    if (!originalUrl.includes('/li_h_view.aspx')) {
      console.log(`⏭️ [${rec.id}] detail 페이지 아님, 건너뜀`);
      continue;
    }

    console.log(`🔄 [${rec.id}] 처리 중: ${originalUrl}`);

    let realUrl = '';
    try {
      const html = await fetchHtml(originalUrl);
      const $ = load(html);
      // 실제 비디오 소스(보통 <video><source src="..."></video>)
      realUrl = $('video source').attr('src') || $('video').attr('src') || '';
    } catch (err: any) {
      console.error(`❌ [${rec.id}] fetchHtml 오류:`, err.message);
      continue;
    }

    if (!realUrl) {
      console.warn(`⚠️ [${rec.id}] 실제 MP4 URL 추출 실패`);
      continue;
    }

    await prisma.video.update({
      where: { id: rec.id },
      data: { videoUrl: realUrl }
    });
    console.log(`✅ 업데이트됨: [${rec.id}] ${realUrl}`);
  }

  await prisma.$disconnect();
  console.log('🎉 모든 URL 업데이트 완료');
}

main();