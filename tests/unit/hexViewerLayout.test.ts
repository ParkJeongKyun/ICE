import { describe, expect, it } from 'vitest';
import { getLayoutConfig } from '@/components/HexViewer/hexViewerConstants';
import { calculateScrollbarTop } from '@/utils/hexViewer';
import { parseOffsetInput } from '@/utils/offsetUtils';

describe('getLayoutConfig', () => {
  it('파일 크기로 전체 행 수를 계산 (마지막 행은 일부만 차도 1행)', () => {
    expect(getLayoutConfig(1440, 16, 'hexadecimal', 64).rowCount).toBe(4);
    expect(getLayoutConfig(1440, 16, 'hexadecimal', 65).rowCount).toBe(5);
    expect(getLayoutConfig(1440, 16, 'hexadecimal', 0).rowCount).toBe(0);
  });

  it('bytesPerRow는 8~64로 제한', () => {
    expect(getLayoutConfig(1440, 4).bytesPerRow).toBe(8);
    expect(getLayoutConfig(1440, 128).bytesPerRow).toBe(64);
  });

  it('오프셋 칸은 최소 8자리, 큰 파일은 자릿수만큼 넓어짐', () => {
    const small = getLayoutConfig(1440, 16, 'hexadecimal', 1024);
    const large = getLayoutConfig(1440, 16, 'hexadecimal', 2 ** 40); // 1TB
    expect(small.offsetWidth).toBe(8 * small.offsetCharWidth);
    expect(large.offsetWidth).toBe(10 * large.offsetCharWidth);
    expect(large.HEX_START_X).toBeGreaterThan(small.HEX_START_X);
  });

  it('768px 미만은 모바일 레이아웃', () => {
    expect(getLayoutConfig(767).rowHeight).toBeLessThan(
      getLayoutConfig(768).rowHeight
    );
  });
});

describe('calculateScrollbarTop', () => {
  it('현재 행 비율만큼 스크롤바를 이동하고 범위를 벗어나지 않음', () => {
    expect(calculateScrollbarTop(0, 1000, 500, 50)).toBe(0);
    expect(calculateScrollbarTop(500, 1000, 500, 50)).toBe(225);
    expect(calculateScrollbarTop(1000, 1000, 500, 50)).toBe(450);
    expect(calculateScrollbarTop(2000, 1000, 500, 50)).toBe(450);
  });

  it('스크롤할 행이 없으면 0', () => {
    expect(calculateScrollbarTop(10, 0, 500, 50)).toBe(0);
  });
});

describe('parseOffsetInput', () => {
  it.each([
    ['3FFFFF0', 'hexadecimal', 0x3fffff0],
    ['0x10', 'hexadecimal', 16],
    ['777', 'octal', 511],
    ['0b101', 'binary', 5],
    ['100', 'decimal', 100],
  ] as const)('%s (%s)', (input, base, expected) => {
    expect(parseOffsetInput(input, base)).toBe(expected);
  });
});
