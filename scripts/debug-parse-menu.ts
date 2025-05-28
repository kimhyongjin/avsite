import fs from 'fs';
import { load } from 'cheerio';

const html = fs.readFileSync('debug-yapl.html', 'utf8');
const $ = load(html);

// 상단 H 최신야동 등 메뉴 추출
$('nav[aria-label="primary"] .locale-div a').each((_, el) => {
  const text = $(el).text().trim();
  const href = $(el).attr('href');
  console.log(text, '→', href);
});