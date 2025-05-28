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

function buildListUrl(cat: Category, pageNum: number) {
  if (cat.path.includes('red_video_list')) {
    const sep = cat.path.includes('?') ? '&' : '?';
    return `${BASE}${cat.path}${sep}page=${pageNum}`;
  } else {
    return `${BASE}${cat.path}/${pageNum}`;
  }
}

async function getCategories(browser: Browser): Promise<Category[]> {
  const page: Page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 0 });
  const html = await page.content();
  await page.close();

  const $ = load(html);

  // H-야동 목록
  const redCats = $('nav[aria-label="primary"] .locale-div a')
    .map((_, el) => {
      const name = $(el).text().trim();
      const raw = ($(el).attr('href') || '').split('&page=')[0];
      return { name, path: raw };
    })
    .get()
    .filter(c => c.path.includes('red_video_list'));

  // X-야동만 (쇼츠야동 제외)
  const xCats = $('.head__menu-line__main-menu__lvl1')
    .map((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      const raw = href.startsWith(BASE) ? href.slice(BASE.length) : href;
      return { name, path: raw.split('&page=')[0] };
    })
    .get()
    .filter(c => c.name === 'X야동');

  return [...redCats, ...xCats];
}

async function scrapeCategory(
  browser: Browser,
  cat: Category,
  fromPage: number = 1
) {
  console.log(`\n▶️ 카테고리: ${cat.name}`);

  // ── 총 페이지 수 계산 ──
  let maxPage = 1;
  {
    const firstUrl = buildListUrl(cat, 1);
    const p = await browser.newPage();
    await p.goto(firstUrl, { waitUntil: 'networkidle2', timeout: 0 });
    const html = await p.content();
    await p.close();

    const $firstPage = load(html);
    if (cat.path.includes('red_video_list')) {
      const pageNums = $firstPage('a[href*="red_video_list"][href*="page="]')
        .map((_, el) => {
          const href = $firstPage(el).attr('href') || '';
          const m = href.match(/[?&]page=(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        })
        .get()
        .filter((n): n is number => n !== null);
      maxPage = pageNums.length ? Math.max(...pageNums) : 1;
    } else {
      maxPage = Infinity;
    }
    console.log(`    ℹ️ 총 페이지(${cat.name}): ${maxPage}`);
  }

  // ── 상세 페이지용 탭 (이미지/스타일시트 차단) ──
  const detailPage = await browser.newPage();
  await detailPage.setRequestInterception(true);
  detailPage.on('request', req => {
    const t = req.resourceType();
    if (['image', 'stylesheet', 'font'].includes(t)) req.abort();
    else req.continue();
  });

  let emptyStreak = 0;

  for (let pageNum = fromPage; pageNum <= maxPage; pageNum++) {
    const listUrl = buildListUrl(cat, pageNum);
    console.log(`📂 [${cat.name} P${pageNum}] ${listUrl}`);

    let listHtml: string;
    try {
      const listPage = await browser.newPage();
      await Promise.race([
        listPage.goto(listUrl, { waitUntil: 'networkidle2', timeout: 0 }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('페이지 로드 타임아웃')), 5000)
        ),
      ]);
      listHtml = await listPage.content();
      await listPage.close();
      emptyStreak = 0;
    } catch (err: any) {
      console.warn(`⚠️ P${pageNum} 처리 실패:`, err.message);
      emptyStreak++;
      if (emptyStreak >= 3) {
        console.warn(`   ⚠️ 3회 연속 실패, 계속 진행: ${cat.name}`);
        emptyStreak = 0;
      }
      continue;
    }

    // ── 아이템 추출 ──
    const $ = load(listHtml);
    let anchors = $('div.lim > a');
    if (!anchors.length) anchors = $('div.hItem.v-list.frame-block.thumb-block > a');

    const items = anchors
      .map((_, el) => {
        const a = $(el);
        const c = a.closest('div.hItem.v-list.frame-block.thumb-block');
        return {
          title:
            c.find('.v-under p.title a').last().text().trim() ||
            a.find('img').attr('alt') ||
            '',
          detail: new URL(a.attr('href') || '', BASE).href,
          thumb: a.find('img').attr('src') || '',
          videoCategory:
            new URL(a.attr('href') || '', BASE).searchParams.get('vString') ||
            cat.name,
          listVideoUrl: c.attr('data-video') || null,
        };
      })
      .get();

    if (!items.length) {
      console.warn(`   ⚠️ 아이템 없음 P${pageNum}`);
      continue;
    }

    // ── 각 아이템 순회 ──
    for (const { title, detail, thumb, videoCategory } of items) {
      let videoUrl: string | null = null;
      try {
        await detailPage.goto(detail, { waitUntil: 'domcontentloaded', timeout: 0 });
        await detailPage.waitForSelector('video', { timeout: 5000 });
        videoUrl = await detailPage.evaluate(() => {
          const v = document.querySelector<HTMLVideoElement>('video');
          return v?.currentSrc || v?.src || null;
        });
        // blob: 처리
        if (videoUrl?.startsWith('blob:')) {
          const real = await detailPage.evaluate(() => {
            const v = document.querySelector<HTMLVideoElement>('video');
            return (
              v?.querySelector<HTMLSourceElement>('source')?.src ||
              null
            );
          });
          if (real) videoUrl = real;
        }
      } catch {
        console.warn(`❌ Puppeteer 실패: ${title}`);
      }

      if (!videoUrl) {
        console.warn(`❌ MP4 못 찾음: ${title}`);
        continue;
      }

      // ── 재생 불가(403,404,500) 필터링 ──
      try {
        const h = await axios.head(videoUrl, {
          headers: { Referer: detail },
          timeout: 5000,
          validateStatus: () => true,
        });
        if ([403, 404, 500].includes(h.status)) {
          console.warn(`⚠️ 재생 불가 (status=${h.status}): ${videoUrl} (${title})`);
          continue;
        }
      } catch {
        console.warn(`⚠️ HEAD 오류: ${videoUrl} (${title})`);
        continue;
      }

      // ── DB 저장/업데이트 ──
      const ex = await prisma.video.findFirst({ where: { detailPageUrl: detail } });
      if (ex) {
        try {
          await prisma.video.update({
            where: { id: ex.id },
            data: { videoUrl },
          });
          console.log(`🔄 업데이트: ${title}`);
        } catch (e: any) {
          if (e.code !== 'P2002') throw e;
        }
      } else {
        try {
          await prisma.video.create({
            data: {
              title,
              detailPageUrl: detail,
              videoUrl,
              thumbnailUrl: thumb,
              category: videoCategory,
            },
          });
          console.log(`✅ 등록: ${title}`);
        } catch (e: any) {
          if (e.code !== 'P2002') throw e;
        }
      }
    }
  }

  await detailPage.close();
}

;(async () => {
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 재개용 환경변수
  const START_CAT = process.env.START_CAT || '';
  const START_PAGE = parseInt(process.env.START_PAGE || '1', 10);
  let skipping = START_CAT !== '';

  try {
    const cats = await getCategories(browser);
    const redCats = cats.filter(
      c => c.path.includes('red_video_list') && c.name !== 'H 최신야동'
    );
    const idx = redCats.findIndex(c => c.name === '한국야동');
    if (idx > -1) {
      const [korean] = redCats.splice(idx, 1);
      redCats.push(korean);
    }

    console.log('▶️ 전체 H-야동 카테고리 순회:', redCats.map(c => c.name));

    for (const cat of redCats) {
      let pageToStart = 1;
      if (skipping) {
        if (cat.name === START_CAT) {
          pageToStart = START_PAGE;
          skipping = false;
        } else {
          console.log(`🔹 스킵: ${cat.name}`);
          continue;
        }
      }
      await scrapeCategory(browser, cat, pageToStart);
    }
  } catch (err) {
    console.error('스크립트 오류:', err);
  } finally {
    await prisma.$disconnect();
    await browser.close();
    console.log('🎉 전체 수집 완료');
  }
})();
