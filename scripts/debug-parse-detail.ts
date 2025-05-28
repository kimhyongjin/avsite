import fs from 'fs';
import { load } from 'cheerio';

// debug-render.ts로 저장된 상세 페이지 HTML 파일명
const html = fs.readFileSync('debug-yapl.html', 'utf8');
const $ = load(html);

// <video> 태그의 src 또는 <source> 태그의 src 추출
const videoSrc = $('video').attr('src')
  || $('video source').attr('src')
  || '';

console.log('🔍 추출된 비디오 URL →', videoSrc);