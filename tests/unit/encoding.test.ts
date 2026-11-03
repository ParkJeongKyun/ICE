import { describe, expect, it } from 'vitest';
import { byteToChar, byteToHex } from '@/utils/encoding';

describe('byteToHex', () => {
  it('두 자리 대문자', () => {
    expect(byteToHex(0)).toBe('00');
    expect(byteToHex(0x0a)).toBe('0A');
    expect(byteToHex(0xff)).toBe('FF');
  });
});

describe('byteToChar', () => {
  it('제어 문자는 점으로 표시', () => {
    expect(byteToChar(0x00, 'ascii')).toBe('.');
    expect(byteToChar(0x0a, 'ansi')).toBe('.');
    expect(byteToChar(0x7f, 'oem')).toBe('.');
  });

  it('ASCII 범위는 ASCII 계열 인코딩에서 같은 글자', () => {
    for (const encoding of ['ascii', 'ansi', 'oem', 'mac'] as const) {
      expect(byteToChar(0x41, encoding)).toBe('A');
    }
  });

  it('확장 영역은 인코딩별 코드 페이지를 따름', () => {
    expect(byteToChar(0x80, 'ascii')).toBe('.');
    expect(byteToChar(0x80, 'ansi')).toBe('€'); // Windows-1252
    expect(byteToChar(0x80, 'oem')).toBe('Ç'); // CP437
    expect(byteToChar(0x80, 'mac')).toBe('Ä'); // Mac Roman
  });

  it('EBCDIC은 ASCII와 다른 위치에 글자가 있음', () => {
    expect(byteToChar(0xc1, 'ebcdic')).toBe('A');
    expect(byteToChar(0xf0, 'ebcdic')).toBe('0');
    expect(byteToChar(0x40, 'ebcdic')).toBe(' ');
    expect(byteToChar(0x4b, 'ebcdic')).toBe('.');
    expect(byteToChar(0x7d, 'ebcdic')).toBe("'");
    // ASCII 'A'(0x41)는 EBCDIC에서 글자가 아님
    expect(byteToChar(0x41, 'ebcdic')).toBe('.');
  });
});
