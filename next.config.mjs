/** @type {import('next').NextConfig} */
export default {
  images: {
    domains: ['yapl.tv'],  // 기존 이미지 도메인 유지
  },
  // 개발 모드에서 cross-origin 요청 허용
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://172.26.248.221:3000',
  ],

  // 브라우저 번들에서 Node 내장 모듈 제거
  webpack(config, { isServer }) {
    console.log('🔧 next.config.js webpack override loaded — isServer:', isServer);
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        net: false,
        tls: false,
        fs: false,
        child_process: false,
      };
    }
    return config;
  },
};