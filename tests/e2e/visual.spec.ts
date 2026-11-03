/**
 * 화면 회귀 테스트 (@visual)
 * 기준 이미지와 픽셀 단위로 비교. 의도한 디자인 변경이면 기준 이미지를 갱신:
 *   npm run test:visual:update
 */
import { expect, test } from '@playwright/test';
import { EXIF_MAKE, FIXTURES, openFile } from './helpers';
import messages from '../../src/locales/ko/messages/messages.json';

test.describe('화면 @visual', () => {
  test('시작 화면', async ({ page }) => {
    await page.goto('/ko');

    await expect(page).toHaveScreenshot('home.png');
  });

  test('JPEG 분석 결과', async ({ page }) => {
    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);
    await expect(page.getByText(EXIF_MAKE)).toBeVisible();
    // 소요시간 등 매번 달라지는 분석 완료 토스트가 사라진 뒤 비교
    await expect(
      page.getByText(messages.ANALYSIS_SUCCESS.title).filter({ visible: true })
    ).toHaveCount(0, { timeout: 15_000 });

    await expect(page).toHaveScreenshot('analysis-jpeg.png', {
      // 파일 수정 시간은 생성 시점마다 다름
      mask: [page.getByText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)],
    });
  });
});
