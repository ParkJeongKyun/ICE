const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/locales/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 배포 모드 유지

  // E2E 테스트 빌드가 실행 중인 dev 서버의 .next와 겹치지 않도록 분리 가능
  distDir: process.env.NEXT_DIST_DIR || '.next',

  images: {
    unoptimized: true, // GitHub Pages는 이미지 최적화 서버가 없으므로 필수
  },

  basePath: '',

  compiler: {
    styledComponents: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

module.exports = withNextIntl(nextConfig);
