import { existsSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import ko from '../../src/locales/ko/translation.json';
import fixtureValues from '../fixtures/values.json';

/** tests/fixtures/generate.mjs로 만든 샘플 파일과 그 안에 넣은 값 */
export const FIXTURES = {
  jpeg: join(__dirname, '../fixtures/sample.jpg'),
  png: join(__dirname, '../fixtures/sample.png'),
};
export const EXIF_MAKE = fixtureValues.exifMake;
export const EXIF_MODEL = fixtureValues.exifModel;
export const PNG_TEXT = fixtureValues.pngText;

/**
 * 4바이트마다 자기 오프셋을 UInt32(LE)로 적은 파일 (임시 폴더에 한 번만 생성)
 * canvas 글자는 읽을 수 없으므로, 선택한 위치의 값이 오프셋과 같은지로 표시 위치를 확인
 */
export function patternFile(
  size: number,
  name = `ice-e2e-pattern-${size}.bin`
) {
  const path = join(tmpdir(), name);
  if (existsSync(path) && statSync(path).size === size) return path;
  const buffer = Buffer.alloc(size);
  for (let offset = 0; offset < size; offset += 4) {
    buffer.writeUInt32LE(offset, offset);
  }
  // 여러 워커가 동시에 만들 수 있으므로 임시 이름으로 쓴 뒤 한 번에 교체
  // (다른 워커가 쓰는 중인 파일을 읽지 않도록)
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, buffer);
  renameSync(temp, path);
  return path;
}

const CONFIG_KEY = 'ice_user_config';

/** 페이지 스크립트보다 먼저 사용자 설정을 localStorage에 넣음 */
export async function presetConfig(page: Page, config: object) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [CONFIG_KEY, JSON.stringify(config)]
  );
}

/**
 * 파일을 열 수 있는 상태가 될 때까지 대기
 * - 정적 HTML에서는 "파일 열기" 버튼이 처음부터 활성 상태라 버튼만 보면 안 됨
 *   (하이드레이션 전에 파일을 넣으면 이벤트 핸들러가 없어 무시됨, CI처럼 느린 환경에서 발생)
 * - core 엔진 초기화가 끝나면 메뉴에 data-wasm-ready="true"가 표시됨
 */
export async function waitForAppReady(page: Page) {
  await expect(page.locator('[data-wasm-ready="true"]')).toBeAttached({
    timeout: 60_000,
  });
  await expect(
    page.locator('button').filter({ hasText: ko.menu.open })
  ).toBeEnabled({ timeout: 60_000 });
}

/** 드롭존의 파일 입력으로 파일 열기 (드래그 앤 드롭과 같은 처리 경로) */
export async function openFile(page: Page, path: string) {
  await waitForAppReady(page);
  await page.locator('input[type=file]').first().setInputFiles(path);
}

/** 하단 상태바에 표시된 선택 오프셋 */
export async function selectedOffset(page: Page) {
  const text = await page.locator('body').innerText();
  const match = new RegExp(`${ko.footer.offset}:(\\d+)`).exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * 탭을 닫을 때 "페이지를 나가시겠습니까?" 확인 창이 뜨는지 확인
 * (beforeunload 핸들러가 이탈을 막으면 dialog 이벤트가 발생)
 */
export async function closeTriggersLeavePrompt(page: Page) {
  let prompted = false;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') prompted = true;
    await dialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  // beforeunload dialog는 close 직후 비동기로 발생
  await new Promise((resolve) => setTimeout(resolve, 500));
  return prompted;
}

/**
 * 패턴에 맞는 요청을 release() 전까지 붙잡아 둠 (느린 네트워크 재현)
 * requested: 첫 요청이 들어오면 resolve
 */
export function holdRequests(page: Page, pattern: RegExp) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markRequested!: () => void;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });

  void page.route(pattern, async (route) => {
    markRequested();
    await released;
    // 테스트가 끝나 페이지가 닫힌 뒤에 풀려도 오류로 처리하지 않음
    await route.continue().catch(() => {});
  });

  return { requested, release };
}
