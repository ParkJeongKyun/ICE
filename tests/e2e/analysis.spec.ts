import { expect, test } from '@playwright/test';
import {
  EXIF_MAKE,
  EXIF_MODEL,
  FIXTURES,
  PNG_TEXT,
  closeTriggersLeavePrompt,
  holdRequests,
  openFile,
  presetConfig,
} from './helpers';
import messages from '../../src/locales/ko/messages/messages.json';

const IMAGE_ENGINE = /\/wasm\/ice_image_[^/]+\.wasm$/;
const CORE_ENGINE = /\/wasm\/ice_core_[^/]+\.wasm$/;

test.describe('파일 분석', () => {
  test('JPEG: 파일 정보와 EXIF 태그 표시', async ({ page }) => {
    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);

    await expect(page.getByText('image/jpeg')).toBeVisible();
    await expect(page.getByText(EXIF_MAKE)).toBeVisible();
    await expect(page.getByText(EXIF_MODEL)).toBeVisible();
  });

  test('PNG: 텍스트 청크 표시', async ({ page }) => {
    await page.goto('/ko');
    await openFile(page, FIXTURES.png);

    await expect(page.getByText('image/png')).toBeVisible();
    await expect(page.getByText(PNG_TEXT)).toBeVisible();
  });

  test('이미지 엔진을 끄면 엔진을 받지 않고 EXIF도 분석하지 않음', async ({
    page,
  }) => {
    await presetConfig(page, { engines: { image: { enabled: false } } });
    const imageRequests: string[] = [];
    page.on('request', (req) => {
      if (IMAGE_ENGINE.test(new URL(req.url()).pathname)) {
        imageRequests.push(req.url());
      }
    });

    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);

    await expect(page.getByText('image/jpeg')).toBeVisible();
    await expect(page.getByText(EXIF_MAKE)).toHaveCount(0);
    expect(imageRequests).toEqual([]);
  });
});

test.describe('엔진 로딩', () => {
  test('엔진을 받는 중에 연 파일도 엔진을 기다렸다가 분석', async ({
    page,
  }) => {
    // 파일을 연 뒤에야 이미지 엔진이 도착하는 상황
    // (엔진 로드가 UI를 잠그면 파일 열기 버튼이 활성화되지 않아 openFile에서 실패)
    const engine = holdRequests(page, IMAGE_ENGINE);

    await page.goto('/ko');
    await engine.requested;
    await openFile(page, FIXTURES.jpeg);
    // 분석은 엔진을 기다리는 중 (대기 한도 15초보다 충분히 짧게)
    await page.waitForTimeout(2000);
    await expect(page.getByText('image/jpeg')).toHaveCount(0);
    engine.release();

    await expect(page.getByText(EXIF_MAKE)).toBeVisible();
  });

  test('엔진이 너무 늦으면 엔진 없이 분석하고 로딩 중임을 알림', async ({
    page,
  }) => {
    test.slow(); // 워커의 엔진 대기 시간(15초)을 기다림
    const engine = holdRequests(page, IMAGE_ENGINE);

    await page.goto('/ko');
    await engine.requested;
    await openFile(page, FIXTURES.jpeg);

    // 토스트 (알림 기록 목록에도 같은 제목이 있어 보이는 것만)
    await expect(
      page.getByText(messages.ENGINE_LOADING.title).filter({ visible: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('image/jpeg')).toBeVisible();
    engine.release();
  });

  test('엔진 다운로드는 백그라운드 작업이라 이탈 확인 창을 띄우지 않음', async ({
    page,
  }) => {
    const engine = holdRequests(page, IMAGE_ENGINE);

    await page.goto('/ko');
    await engine.requested;
    // beforeunload 확인 창은 사용자 상호작용이 있었던 페이지에서만 뜸
    await page.mouse.click(5, 5);

    const prompted = await closeTriggersLeavePrompt(page);
    engine.release();
    expect(prompted).toBe(false);
  });

  test('(대조군) core 초기화 중에는 이탈 확인 창이 뜸', async ({ page }) => {
    const core = holdRequests(page, CORE_ENGINE);

    await page.goto('/ko');
    await core.requested;
    await page.mouse.click(5, 5);

    const prompted = await closeTriggersLeavePrompt(page);
    core.release();
    expect(prompted).toBe(true);
  });

  test('업데이트 후 구버전 엔진 캐시는 삭제되고 현재 엔진만 남음', async ({
    page,
  }) => {
    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);
    await expect(page.getByText(EXIF_MAKE)).toBeVisible();

    // 이전 배포 버전이 캐시에 남아 있는 상황
    await page.evaluate(async () => {
      const cache = await caches.open('ice-wasm-cache-v1');
      await cache.put('/wasm/ice_core_250101.wasm', new Response('old'));
    });

    await page.reload();
    await openFile(page, FIXTURES.jpeg);
    await expect(page.getByText(EXIF_MAKE)).toBeVisible();

    const cached = await page.evaluate(async () => {
      const cache = await caches.open('ice-wasm-cache-v1');
      return (await cache.keys()).map((req) => new URL(req.url).pathname);
    });
    expect(cached).not.toContain('/wasm/ice_core_250101.wasm');
    expect(cached).toEqual(
      expect.arrayContaining([
        expect.stringMatching(CORE_ENGINE),
        expect.stringMatching(IMAGE_ENGINE),
      ])
    );
  });

  test('분석이 끝나고 할 일이 없으면 이탈 확인 창이 뜨지 않음', async ({
    page,
  }) => {
    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);
    await expect(page.getByText(EXIF_MAKE)).toBeVisible();
    await page.mouse.click(5, 5);

    expect(await closeTriggersLeavePrompt(page)).toBe(false);
  });
});
