import { describe, expect, it } from 'vitest';
import {
  extractStrings,
  hexDump,
  hexOffset,
  num,
  patternBytes,
  truncate,
} from '@/utils/webMcp';

const bytes = (text: string) => new TextEncoder().encode(text);
const utf16 = (text: string) =>
  Uint8Array.from([...text].flatMap((c) => [c.charCodeAt(0), 0]));

describe('num', () => {
  it('범위 안으로 맞추고 소수점은 버림', () => {
    expect(num(5.9, 0, 0, 10)).toBe(5);
    expect(num(-3, 0, 0, 10)).toBe(0);
    expect(num(99, 0, 0, 10)).toBe(10);
  });

  it('없거나 숫자가 아니면 기본값', () => {
    expect(num(undefined, 7, 0, 10)).toBe(7);
    expect(num('abc', 7, 0, 10)).toBe(7);
    expect(num('4', 7, 0, 10)).toBe(4);
  });
});

describe('hexDump', () => {
  it('오프셋, 헥스, 아스키를 16바이트씩 헥스 뷰어처럼 대문자로 표시', () => {
    const dump = hexDump(bytes('ABCDEFGHIJKLMNOPQR'), 0xa0);
    expect(dump.split('\n')).toEqual([
      '000000A0  41 42 43 44 45 46 47 48 49 4A 4B 4C 4D 4E 4F 50  ABCDEFGHIJKLMNOP',
      '000000B0  51 52                                            QR',
    ]);
  });

  it('hexOffset은 8자리 대문자', () => {
    expect(hexOffset(0xabc)).toBe('00000ABC');
  });

  it('출력할 수 없는 바이트는 점', () => {
    expect(hexDump(Uint8Array.from([0, 0x41, 0xff]), 0)).toMatch(/\.A\.$/);
  });
});

describe('patternBytes', () => {
  it('text는 UTF-8 바이트', () => {
    expect([...patternBytes('Exif', 'text')]).toEqual([0x45, 0x78, 0x69, 0x66]);
  });

  it('hex는 공백을 무시하고 두 자리씩', () => {
    expect([...patternBytes('4D 5a90', 'hex')]).toEqual([0x4d, 0x5a, 0x90]);
  });

  it('잘못된 hex는 안내 오류', () => {
    expect(() => patternBytes('XYZ', 'hex')).toThrow('pairs of hex digits');
    expect(() => patternBytes('ABC', 'hex')).toThrow();
  });
});

describe('extractStrings', () => {
  it('ASCII와 UTF-16LE 문자열을 오프셋 순으로 (홀수 위치에서 시작하는 UTF-16도)', () => {
    const data = new Uint8Array([
      ...bytes('\x00\x00hello world'),
      0xff,
      0xff,
      // 15번째 바이트(홀수 위치)부터 시작
      ...utf16('wide text'),
      0xff,
    ]);
    expect(extractStrings(data, 100, 6, 10)).toEqual([
      { offset: 102, encoding: 'ascii', value: 'hello world' },
      { offset: 115, encoding: 'utf16le', value: 'wide text' },
    ]);
  });

  it('파일 끝까지 이어진 UTF-16 문자열도 찾음', () => {
    expect(extractStrings(utf16('until the end'), 0, 6, 10)).toEqual([
      { offset: 0, encoding: 'utf16le', value: 'until the end' },
    ]);
  });

  it('최소 길이보다 짧은 문자열은 제외', () => {
    expect(extractStrings(bytes('\x00abc\x00abcdef\x00'), 0, 6, 10)).toEqual([
      { offset: 5, encoding: 'ascii', value: 'abcdef' },
    ]);
  });

  it('개수 제한에 걸려도 앞쪽의 UTF-16 문자열이 빠지지 않음', () => {
    // UTF-16 문자열이 맨 앞, 그 뒤에 ASCII 문자열 여러 개
    const data = new Uint8Array([
      ...utf16('wide first'),
      0xff,
      0xff,
      ...bytes('aaaaaa\x00bbbbbb\x00cccccc\x00'),
    ]);
    expect(extractStrings(data, 0, 6, 2).map((s) => s.value)).toEqual([
      'wide first',
      'aaaaaa',
    ]);
  });

  it('최대 개수까지만', () => {
    const data = bytes('aaaaaa\x00bbbbbb\x00cccccc\x00');
    expect(extractStrings(data, 0, 6, 2)).toHaveLength(2);
  });

  it('아주 긴 문자열도 멈추지 않고 앞부분만 담음', () => {
    // 인자 개수 한도를 넘는 길이 (String.fromCharCode(...bytes)로는 RangeError)
    const long = new Uint8Array(2_000_000).fill(0x41);
    const [found] = extractStrings(long, 0, 6, 10);
    expect(found.value.startsWith('A'.repeat(256))).toBe(true);
    expect(found.value).toContain('(2000000 chars)');
    expect(found.value.length).toBeLessThan(300);
  });
});

describe('truncate', () => {
  it('긴 문자열은 앞부분과 원래 길이', () => {
    expect(truncate('abcdef', 3)).toBe('abc… (6 chars)');
  });

  it('짧은 문자열과 문자열이 아닌 값은 그대로', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate(42, 1)).toBe(42);
  });
});
