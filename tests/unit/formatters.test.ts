import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatOffset,
  getBytes,
  getDate,
} from '@/utils/formatters';

describe('formatOffset', () => {
  it.each([
    ['hexadecimal', '255(0xFF)'],
    ['octal', '255(0o377)'],
    ['binary', '255(0b11111111)'],
    ['decimal', '255'],
  ] as const)('%s', (base, expected) => {
    expect(formatOffset(255, base)).toBe(expected);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
  ])('%d', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('getBytes', () => {
  it('사람이 읽는 단위와 원래 바이트 수를 함께 표시', () => {
    expect(getBytes(2048)).toBe(`2 KB (${(2048).toLocaleString()} Byte)`);
  });
});

describe('getDate', () => {
  it('형식별로 포맷', () => {
    const date = new Date(2026, 2, 17, 9, 5, 7);
    expect(getDate(date, 'ISO')).toBe('2026-03-17 09:05:07');
    expect(getDate(date, 'US')).toBe('03/17/2026 09:05:07');
    expect(getDate(date, 'KO')).toBe('2026년 03월 17일 09:05:07');
  });

  it('잘못된 날짜는 빈 문자열', () => {
    expect(getDate('not a date')).toBe('');
  });
});
