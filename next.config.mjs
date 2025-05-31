/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['yapl.tv'],
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://172.26.248.221:3000',
  ],

  webpack(config, { isServer }) {
    // 서버 번들에는 건드리지 않고,
    // 클라이언트(브라우저) 번들에만 빈 모듈 처리
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

export default nextConfig;