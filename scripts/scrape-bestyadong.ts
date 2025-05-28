import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import puppeteer, { HTTPRequest, HTTPResponse } from 'puppeteer';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

// ── 환경 및 클라이언트 세팅 ───────────────────────────
const prisma = new PrismaClient();
const BASE_URL = 'https://bestyadong.net';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const s3Client = new S3Client({ region: process.env.AWS_REGION });
async function uploadStreamToS3(
  stream: Readable,
  key: string,
  contentLength: number,
  contentType: string
) {
  const uploader = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentLength: contentLength,
    },
    leavePartsOnError: false,
  });
  await uploader.done();
}

const cookiesPath = resolve(__dirname, 'cookies.json');
const cookies = fs.existsSync(cookiesPath)
  ? JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'))
  : [];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 크롤링 설정 ───────────────────────────────────────
const categories = [
  { name: '한국야동', path: '/한국야동' },
  { name: '일본야동', path: '/일본야동' },
  { name: '서양야동', path: '/서양야동' },
  { name: '애니야동', path: '/애니야동' },
];
const MAX_PAGES = 40;       // 최대 몇 페이지까지 순회할지
const PAGE_DELAY_MS = 1000; // 페이지 간 대기(ms)

async function main() {
  console.log('▶ Starting scraping...');

  // 1) DB에서 이미 처리된 detailPageUrl 집합을 가져옴
  const existing = new Set<string>();
  const all = await prisma.video.findMany({ select: { detailPageUrl: true } });
  all.forEach((v) => existing.add(v.detailPageUrl));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  if (cookies.length) {
    await page.setCookie(...(cookies as any[]));
    console.log(`• Loaded ${cookies.length} cookies.`);
  }

  // 2) 카테고리별, 페이지별 순회
  for (const { name, path: catPath } of categories) {
    console.log(`\n▶ Crawling category: [${name}]`);
    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      const listUrl =
        pageNum === 1
          ? `${BASE_URL}${encodeURI(catPath)}`
          : `${BASE_URL}${encodeURI(catPath)}?page=${pageNum}`;

      console.log(`\n📂 [${name}] Page ${pageNum} → ${listUrl}`);
      let listHtml: string;
      try {
        listHtml = (await axios.get(listUrl)).data;
      } catch (e: any) {
        console.error(`🔥 Failed to fetch page ${pageNum}:`, e.message);
        break;
      }

      const $ = cheerio.load(listHtml);
      const anchors = $('#vList > div.v-list > div.v-inside > div.lim > a').get();
      console.log(`🔍 Found ${anchors.length} items on page ${pageNum}`);
      if (anchors.length === 0) {
        console.log(`⚠️ No more videos in [${name}] after page ${pageNum - 1}`);
        break;
      }

      let newCountOnPage = 0;
      for (let i = 0; i < anchors.length; i++) {
        const el = anchors[i];
        const href = $(el).attr('href') || '';
        const detailUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        if (existing.has(detailUrl)) {
          // 이미 DB에 있으면 건너뛰기
          continue;
        }

        // 새로운 영상
        newCountOnPage++;
        const thumb = $(el).find('img').attr('src') || '';
        const title = $(el).find('img').attr('alt')?.trim() || '(No title)';
        const thumbnailUrl = thumb.startsWith('http') ? thumb : `${BASE_URL}${thumb}`;

        console.log(`\n[${name}] (${i + 1}/${anchors.length}) ${title}`);
        console.log(` • Detail page: ${detailUrl}`);

        // ─ Request interception for sniffing video URLs ─
        const candidates = new Set<string>();
        let interception = true;
        try {
          await page.setRequestInterception(true);
        } catch {
          interception = false;
        }
        if (interception) {
          page.on('request', (req: HTTPRequest) => {
            const u = req.url();
            if (/\.(mp4|m3u8|ts)(\?|$)/i.test(u)) candidates.add(u);
            try { req.continue(); } catch {}
          });
          page.on('response', (res: HTTPResponse) => {
            const u = res.url();
            if (/\.(mp4|m3u8|ts)(\?|$)/i.test(u)) candidates.add(u);
          });
        }

        // ─ Navigate ─
        try {
          await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch {
          console.warn(`   ⏱️ Navigation timeout for ${title}, skipping this video.`);
          if (interception) {
            page.removeAllListeners('request');
            page.removeAllListeners('response');
          }
          continue;
        }

        // ─ Extract video URL ─
        let videoUrl: string | null = null;
        try {
          await page.waitForSelector('source[type="application/x-mpegURL"]', { timeout: 2000 });
          videoUrl = await page.$eval(
            'source[type="application/x-mpegURL"]',
            (el) => (el as HTMLSourceElement).src
          );
        } catch {}
        if (!videoUrl) {
          try {
            await page.waitForSelector('source[type="video/mp4"]', { timeout: 3000 });
            videoUrl = await page.$eval(
              'source[type="video/mp4"]',
              (el) => (el as HTMLSourceElement).src
            );
          } catch {}
        }
        if (!videoUrl) {
          try {
            await page.click('button.play, .v-play, .player-play-button');
            await delay(1000);
          } catch {}
          for (const u of candidates) {
            if (/\.(mp4)(\?|$)/i.test(u)) {
              videoUrl = u;
              break;
            }
          }
        }
        if (interception) {
          page.removeAllListeners('request');
          page.removeAllListeners('response');
          try { await page.setRequestInterception(false); } catch {}
        }
        if (!videoUrl) {
          console.warn('   ⚠ No video URL, skip.');
          continue;
        }
        console.log(`   🎬 Final URL: ${videoUrl}`);
        console.log(`▶ Original scraped URL: ${videoUrl}`);

        // ─ only MP4 ─
        if (!/\.(mp4)(\?|$)/i.test(videoUrl)) {
          console.warn('   ⚠ Not MP4, skipping upload.');
          continue;
        }

        // ─ download & upload ─
        let storedUrl = videoUrl;
        try {
          const resp = await axios.get(videoUrl, {
            responseType: 'stream',
            headers: { Referer: encodeURI(detailUrl) },
          });
          const length = parseInt(resp.headers['content-length'] || '0', 10);
          const type   = resp.headers['content-type'] || 'application/octet-stream';
          const filename = encodeURIComponent(title) + '.mp4';
          const key      = `${name}/${filename}`;
          await uploadStreamToS3(resp.data as Readable, key, length, type);
          storedUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
          console.log(`   ✅ Uploaded MP4 to S3: ${storedUrl}`);
        } catch (e: any) {
          console.error('   ❌ S3 upload failed:', e.message);
        }

        // ─ DB upsert ─
        try {
          await prisma.video.upsert({
            where: { videoUrl: storedUrl },
            update: { thumbnailUrl, detailPageUrl: detailUrl, isLive: true },
            create: {
              title,
              category: name,
              videoUrl: storedUrl,
              thumbnailUrl,
              detailPageUrl: detailUrl,
              isLive: true,
            },
          });
          console.log(`   🔄 Upserted: ${title}`);
          existing.add(detailUrl);
        } catch (e: any) {
          console.error(`   ❌ DB error (${title}):`, e.message);
        }
      } // end anchors loop

      // ■ 페이지 내 신규 영상이 없으면 종료
      if (newCountOnPage === 0) {
        console.log(`⚠️ No new videos on page ${pageNum}, moving to next category.`);
        break;
      }
      await delay(PAGE_DELAY_MS);
    } // end page loop
  } // end categories

  await browser.close();
  await prisma.$disconnect();
  console.log('\n🎉 Completed.');
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});