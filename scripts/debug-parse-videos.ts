import fs from 'fs';
import { load } from 'cheerio';

const html = fs.readFileSync('debug-korean.html', 'utf8');
const $ = load(html);

console.log('=== 비디오 항목 파싱 결과 ===');
$('div.hItem.v-list.frame-block.thumb-block').each((_, el) => {
  const videoUrl = $(el).attr('data-video');
  const pageLink = $(el).find('a').first().attr('href');
  const thumbSrc = $(el).find('img').attr('src');
  const title = $(el).find('p.title a').last().text().trim();
  console.log(`- 제목: ${title}`);
  console.log(`  페이지: ${pageLink}`);
  console.log(`  썸네일: ${thumbSrc}`);
  console.log(`  비디오 URL: ${videoUrl}`);
  console.log('-----------------------------');
});