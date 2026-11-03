import { expect, test, type Page } from '@playwright/test';

/** 페이지 로드 중 발생한 콘솔 오류와 처리되지 않은 예외 수집 */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('주요 페이지', () => {
  for (const path of [
    '/',
    '/ko',
    '/en',
    '/ko/about',
    '/en/about',
    '/ko/docs',
    '/ko/privacy',
    '/ko/linknote',
  ]) {
    test(`${path} 콘솔 오류 없이 로드`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);

      expect(response?.ok()).toBe(true);
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  }
});
