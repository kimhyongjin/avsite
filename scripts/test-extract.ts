import axios from 'axios';
import { load } from 'cheerio';

async function run() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npx tsx scripts/test-extract.ts <DETAIL_PAGE_URL>');
    process.exit(1);
  }
  console.log('→ Fetching:', url);
  const { data: html } = await axios.get(url);
  // 1) 해상도 표시된 MP4
  const picks = html.match(/https?:\/\/[^\s'"]+\d+p\.h264\.mp4/gi) || [];
  if (picks.length) {
    console.log('🎯 Found MP4 links:\n', picks);
  } else {
    // 2) 일반 MP4
    const fallback = html.match(/https?:\/\/[^\s'"]+\.mp4/gi) || [];
    console.log('🎯 Fallback MP4 links:\n', fallback);
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});