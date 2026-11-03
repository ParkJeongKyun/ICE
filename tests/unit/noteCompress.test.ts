import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CompressRequest,
  CompressResponse,
  DecompressRequest,
  DecompressResponse,
} from '@/workers/noteCompress.worker';

/**
 * 링크 노트는 내용 전체를 URL(?data=)에 압축해 공유한다.
 * 형식이 바뀌면 이미 공유된 링크가 열리지 않으므로 고정된 링크로 호환성을 확인.
 */

// 2026-03-17에 만든 링크의 data 값 (형식을 바꾸지 않는 한 수정하지 말 것)
const SHARED_DATA =
  'eJyrVkpWslKyKbB7M7XjdetUBU9nV4UP86f0KuTll6Ta6BfYKeko5eQClRgZGJnpGhjrGpqHGBhYgZGegYFBlFItABnlFHw%3D';

type Response = CompressResponse | DecompressResponse;

// 워커 전역(self) 대신 쓰는 객체. 설정의 unstubGlobals가 테스트마다 전역을
// 되돌리므로 매 테스트 전에 다시 연결
const worker = {
  postMessage: vi.fn(),
  onmessage: null as ((e: MessageEvent) => void) | null,
};

beforeEach(() => {
  vi.stubGlobal('self', worker);
});

beforeAll(async () => {
  vi.stubGlobal('self', worker);
  await import('@/workers/noteCompress.worker');
});

const send = (request: CompressRequest | DecompressRequest): Response => {
  worker.postMessage.mockClear();
  worker.onmessage!({ data: request } as MessageEvent);
  return worker.postMessage.mock.calls[0][0];
};

const decompress = (data: string) =>
  send({ id: '1', type: 'DECOMPRESS', data }) as DecompressResponse;

describe('링크 노트 압축', () => {
  it('예전에 공유된 링크도 그대로 열림', () => {
    expect(decompress(SHARED_DATA)).toEqual({
      id: '1',
      type: 'DECOMPRESS',
      content: '<p>안녕 ICE 🔍 note</p>',
      lastModified: '2026-03-17T00:00:00.000Z',
    });
  });

  it('압축한 링크를 풀면 원래 내용 (한글, 이모지, 긴 글)', () => {
    const content = `<h1>메모</h1>${'<p>포렌식 🔍 & "quote" ?=#</p>'.repeat(200)}`;
    const compressed = send({
      id: '2',
      type: 'COMPRESS',
      content,
      origin: 'https://example.com',
      pathname: '/ko/linknote',
    }) as CompressResponse;

    const url = new URL(compressed.url!);
    expect(url.pathname).toBe('/ko/linknote');

    // 링크 노트 페이지와 같은 방식(URLSearchParams)으로 읽어 복원
    const restored = decompress(url.searchParams.get('data')!);
    expect(restored.content).toBe(content);
    expect(restored.lastModified).toBe(compressed.lastModified);
  });

  it('깨진 링크는 오류로 응답 (예외로 워커가 멈추지 않음)', () => {
    expect(decompress('not-a-valid-link').error).toBeTruthy();
  });
});
