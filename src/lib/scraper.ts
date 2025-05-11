import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import dotenv from 'dotenv'
import puppeteer from 'puppeteer'

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local')
})

export async function scrapeVideoUrl(detailPageUrl: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  try {
    await page.goto(detailPageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // 1) MP4 태그 추출
    let url = await page
      .$eval('source[type="video/mp4"]', el => (el as HTMLSourceElement).src)
      .catch(() => '')

    // 2) HLS (m3u8) 태그 추출
    if (!url) {
      url = await page
        .$eval('source[type="application/x-mpegURL"]', el => (el as HTMLSourceElement).src)
        .catch(() => '')
    }

    // 3) video.currentSrc
    if (!url) {
      url = await page
        .$eval('video', el => (el as HTMLVideoElement).currentSrc || '')
        .catch(() => '')
    }

    if (!url) throw new Error('scraper: URL 추출 실패')
    return url
  } finally {
    await browser.close()
  }
}
