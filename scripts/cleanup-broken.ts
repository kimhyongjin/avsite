import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 깨진 동영상 정리 시작');
  const videos = await prisma.video.findMany({
    select: {
      id: true,
      videoUrl: true,
      title: true,
      detailPageUrl: true,    // ← 이 필드 추가
    }
  });

  for (const { id, videoUrl, detailPageUrl, title } of videos) {
    try {
      // ── Range+Referer 요청으로 1KB까지 가져오기 ──
      const resp = await axios.get(videoUrl, {
        headers: {
          Range: 'bytes=0-1023',
          Referer: detailPageUrl,      // ← Referer 추가
        },
        timeout: 5000,
        responseType: 'arraybuffer',
        validateStatus: status => status >= 200 && status < 300
      });
        // ── 여기에 시그니처 검사 추가 ──
  const signature = Buffer.from(resp.data).slice(4, 8).toString('utf8');
  if (signature !== 'ftyp') {
    // MP4 파일이 아니면 에러 내서 catch 블록으로
    throw new Error('not-mp4');
  }

      // 정상 → 아무 작업 안 함
    } catch (err: any) {
      const status = err.response?.status;
      // 오직 403 혹은 404인 경우에만 삭제
      if (status === 403 || status === 404) {
        console.log(`❌ 삭제 (status=${status}): id=${id} title="${title}"`);
        await prisma.video.delete({ where: { id } });
      } else {
        console.warn(`⚠️ 보류 (status=${status||'timeout'}): id=${id} title="${title}"`);
      }
    }
  }

  console.log('🎉 정리 완료');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());