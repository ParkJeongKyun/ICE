/**
 * 헥스 뷰어 가상 스크롤 테스트
 *
 * 헥스 뷰어는 canvas에 보이는 행만 그리므로 화면 글자를 직접 읽을 수 없다.
 * 대신 "4바이트마다 자기 오프셋을 UInt32(LE)로 적은" 파일을 열고,
 * 스크롤/이동 후 선택한 위치의 값(데이터 검사 패널)이 그 오프셋과 같은지 확인한다.
 * → 값이 맞으면 그 위치의 청크를 제대로 불러와 올바른 행에 그렸다는 뜻
 */
import { expect, test, type Page } from '@playwright/test';
import { getLayoutConfig } from '../../src/components/HexViewer/hexViewerConstants';
import ko from '../../src/locales/ko/translation.json';
import { openFile, patternFile, selectedOffset } from './helpers';
import messages from '../../src/locales/ko/messages/messages.json';

const FILE_SIZE = 64 * 1024 * 1024;
const BYTES_PER_ROW = 16;
const layout = getLayoutConfig(1440, BYTES_PER_ROW, 'hexadecimal', FILE_SIZE);
const LAST_ROW = FILE_SIZE / BYTES_PER_ROW - 1;

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/ko');
  await openFile(page, patternFile(FILE_SIZE));
  await expect(page.getByTestId('hex-canvas')).toBeVisible();
});

/** 오프셋 이동 입력창으로 이동 (선택 + 해당 행으로 스크롤) */
async function jumpTo(page: Page, offset: number) {
  const input = page.getByPlaceholder(ko.offsetNavigator.hexPlaceholder);
  await input.fill(offset.toString(16));
  await input.press('Enter');
}

/** 데이터 검사 패널의 UInt32 (리틀 엔디안) 값 */
async function inspectedUInt32(page: Page) {
  const text = await page.locator('body').innerText();
  const match = /UInt32\n(\d+)/.exec(text);
  return match ? Number(match[1]) : null;
}

/** 화면에 보이는 n번째 행(0부터)의 첫 바이트 클릭 */
async function clickVisibleRow(page: Page, rowIndex: number) {
  await page.getByTestId('hex-canvas').click({
    position: {
      x: layout.HEX_START_X + layout.hexByteWidth / 2,
      y: rowIndex * layout.rowHeight + layout.rowHeight / 2,
    },
  });
}

async function thumbTranslateY(page: Page) {
  return page
    .getByTestId('hex-scrollbar-thumb')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
}

test('처음/중간/끝 어디로 이동해도 그 위치의 데이터를 정확히 표시', async ({
  page,
}) => {
  for (const offset of [
    0,
    0x1000,
    0x7f_fff0, // 첫 청크에서 먼 위치
    0x1fa_5a50,
    FILE_SIZE - 16,
  ]) {
    await jumpTo(page, offset);
    await expect.poll(() => selectedOffset(page)).toBe(offset);
    await expect.poll(() => inspectedUInt32(page)).toBe(offset);
  }
});

test('마우스 휠은 한 칸에 한 행씩 스크롤', async ({ page }) => {
  const canvas = page.getByTestId('hex-canvas');
  await canvas.hover();
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 100);
  }

  // 스크롤 후 맨 위 행은 25번째 행
  await clickVisibleRow(page, 0);
  await expect.poll(() => selectedOffset(page)).toBe(25 * BYTES_PER_ROW);
  await expect.poll(() => inspectedUInt32(page)).toBe(25 * BYTES_PER_ROW);
});

test('스크롤바를 끝까지 끌면 마지막 행까지 표시', async ({ page }) => {
  const track = await page.getByTestId('hex-scrollbar').boundingBox();
  const thumb = await page.getByTestId('hex-scrollbar-thumb').boundingBox();
  expect(track && thumb).toBeTruthy();

  await page.mouse.move(thumb!.x + thumb!.width / 2, thumb!.y + 5);
  await page.mouse.down();
  await page.mouse.move(
    thumb!.x + thumb!.width / 2,
    track!.y + track!.height + 50,
    {
      steps: 10,
    }
  );
  await page.mouse.up();

  // 화면에 보이는 마지막 행 = 파일의 마지막 행
  const canvasBox = await page.getByTestId('hex-canvas').boundingBox();
  const visibleRows = Math.floor(canvasBox!.height / layout.rowHeight);
  await clickVisibleRow(page, visibleRows - 1);

  const lastRowOffset = LAST_ROW * BYTES_PER_ROW;
  await expect.poll(() => selectedOffset(page)).toBe(lastRowOffset);
  await expect.poll(() => inspectedUInt32(page)).toBe(lastRowOffset);
});

test('스크롤바 위치가 현재 보는 위치를 반영', async ({ page }) => {
  expect(await thumbTranslateY(page)).toBe(0);

  await jumpTo(page, FILE_SIZE / 2);
  const middle = await thumbTranslateY(page);
  await jumpTo(page, FILE_SIZE - 16);
  const end = await thumbTranslateY(page);

  const track = await page.getByTestId('hex-scrollbar').boundingBox();
  const thumb = await page.getByTestId('hex-scrollbar-thumb').boundingBox();
  const maxTop = track!.height - thumb!.height;
  expect(middle).toBeGreaterThan(maxTop * 0.45);
  expect(middle).toBeLessThan(maxTop * 0.55);
  expect(end).toBeCloseTo(maxTop, 0);
});

test('파일이 커도 canvas는 화면 크기만큼만 그림 (가상 스크롤)', async ({
  page,
}) => {
  const box = await page.getByTestId('hex-canvas').boundingBox();
  const viewport = page.viewportSize()!;

  // 64MB = 400만 행이지만 canvas 높이는 화면 이하
  expect(box!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(2);
});

test('파일 끝부분 화면 @visual', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'visual-mobile',
    '데스크톱 레이아웃만 비교'
  );
  await jumpTo(page, FILE_SIZE - 16);
  await expect.poll(() => inspectedUInt32(page)).toBe(FILE_SIZE - 16);

  // 처리 속도 등 매번 달라지는 탭 생성 토스트가 사라진 뒤
  await expect(
    page.getByText(messages.TAB_CREATED.title).filter({ visible: true })
  ).toHaveCount(0, { timeout: 15_000 });

  await expect(page.getByTestId('hex-viewer')).toHaveScreenshot('hex-end.png');
});

test.describe('탭 전환', () => {
  const OTHER_FILE = 'ice-e2e-pattern-other.bin';

  const tab = (page: Page, name: string) => page.getByRole('tab', { name });

  async function switchTab(page: Page, name: string) {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  }

  /** 스크롤바를 끌어 선택은 그대로 두고 화면만 이동 */
  async function dragThumb(page: Page, distance: number) {
    const thumb = await page.getByTestId('hex-scrollbar-thumb').boundingBox();
    await page.mouse.move(thumb!.x + thumb!.width / 2, thumb!.y + 5);
    await page.mouse.down();
    await page.mouse.move(
      thumb!.x + thumb!.width / 2,
      thumb!.y + 5 + distance,
      {
        steps: 5,
      }
    );
    await page.mouse.up();
  }

  test('탭마다 스크롤 위치와 선택을 따로 기억', async ({ page }) => {
    const firstName = `ice-e2e-pattern-${FILE_SIZE}.bin`;

    // 첫 탭: 맨 앞을 선택한 뒤, 선택이 화면 밖으로 나가도록 스크롤만 이동
    await clickVisibleRow(page, 0);
    await expect.poll(() => selectedOffset(page)).toBe(0);
    await dragThumb(page, 300);
    const scrolled = await thumbTranslateY(page);
    expect(scrolled).toBeGreaterThan(0);

    // 다른 탭을 열어 다른 위치 선택
    await openFile(page, patternFile(FILE_SIZE, OTHER_FILE));
    await expect(tab(page, OTHER_FILE)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect.poll(() => thumbTranslateY(page)).toBe(0);
    await clickVisibleRow(page, 3);
    await expect.poll(() => selectedOffset(page)).toBe(3 * BYTES_PER_ROW);

    // 첫 탭으로 돌아오면 선택 위치가 아니라 보던 스크롤 위치가 복원됨
    await switchTab(page, firstName);
    await expect.poll(() => selectedOffset(page)).toBe(0);
    await expect.poll(() => thumbTranslateY(page)).toBe(scrolled);

    // 복원된 화면에 그 위치의 데이터가 그려졌는지 확인
    await clickVisibleRow(page, 0);
    const top = await selectedOffset(page);
    expect(top).toBeGreaterThan(0);
    await expect.poll(() => inspectedUInt32(page)).toBe(top);

    // 다른 탭도 자기 위치 유지
    await switchTab(page, OTHER_FILE);
    await expect.poll(() => selectedOffset(page)).toBe(3 * BYTES_PER_ROW);
    await expect.poll(() => thumbTranslateY(page)).toBe(0);
  });

  test('탭을 닫으면 남은 탭으로 전환되고 그 탭의 위치 유지', async ({
    page,
  }) => {
    const firstName = `ice-e2e-pattern-${FILE_SIZE}.bin`;
    await jumpTo(page, 0x7f_fff0);
    await expect.poll(() => inspectedUInt32(page)).toBe(0x7f_fff0);

    await openFile(page, patternFile(FILE_SIZE, OTHER_FILE));
    await expect(tab(page, OTHER_FILE)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await tab(page, OTHER_FILE).getByLabel(ko.common.close).click();

    await expect(tab(page, OTHER_FILE)).toHaveCount(0);
    await expect(tab(page, firstName)).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => selectedOffset(page)).toBe(0x7f_fff0);
    await expect.poll(() => inspectedUInt32(page)).toBe(0x7f_fff0);
  });
});
