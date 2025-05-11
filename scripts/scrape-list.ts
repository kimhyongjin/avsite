import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import { load } from 'cheerio';
import { PrismaClient } from '@prisma/client';
import type { Browser, Page } from 'puppeteer';

puppeteerExtra.use(StealthPlugin());
const prisma = new PrismaClient();
const BASE = 'https://yapl.tv';

interface Category {
  name: string;
  path: string;
}

async function getCategories(browser: Browser): Promise<Category[]> {
  const page: Page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 0 });
  const html = await page.content();
  await page.close();

  const $ = load(html);

  // 1) H야동(Red) 서브카테고리
  const redCats = $('nav[aria-label="primary"] .locale-div a')
    .map((_, el) => {
      const name = $(el).text().trim();
      const raw  = (($(el).attr('href') || '')).split('&page=')[0];
      return { name, path: raw };
    })
    .get()
    .filter(c => c.path.includes('red_video_list'));

  // 2) X야동 & 쇼츠야동 (헤더 메뉴)
  const xCats = $('.head__menu-line__main-menu__lvl1')
    .map((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      // 절대 URL인 경우 앞부분 떼기
      const raw  = href.startsWith(BASE) ? href.slice(BASE.length) : href;
      return { name, path: raw.split('&page=')[0] };
    })
    .get()
    .filter(c => c.name === 'X야동' || c.name === '쇼츠 야동');

  return [...redCats, ...xCats];
}

async function scrapeCategory(browser: Browser, cat: Category) {
  console.log(`\n▶️ 카테고리: ${cat.name}`);
  let pageNum = 1;

  while (true) {
    const sep     = cat.path.includes('?') ? '&' : '?';
    const listUrl = `${BASE}${cat.path}${sep}page=${pageNum}`;
    console.log(`📂 [${cat.name} P${pageNum}] ${listUrl}`);

    const listPage: Page = await browser.newPage();
    let listHtml: string;
    try {
      await listPage.goto(listUrl, { waitUntil: 'networkidle2', timeout: 0 });
      listHtml = await listPage.content();
    } catch (err: any) {
      console.warn(`⚠️ [${cat.name} P${pageNum}] 네비게이션 실패: ${err.message}`);
      await listPage.close();
      break;
    }
    await listPage.close();

    const $ = load(listHtml);
    let anchors = $('div.lim > a');
    if (anchors.length === 0) {
      anchors = $('div.hItem.v-list.frame-block.thumb-block > a');
    }

    const items = anchors
      .map((_, el) => {
        const anchor    = $(el);
        const container = anchor.closest('div.hItem.v-list.frame-block.thumb-block');
        const listVideoUrl = container.attr('data-video') || null;

        // 제목: .v-under p.title a 텍스트 또는 img.alt
        let title = container.find('.v-under p.title a').last().text().trim();
        if (!title) {
          title = anchor.find('img').attr('alt')?.trim() || '';
        }

        // 상세 페이지
        const rawHref = anchor.attr('href') || '';
        const detail  = rawHref.startsWith('http') ? rawHref : `${BASE}${rawHref}`;

        // 썸네일
        const thumb = anchor.find('img').attr('src') || '';

        // X야동 내부 카테고리(vString) 읽어서 분류
        const urlObj   = new URL(detail, BASE);
        let innerCat   = urlObj.searchParams.get('vString') || cat.name;
        if (innerCat === '중국야동') innerCat = '일본야동';

        return { title, detail, thumb, videoCategory: innerCat, listVideoUrl };
      })
      .get();

    if (items.length === 0) break;

    for (const { title, detail, thumb, videoCategory, listVideoUrl } of items) {
      // 중복 검사
      const exists = await prisma.video.findFirst({
        where: { detailPageUrl: detail }
      });
      if (exists) {
        console.log(`⚠️ 이미 처리됨: ${title}`);
        continue;
      }

      // 상세 페이지 HTML (fallback)
      let htmlDetail: string;
      try {
        htmlDetail = (await axios.get(detail)).data;
      } catch {
        console.warn(`❌ 상세 페이지 불러오기 실패: ${detail}`);
        continue;
      }

      // m3u8 제외, 오직 MP4만
      const picks = htmlDetail.match(/https?:\/\/[^\s'"]+\d+p\.h264\.mp4/gi) || [];
      const mp4s  = htmlDetail.match(/https?:\/\/[^\s'"]+\.mp4/gi)       || [];

      // 리스트에 있던 data-video 우선, 없으면 디테일 추출
      let videoUrl: string | null = listVideoUrl;
      if (!videoUrl) {
        videoUrl = picks[0] || mp4s[0] || null;
      }
      if (!videoUrl) {
        console.warn(`❌ MP4 못 찾음 (list & detail 모두): ${title}`);
        continue;
      }

      // HEAD 검사
      let ok = false;
      try {
        const head = await axios.head(videoUrl);
        ok = head.status >= 200 && head.status < 300;
      } catch {
        ok = false;
      }
      if (!ok) {
        console.warn(`⚠️ 404 또는 접근 불가: ${videoUrl}`);
        continue;
      }

      // DB 저장
      try {
        await prisma.video.create({
          data: {
            title,
            detailPageUrl: detail,
            videoUrl,
            thumbnailUrl: thumb,
            category: videoCategory,
          }
        });
        console.log(`✅ 등록됨: ${title}`);
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.warn(`⚠️ 중복 videoUrl, 건너뜀: ${videoUrl}`);
        } else {
          throw e;
        }
      }
    }

    pageNum++;
  }
}

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const cats = await getCategories(browser);
    console.log('🔍 카테고리:', cats.map(c => c.name).join(', '));
    for (const cat of cats) {
      await scrapeCategory(browser, cat);
    }
  } catch (err) {
    console.error('스크립트 오류:', err);
  } finally {
    await prisma.$disconnect();
    await browser.close();
    console.log('\n🎉 전체 수집 완료');
  }
})();