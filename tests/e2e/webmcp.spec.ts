/**
 * WebMCP: 브라우저 AI 에이전트용 도구가 등록되고, 열린 파일을 올바르게 분석하는지
 * 에이전트처럼 document.modelContext.getTools / executeTool로 직접 호출해 확인
 * (Chromium에서 WebMCP 기능을 켜고 실행. 기대값은 Node에서 같은 파일을 직접 읽어 계산)
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  EXIF_MAKE,
  EXIF_MODEL,
  FIXTURES,
  PNG_TEXT,
  openFile,
  selectedOffset,
} from './helpers';

test.use({ launchOptions: { args: ['--enable-features=WebMCP'] } });

const TOOLS = [
  'ice_get_metadata',
  'ice_get_pe',
  'ice_hash',
  'ice_list_files',
  'ice_read_hex',
  'ice_search',
  'ice_show_offset',
  'ice_strings',
];

/** 에이전트처럼 도구를 찾아 실행하고 결과 문자열을 돌려받음 */
function runTool(page: Page, name: string, input: object = {}) {
  return page.evaluate(
    async ([name, input]) => {
      const context = (
        document as unknown as {
          modelContext: {
            getTools: () => Promise<{ name: string }[]>;
            executeTool: (tool: unknown, input: unknown) => Promise<unknown>;
          };
        }
      ).modelContext;
      const tool = (await context.getTools()).find((t) => t.name === name);
      return String(await context.executeTool(tool, input));
    },
    [name, input] as const
  );
}

/** JSON 결과는 객체로, 안내 문장(파일이 아직 반영되지 않은 경우 등)은 문자열 그대로 */
async function runJson(page: Page, name: string, input: object = {}) {
  const result = await runTool(page, name, input);
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

test.describe('WebMCP 도구', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ko');
    // WebMCP를 지원하지 않는 브라우저에서는 건너뜀
    const supported = await page.evaluate(() => 'modelContext' in document);
    test.skip(!supported, 'WebMCP 미지원 브라우저');
  });

  test('도구 8개 등록, 화면 이동 외에는 읽기 전용', async ({ page }) => {
    const tools = await page.evaluate(async () =>
      (
        await (
          document as unknown as {
            modelContext: {
              getTools: () => Promise<
                { name: string; annotations?: { readOnlyHint?: boolean } }[]
              >;
            };
          }
        ).modelContext.getTools()
      ).map((t) => ({ name: t.name, readOnly: t.annotations?.readOnlyHint }))
    );
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    for (const tool of tools)
      expect(tool.readOnly, tool.name).toBe(tool.name !== 'ice_show_offset');
  });

  test('파일이 없으면 열어 달라고 안내', async ({ page }) => {
    await expect
      .poll(() => runTool(page, 'ice_read_hex'))
      .toContain('No file is open in ICE');
  });

  test('열린 파일 목록, 메타데이터, 헥스', async ({ page }) => {
    await openFile(page, FIXTURES.jpeg);
    await openFile(page, FIXTURES.png);

    await expect
      .poll(async () => runJson(page, 'ice_list_files'))
      .toMatchObject([
        {
          name: 'sample.jpg',
          detectedType: 'image/jpeg',
          available: { exif: true },
        },
        { name: 'sample.png', detectedType: 'image/png', shownInViewer: true },
      ]);

    const jpeg = await runTool(page, 'ice_get_metadata', { tab: 'sample.jpg' });
    expect(jpeg).toContain(EXIF_MAKE);
    expect(jpeg).toContain(EXIF_MODEL);
    expect(await runTool(page, 'ice_get_metadata')).toContain(PNG_TEXT);

    expect(
      await runTool(page, 'ice_read_hex', { tab: 'sample.jpg', length: 4 })
    ).toBe('00000000  FF D8 FF E1' + ' '.repeat(36) + '  ....');
  });

  test('검색, 문자열, 해시는 실제 파일과 같은 값', async ({ page }) => {
    const png = readFileSync(FIXTURES.png);
    await openFile(page, FIXTURES.png);

    await expect
      .poll(() => runJson(page, 'ice_search', { pattern: PNG_TEXT }))
      .toMatchObject({
        totalMatches: 1,
        matches: [{ offset: png.indexOf(PNG_TEXT) }],
      });
    expect(await runTool(page, 'ice_strings', { minLength: 4 })).toContain(
      PNG_TEXT
    );
    expect(
      JSON.parse(await runTool(page, 'ice_hash', { algorithm: 'sha256' })).hash
    ).toBe(createHash('sha256').update(png).digest('hex'));
  });

  test('화면 이동은 헥스 뷰어 선택 위치를 바꿈', async ({ page }) => {
    const offset = readFileSync(FIXTURES.png).indexOf(PNG_TEXT);
    await openFile(page, FIXTURES.png);
    await expect
      .poll(() => runTool(page, 'ice_show_offset', { offset, length: 4 }))
      .toContain('highlighted');
    await expect.poll(() => selectedOffset(page)).toBe(offset);
  });

  test('잘못된 요청은 이유를 결과로 알려줌', async ({ page }) => {
    await openFile(page, FIXTURES.jpeg);
    await expect
      .poll(() => runTool(page, 'ice_read_hex', { tab: 'nope.bin' }))
      .toContain('No open file matches');
    expect(
      await runTool(page, 'ice_search', { pattern: 'XYZ', encoding: 'hex' })
    ).toContain('pairs of hex digits');
    expect(await runTool(page, 'ice_get_pe')).toContain(
      'not a Windows executable'
    );
  });
});
