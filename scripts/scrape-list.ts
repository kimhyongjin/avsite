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
  path: string;  // should include the red_video_list base (without page=)
}

function buildListUrl(cat: Category, pageNum: number) {
  // For H/X both, path includes red_video_list… so we use ?page=
  const sep = cat.path.includes('?') ? '&' : '?';
  return `${BASE}${cat.path}${sep}page=${pageNum}`;
}

async function getCategories(): Promise<Category[]> {
  // — X-야동 서브카테고리: 수동 정의 (올바른 red_video_list 경로)
  return [
    { name: 'X 최신야동', path: '/red_video_list?catGubun=n&catString=최신야동&catUrl=hd/newest' },
    { name: '한국야동',   path: '/red_video_list?catGubun=m&catString=한국야동&catUrl=categories/korean/hd' },
    { name: '일본야동',   path: '/red_video_list?catGubun=m&catString=일본야동&catUrl=categories/japanese/hd' },
    { name: '중국야동',   path: '/red_video_list?catGubun=m&catString=중국야동&catUrl=categories/chinese/hd' },
    { name: '서양야동',   path: '/red_video_list?catGubun=m&catString=미국야동&catUrl=categories/american/hd' },
    { name: '애니야동',   path: '/red_video_list?catGubun=m&catString=애니야동&catUrl=categories/anime/hd' },
  ];
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
    await p.goto(encodeURI(firstUrl), { waitUntil: 'networkidle2', timeout: 0 });
    const html = await p.content();
    await p.close();

    const $firstPage = load(html);
    const pageNums = $firstPage('a[href*="page="]')
      .map((_, el) => {
        const href = $firstPage(el).attr('href') || '';
        const m = href.match(/[?&]page=(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      })
      .get()
      .filter((n): n is number => n !== null);
    maxPage = pageNums.length ? Math.max(...pageNums) : 1;
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
        listPage.goto(encodeURI(listUrl), { waitUntil: 'networkidle2', timeout: 0 }),
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
      if (emptyStreak >= 5) {
        console.warn(`   ⚠️ 5회 연속 실패, 카테고리 순회 종료: ${cat.name}`);
        break;
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
        };
      })
      .get();

    if (!items.length) {
      console.warn(`   ⚠️ 아이템 없음 P${pageNum}`);
      emptyStreak++;
      if (emptyStreak >= 5) {
        console.warn(`   ⚠️ 5회 연속 빈 페이지, 카테고리 순회 종료: ${cat.name}`);
        break;
      }
      continue;
    }
    emptyStreak = 0;

    // ── 각 아이템 순회 ──
    for (const { title, detail, thumb, videoCategory } of items) {
      let videoUrl: string | null = null;
      try {
        await detailPage.goto(encodeURI(detail), { waitUntil: 'domcontentloaded', timeout: 0 });
        await detailPage.waitForSelector('video', { timeout: 5000 });
        videoUrl = await detailPage.evaluate(() => {
          const v = document.querySelector<HTMLVideoElement>('video');
          return v?.currentSrc || v?.src || null;
        });
        if (videoUrl?.startsWith('blob:')) {
          const real = await detailPage.evaluate(() => {
            const v = document.querySelector<HTMLVideoElement>('video');
            return v?.querySelector<HTMLSourceElement>('source')?.src || null;
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

      // ── 재생 필터링 ──
      try {
        const h = await axios.head(videoUrl, {
          headers: { Referer: detail },
          timeout: 5000,
          validateStatus: () => true,
        });
        const status = h.status;
        const ctype = (h.headers['content-type'] || '').toLowerCase();

        // 1) 허용되지 않은 상태코드 스킵
        if (![200, 206].includes(status)) {
          console.warn(`⚠️ 불허용 상태코드 (status=${status}): ${videoUrl} (${title})`);
          continue;
        }
        // 2) video/* 또는 HLS(m3u8)도 허용
        if (!(ctype.startsWith('video/') || ctype.includes('mpegurl'))) {
          console.warn(`⚠️ 비지원 타입 (${ctype}): ${videoUrl} (${title})`);
          continue;
        }
        // 3) Partial Content(206) 응답 시 스트림 확인
        if (status === 206) {
          const r = await axios.get(videoUrl, {
            headers: { Range: 'bytes=0-1', Referer: detail },
            responseType: 'stream',
            timeout: 5000,
            validateStatus: () => true,
          });
          if (r.status !== 206) {
            console.warn(`⚠️ GET 테스트 실패 (status=${r.status}): ${videoUrl} (${title})`);
            continue;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ 재생 확인 오류: ${videoUrl} (${title})`, err.message);
        continue;
      }

      // ── DB 저장/업데이트 ──
      const ex = await prisma.video.findFirst({ where: { detailPageUrl: detail } });
      if (ex) {
        try {
          await prisma.video.update({ where: { id: ex.id }, data: { videoUrl } });
          console.log(`🔄 업데이트: ${title}`);
        } catch (e: any) {
          if (e.code !== 'P2002') throw e;
        }
      } else {
        try {
          await prisma.video.create({
            data: { title, detailPageUrl: detail, videoUrl, thumbnailUrl: thumb, category: videoCategory },
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

  try {
    const cats = await getCategories();
    console.log('▶️ 전체 X-야동 카테고리 순회:', cats.map(c => c.name));
    for (const cat of cats) {
      await scrapeCategory(browser, cat);
    }
  } catch (err) {
    console.error('스크립트 오류:', err);
  } finally {
    await prisma.$disconnect();
    await browser.close();
    console.log('🎉 전체 수집 완료');
  }
})();