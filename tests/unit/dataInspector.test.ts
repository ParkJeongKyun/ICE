import { describe, expect, it } from 'vitest';
import {
  bytesToDOSDate,
  bytesToDOSDateTime,
  bytesToDOSTime,
  bytesToFILETIME,
  bytesToFloat32,
  bytesToGUID,
  bytesToOLETIME,
  bytesToSigned,
  bytesToSignedInt24,
  bytesToTimeT32,
  bytesToTimeT64,
  bytesToUnsigned,
  bytesToUnsignedInt24,
  decodeSLEB128,
  decodeULEB128,
} from '@/utils/dataInspector';

// 시간 값은 vitest.config.mts에서 TZ=UTC로 고정한 상태에서 비교

const bytes = (...values: number[]) => new Uint8Array(values);

/** 64비트 정수를 리틀 엔디안 8바이트로 */
const u64le = (value: bigint) => {
  const buffer = new Uint8Array(8);
  new DataView(buffer.buffer).setBigUint64(0, value, true);
  return buffer;
};

/** 날짜 → Windows FILETIME (1601-01-01부터 100ns 단위) */
const toFiletime = (iso: string) =>
  BigInt(Date.parse(iso) - Date.UTC(1601, 0, 1)) * 10_000n;

describe('정수', () => {
  it('엔디안에 따라 같은 바이트를 다르게 읽음', () => {
    const data = bytes(0x01, 0x02, 0x03, 0x04);
    expect(bytesToUnsigned(data, 4, true)).toBe(0x04030201n);
    expect(bytesToUnsigned(data, 4, false)).toBe(0x01020304n);
  });

  it('부호 있는 정수는 최상위 비트를 부호로 처리', () => {
    expect(bytesToSigned(bytes(0xff), 1, true)).toBe(-1n);
    expect(bytesToSigned(bytes(0x00, 0x80), 2, true)).toBe(-32768n);
    expect(bytesToSigned(bytes(0xff, 0x7f), 2, true)).toBe(32767n);
    expect(bytesToSigned(new Uint8Array(8).fill(0xff), 8, true)).toBe(-1n);
  });

  it('64비트 최댓값도 정밀도 손실 없이 읽음', () => {
    expect(bytesToUnsigned(new Uint8Array(8).fill(0xff), 8, true)).toBe(
      0xffff_ffff_ffff_ffffn
    );
  });

  it('24비트 정수', () => {
    expect(bytesToUnsignedInt24(bytes(0x01, 0x02, 0x03), true)).toBe(0x030201);
    expect(bytesToUnsignedInt24(bytes(0x01, 0x02, 0x03), false)).toBe(0x010203);
    expect(bytesToSignedInt24(bytes(0xff, 0xff, 0xff), true)).toBe(-1);
    expect(bytesToSignedInt24(bytes(0x00, 0x00, 0x80), true)).toBe(-8388608);
  });

  it('Float32', () => {
    // 1.5 = 0x3FC00000
    expect(bytesToFloat32(bytes(0x00, 0x00, 0xc0, 0x3f), true)).toBe(1.5);
    expect(bytesToFloat32(bytes(0x3f, 0xc0, 0x00, 0x00), false)).toBe(1.5);
    expect(bytesToFloat32(bytes(0x00), true)).toBeNull();
  });
});

describe('LEB128', () => {
  it('ULEB128', () => {
    expect(decodeULEB128(bytes(0x02))).toBe('2');
    expect(decodeULEB128(bytes(0xe5, 0x8e, 0x26))).toBe('624485');
  });

  it('SLEB128 음수', () => {
    expect(decodeSLEB128(bytes(0x7f))).toBe('-1');
    expect(decodeSLEB128(bytes(0xc0, 0xbb, 0x78))).toBe('-123456');
  });

  it('끝나지 않은 값은 "-"', () => {
    expect(decodeULEB128(bytes(0x80, 0x80))).toBe('-');
  });
});

describe('FILETIME', () => {
  it('Windows FILETIME을 날짜로 변환', () => {
    expect(
      bytesToFILETIME(u64le(toFiletime('2024-01-01T00:00:00Z')), true)
    ).toBe('2024-01-01 00:00:00');
  });

  it('하위 32비트의 최상위 비트가 1이어도 정확히 변환', () => {
    // 하위 32비트 = 0xFF7C4000 (최상위 비트 1)
    const filetime = toFiletime('2026-03-17T00:00:00Z');
    expect(filetime & 0x8000_0000n).not.toBe(0n);

    expect(bytesToFILETIME(u64le(filetime), true)).toBe('2026-03-17 00:00:00');
    expect(bytesToFILETIME(u64le(filetime).reverse(), false)).toBe(
      '2026-03-17 00:00:00'
    );
  });

  it('0은 유효하지 않은 값', () => {
    expect(bytesToFILETIME(new Uint8Array(8), true)).toBe('-');
  });
});

describe('DOS 날짜/시간', () => {
  // 2026-03-17 09:05:06
  // 날짜 = (2026-1980)<<9 | 3<<5 | 17 = 0x5C71
  // 시간 = 9<<11 | 5<<5 | 6/2 = 0x48A3
  const date = bytes(0x71, 0x5c);
  const time = bytes(0xa3, 0x48);

  it('DOS 날짜와 시간', () => {
    expect(bytesToDOSDate(date, true)).toBe('2026-03-17');
    expect(bytesToDOSTime(time, true)).toBe('09:05:06');
  });

  it('DOS 날짜+시간 (ZIP 등: 시간 2바이트 다음 날짜 2바이트)', () => {
    expect(bytesToDOSDateTime(bytes(...time, ...date), true)).toBe(
      '2026-03-17 09:05:06'
    );
  });

  it('날짜 표시 형식 설정과 관계없이 변환', () => {
    const value = bytes(...time, ...date);
    expect(bytesToDOSDateTime(value, true, 'US')).toBe('03/17/2026 09:05:06');
    expect(bytesToDOSDateTime(value, true, 'KO')).toBe(
      '2026년 03월 17일 09:05:06'
    );
  });

  it('잘못된 월/일은 "-"', () => {
    expect(bytesToDOSDate(bytes(0x00, 0x00), true)).toBe('-');
  });
});

describe('기타 시간 형식', () => {
  it('Unix time_t', () => {
    // 1700000000 = 0x6553F100
    expect(bytesToTimeT32(bytes(0x00, 0xf1, 0x53, 0x65), true)).toBe(
      '2023-11-14 22:13:20'
    );
    expect(bytesToTimeT64(u64le(1_700_000_000n), true)).toBe(
      '2023-11-14 22:13:20'
    );
  });

  it('OLE 날짜 (1899-12-30부터 일 단위 실수)', () => {
    const buffer = new Uint8Array(8);
    new DataView(buffer.buffer).setFloat64(0, 45000.5, true);
    expect(bytesToOLETIME(buffer, true)).toBe('2023-03-15 12:00:00');
  });
});

describe('GUID', () => {
  it('리틀 엔디안은 앞 세 그룹의 바이트 순서를 뒤집음', () => {
    const data = bytes(
      0x33,
      0x22,
      0x11,
      0x00,
      0x55,
      0x44,
      0x77,
      0x66,
      0x88,
      0x99,
      0xaa,
      0xbb,
      0xcc,
      0xdd,
      0xee,
      0xff
    );
    expect(bytesToGUID(data, true)).toBe(
      '00112233-4455-6677-8899-aabbccddeeff'
    );
  });
});
