import { defineConfig, devices } from '@playwright/test';

/**
 * E2E / 화면(스크린샷) 테스트
 *
 * - 기본: 배포와 같은 정적 빌드를 .next-e2e에 만들어 테스트
 * - E2E_BASE_URL 지정 시: 이미 떠 있는 서버(예: npm run dev)를 그대로 사용
 */
const PORT = 4173;
const E2E_DIST_DIR = '.next-e2e';
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      // Next.js 개발 모드 표시 등 화면과 무관한 요소 숨김
      stylePath: 'tests/e2e/screenshot.css',
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'e2e',
      grepInvert: /@visual/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 폰트 렌더링이 OS마다 달라 기준 이미지는 OS별로 저장됨 (*-darwin.png 등)
      name: 'visual-desktop',
      grep: /@visual/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'visual-mobile',
      grep: /@visual/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        // dev 서버(.next)와 겹치지 않도록 별도 폴더에 빌드
        // (distDir을 바꾸면 정적 export 결과도 out 대신 그 폴더에 생성됨)
        command: `NEXT_DIST_DIR=${E2E_DIST_DIR} npm run build && npx serve ${E2E_DIST_DIR} -l ${PORT} --no-clipboard`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
