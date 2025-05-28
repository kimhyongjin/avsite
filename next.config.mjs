/** @type {import('next').NextConfig} */
export default {
  images: {
    domains: ['yapl.tv'],  // 기존 이미지 도메인 설정 유지
  },

  // 개발 모드에서 cross-origin 요청 허용
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://172.26.248.221:3000',  // 로컬 네트워크 IP
  ],
};