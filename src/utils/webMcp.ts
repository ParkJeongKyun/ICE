// WebMCP 도구(src/components/WebMcpTools)에서 쓰는 바이트 표시, 검색어 변환, 문자열 추출
import { byteToChar, byteToHex } from '@/utils/encoding';
import { hexToBytes } from '@/utils/hexViewer';

/** 숫자 인자를 정수로 바꾸고 범위 안으로 맞춤 (잘못된 값이면 기본값) */
export function num(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const n = typeof value === 'number' ? value : Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** 오프셋을 헥스 뷰어처럼 8자리 대문자 16진수로 */
export const hexOffset = (offset: number) =>
  offset.toString(16).toUpperCase().padStart(8, '0');

/** 바이트를 헥스 뷰어처럼 "오프셋  헥스  아스키" 줄로 표시 (헥스 뷰어와 같은 변환 규칙) */
export function hexDump(bytes: Uint8Array, start: number) {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = [...bytes.subarray(i, i + 16)];
    const hex = row.map(byteToHex).join(' ');
    const ascii = row.map((b) => byteToChar(b, 'ascii')).join('');
    lines.push(`${hexOffset(start + i)}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join('\n');
}

export async function readBytes(file: File, offset: number, length: number) {
  return new Uint8Array(
    await file.slice(offset, Math.min(file.size, offset + length)).arrayBuffer()
  );
}

/**
 * 검색어를 바이트로 변환 (hex는 공백 허용: "4D 5A 90")
 * text는 UTF-8 (화면 검색의 asciiToBytes와 달리 한글 등 ASCII 밖 글자도 그대로 검색)
 * hex는 에이전트가 잘못 쓴 값으로 엉뚱한 검색을 하지 않도록 화면 검색보다 엄격하게 확인
 */
export function patternBytes(pattern: string, encoding: string) {
  if (encoding !== 'hex') return new TextEncoder().encode(pattern);
  const hex = pattern.replace(/\s+/g, '');
  if (!/^([0-9a-f]{2})+$/i.test(hex))
    throw new Error('Hex pattern must be pairs of hex digits, e.g. "4D 5A 90"');
  return hexToBytes(hex);
}

/** 문자열 하나에 담는 최대 글자 수 (긴 텍스트가 그대로 에이전트에 가지 않도록) */
const MAX_STRING_CHARS = 256;
const latin1 = new TextDecoder('latin1');
const utf16le = new TextDecoder('utf-16le');

/**
 * ASCII, UTF-16LE 문자열을 파일 앞에서부터 limit개까지 추출
 * 종류별로 각각 limit개까지 찾은 뒤 오프셋 순으로 합쳐 자름
 * (한 종류가 limit을 먼저 채워 다른 종류가 통째로 빠지지 않도록)
 */
export function extractStrings(
  bytes: Uint8Array,
  base: number,
  minLength: number,
  limit: number
) {
  type Found = { offset: number; encoding: string; value: string };
  const printable = (b: number) => b >= 0x20 && b < 0x7f;
  // 긴 문자열은 앞부분만 (바이트 수로 잘라 디코딩)
  const decode = (
    decoder: TextDecoder,
    from: number,
    to: number,
    bytesPerChar: number
  ) => {
    const chars = (to - from) / bytesPerChar;
    const end = Math.min(to, from + MAX_STRING_CHARS * bytesPerChar);
    const text = decoder.decode(bytes.subarray(from, end));
    return chars > MAX_STRING_CHARS ? `${text}… (${chars} chars)` : text;
  };

  const ascii: Found[] = [];
  for (let i = 0, start = -1; i <= bytes.length && ascii.length < limit; i++) {
    if (i < bytes.length && printable(bytes[i])) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start >= minLength)
        ascii.push({
          offset: base + start,
          encoding: 'ascii',
          value: decode(latin1, start, i, 1),
        });
      start = -1;
    }
  }

  // UTF-16LE는 짝수, 홀수 위치에서 시작하는 문자열을 모두 찾음
  const wide = [0, 1].map((align) => {
    const found: Found[] = [];
    for (let i = align, start = -1; found.length < limit; i += 2) {
      const isChar =
        i + 1 < bytes.length && printable(bytes[i]) && bytes[i + 1] === 0;
      if (isChar) {
        if (start < 0) start = i;
        continue;
      }
      if (start >= 0 && (i - start) / 2 >= minLength)
        found.push({
          offset: base + start,
          encoding: 'utf16le',
          value: decode(utf16le, start, i, 2),
        });
      start = -1;
      // 파일 끝까지 이어진 문자열도 위에서 넣은 뒤 끝냄
      if (i + 1 >= bytes.length) break;
    }
    return found;
  });

  return [...ascii, ...wide.flat()]
    .sort((a, b) => a.offset - b.offset)
    .slice(0, limit);
}

/** 긴 문자열은 앞부분만 남기고 원래 길이를 표시 */
export function truncate(value: unknown, maxChars: number) {
  return typeof value === 'string' && value.length > maxChars
    ? `${value.slice(0, maxChars)}… (${value.length} chars)`
    : value;
}
