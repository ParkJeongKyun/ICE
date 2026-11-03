import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 날짜 변환 결과가 실행하는 PC의 시간대에 따라 달라지지 않도록 고정
process.env.TZ = 'UTC';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // tsconfig의 jsx: preserve는 Next.js용이므로 테스트에서는 직접 변환
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
