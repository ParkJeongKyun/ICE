import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WASM_MANIFEST } from '@/constants/wasm';
import {
  WASM_NOT_FOUND,
  cleanupOldWasmCache,
  deleteWasmCache,
  instantiateWasmWithCache,
} from '@/workers/utils/wasmLoader';

const ORIGIN = 'https://www.ice-forensic.com';

/** Cache API 최소 구현 (경로 → Response) */
class FakeCache {
  store = new Map<string, Response>();

  private key(input: RequestInfo | URL) {
    const url =
      typeof input === 'string'
        ? input
        : 'url' in input
          ? input.url
          : input.href;
    return new URL(url, ORIGIN).pathname;
  }

  async match(input: RequestInfo | URL) {
    return this.store.get(this.key(input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response) {
    this.store.set(this.key(input), response);
  }

  async delete(input: RequestInfo | URL) {
    return this.store.delete(this.key(input));
  }

  async keys() {
    return [...this.store.keys()].map((path) => new Request(ORIGIN + path));
  }
}

let cache: FakeCache;
let fetchMock: ReturnType<typeof vi.fn>;
let instantiateMock: ReturnType<typeof vi.fn>;

const CORE = WASM_MANIFEST.core;
const wasmResponse = (body = 'wasm') => new Response(body, { status: 200 });

beforeEach(() => {
  cache = new FakeCache();
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  fetchMock = vi.fn(async () => wasmResponse('network'));
  vi.stubGlobal('fetch', fetchMock);
  instantiateMock = vi.fn(async () => ({ instance: {}, module: {} }));
  vi.spyOn(WebAssembly, 'instantiateStreaming').mockImplementation(
    instantiateMock
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('instantiateWasmWithCache', () => {
  it('캐시에 없으면 네트워크에서 받아 캐시에 저장', async () => {
    await instantiateWasmWithCache(CORE, {});

    expect(fetchMock).toHaveBeenCalledWith(CORE, { cache: 'no-cache' });
    expect(cache.store.has(CORE)).toBe(true);
  });

  it('캐시에 있으면 네트워크 요청 없이 사용', async () => {
    await cache.put(CORE, wasmResponse('cached'));

    await instantiateWasmWithCache(CORE, {});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(instantiateMock).toHaveBeenCalledTimes(1);
  });

  it('캐시된 파일이 손상되면 캐시를 지우고 네트워크에서 한 번 더 시도', async () => {
    await cache.put(CORE, wasmResponse('corrupted'));
    instantiateMock.mockRejectedValueOnce(new Error('CompileError'));

    await instantiateWasmWithCache(CORE, {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(instantiateMock).toHaveBeenCalledTimes(2);
  });

  it('방금 받은 파일이 실패하면 재시도하지 않음', async () => {
    instantiateMock.mockRejectedValue(new Error('CompileError'));

    await expect(instantiateWasmWithCache(CORE, {})).rejects.toThrow(
      'CompileError'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('서버에 파일이 없으면(404) WASM_NOT_FOUND', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    await expect(instantiateWasmWithCache(CORE, {})).rejects.toThrow(
      WASM_NOT_FOUND
    );
  });

  it('Cache API를 쓸 수 없는 환경에서도 네트워크로 동작', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn(async () => {
        throw new Error('SecurityError');
      }),
    });

    await instantiateWasmWithCache(CORE, {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(instantiateMock).toHaveBeenCalledTimes(1);
  });
});

describe('deleteWasmCache', () => {
  it('해당 경로의 캐시만 삭제', async () => {
    await cache.put(CORE, wasmResponse());
    await cache.put(WASM_MANIFEST.image, wasmResponse());

    await expect(deleteWasmCache(CORE)).resolves.toBe(true);
    expect([...cache.store.keys()]).toEqual([WASM_MANIFEST.image]);
  });
});

describe('cleanupOldWasmCache', () => {
  it('현재 manifest에 없는 구버전 파일만 삭제', async () => {
    await cache.put('/wasm/ice_core_250101.wasm', wasmResponse());
    await cache.put('/wasm/ice_pe_250101.wasm', wasmResponse());
    for (const path of Object.values(WASM_MANIFEST)) {
      await cache.put(path, wasmResponse());
    }

    await cleanupOldWasmCache();

    expect([...cache.store.keys()].sort()).toEqual(
      Object.values(WASM_MANIFEST).sort()
    );
  });
});
