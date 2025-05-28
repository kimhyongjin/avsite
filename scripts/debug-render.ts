import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npx tsx scripts/debug-render.ts <URL>');
    process.exit(1);
  }
  const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();
  fs.writeFileSync('debug-yapl.html', html);
  console.log('✅ debug-yapl.html 생성 완료');
  await browser.close();
})();