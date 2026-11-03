/**
 * 검색, 해시 계산 등 오른쪽 도구 패널 테스트
 * 기대값은 Node에서 같은 파일을 직접 읽어 계산한 값과 비교
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import ko from '../../src/locales/ko/translation.json';
import messages from '../../src/locales/ko/messages/messages.json';
import { FIXTURES, PNG_TEXT, openFile, selectedOffset } from './helpers';

async function search(page: Page, type: 'hex' | 'ascii', value: string) {
  await page
    .getByRole('combobox', { name: ko.searcher.typeLabel })
    .selectOption(type);
  const input = page.getByRole('textbox', { name: ko.searcher.searchLabel });
  await input.fill(value);
  await input.press('Enter');
}

test.describe('검색', () => {
  test('Hex 검색은 첫 번째 결과 위치로 이동', async ({ page }) => {
    const file = readFileSync(FIXTURES.jpeg);
    // JPEG 끝 표시(FF D9)의 첫 위치
    const expected = file.indexOf(Buffer.from([0xff, 0xd9]));

    await page.goto('/ko');
    await openFile(page, FIXTURES.jpeg);
    await search(page, 'hex', 'FFD9');

    await expect.poll(() => selectedOffset(page)).toBe(expected);
  });

  test('ASCII 검색: 기본은 대소문자 구분 없음, 켜면 구분', async ({ page }) => {
    const expected = readFileSync(FIXTURES.png).indexOf(PNG_TEXT);
    expect(expected).toBeGreaterThan(0);

    await page.goto('/ko');
    await openFile(page, FIXTURES.png);
    await search(page, 'ascii', PNG_TEXT.toLowerCase());
    await expect.poll(() => selectedOffset(page)).toBe(expected);

    await page
      .getByLabel(ko.searcher.caseInsensitiveTooltip, { exact: true })
      .click();
    await search(page, 'ascii', PNG_TEXT.toLowerCase());
    await expect(
      page
        .getByText(messages.SEARCH_NO_RESULTS.message)
        .filter({ visible: true })
    ).not.toHaveCount(0);
  });
});

test.describe('해시 계산', () => {
  for (const algorithm of ['sha256', 'md5'] as const) {
    test(`${algorithm.toUpperCase()} 값이 실제 파일 해시와 같음`, async ({
      page,
    }) => {
      const expected = createHash(algorithm)
        .update(readFileSync(FIXTURES.jpeg))
        .digest('hex');

      await page.goto('/ko');
      await openFile(page, FIXTURES.jpeg);
      await page.getByText(ko.calculateHash.title, { exact: true }).click();
      await page
        .getByRole('button', {
          name: ko.calculateHash.calculateTooltip.replace(
            '{type}',
            algorithm.toUpperCase()
          ),
        })
        .click();

      await expect(
        page.getByText(new RegExp(`^${expected}$`, 'i'))
      ).toBeVisible();
    });
  }
});
