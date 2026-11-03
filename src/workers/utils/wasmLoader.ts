/**
 * WASM 로딩 및 캐싱 유틸리티
 */

import { WASM_MANIFEST } from '@/constants/wasm';

const CACHE_NAME = 'ice-wasm-cache-v1';

/**
 * 서버에 WASM 파일이 없음 (새 버전 배포로 구버전 파일이 삭제된 경우 등)
 */
export const WASM_NOT_FOUND = 'WASM_NOT_FOUND';
const IS_DEV =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

async function openWasmCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch (error) {
    // 비보안 컨텍스트, 시크릿 모드 등 Cache API 사용 불가 환경
    console.warn('[WasmLoader] Cache API unavailable:', error);
    return null;
  }
}

async function fetchFromNetwork(path: string): Promise<Response> {
  // 브라우저 HTTP 캐시에 남은 구버전 대신 서버와 재검증한 최신 파일을 받음 (변경 없으면 304)
  const response = await fetch(path, { cache: 'no-cache' });
  if (response.status === 404) {
    throw new Error(WASM_NOT_FOUND);
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch WASM from ${path} (HTTP ${response.status})`
    );
  }
  return response;
}

/**
 * Cache API를 사용하여 WASM 파일을 로드하고 캐싱함
 * (캐시 작업이 실패해도 네트워크 응답은 그대로 사용하여 중복 다운로드 방지)
 */
async function fetchWasmWithCache(
  path: string
): Promise<{ response: Response; fromCache: boolean }> {
  const cache = await openWasmCache();

  // 1. 캐시 확인
  if (cache) {
    try {
      const cachedResponse = await cache.match(path);
      if (cachedResponse) {
        if (IS_DEV) console.log(`[WasmLoader] Cache hit: ${path}`);
        return { response: cachedResponse, fromCache: true };
      }
    } catch (error) {
      console.warn('[WasmLoader] Cache match failed:', error);
    }
  }

  if (IS_DEV) console.log(`[WasmLoader] Cache miss, fetching: ${path}`);

  // 2. 네트워크 요청 (실패 시 그대로 throw)
  const response = await fetchFromNetwork(path);

  // 3. 캐시 저장 (실패해도 응답은 반환)
  if (cache) {
    try {
      await cache.put(path, response.clone());
    } catch (error) {
      console.warn('[WasmLoader] Cache put failed:', error);
    }
  }

  return { response, fromCache: false };
}

/**
 * WASM을 로드하여 인스턴스화함
 * 캐시된 파일이 손상되었거나 호환되지 않으면 캐시를 삭제하고 네트워크에서 한 번 더 시도함
 * (방금 네트워크에서 받은 파일이 실패한 경우는 다시 받아도 같으므로 재시도하지 않음)
 */
export async function instantiateWasmWithCache(
  path: string,
  importObject: WebAssembly.Imports
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
  const { response, fromCache } = await fetchWasmWithCache(path);
  try {
    return await WebAssembly.instantiateStreaming(
      Promise.resolve(response),
      importObject
    );
  } catch (error) {
    if (!fromCache) throw error;

    console.warn(
      `[WasmLoader] Cached WASM failed, retrying from network: ${path}`,
      error
    );
    await deleteWasmCache(path);
    const retry = await fetchWasmWithCache(path);
    return WebAssembly.instantiateStreaming(
      Promise.resolve(retry.response),
      importObject
    );
  }
}

/**
 * 특정 WASM 파일의 캐시를 삭제함
 */
export async function deleteWasmCache(path: string): Promise<boolean> {
  const cache = await openWasmCache();
  if (!cache) return false;

  try {
    const result = await cache.delete(path);
    if (IS_DEV)
      console.log(
        `[WasmLoader] Cache deleted for path: ${path}, result: ${result}`
      );
    return result;
  } catch (error) {
    console.error(
      `[WasmLoader] Failed to delete WASM cache for path: ${path}`,
      error
    );
    return false;
  }
}

/**
 * 현재 WASM_MANIFEST에 없는 캐시 삭제
 * (구버전 파일, 이름이 바뀌었거나 비활성화된 상태로 업데이트된 엔진 파일까지 정리)
 * 워커 시작 시 호출됨
 * (꺼둔 엔진만 업데이트되어 새로 받을 파일이 없어도 구버전 캐시가 남지 않도록)
 */
export async function cleanupOldWasmCache(): Promise<void> {
  const cache = await openWasmCache();
  if (!cache) return;

  try {
    const validPaths = new Set<string>(Object.values(WASM_MANIFEST));
    const keys = await cache.keys();

    for (const request of keys) {
      const { pathname } = new URL(request.url);
      if (!validPaths.has(pathname)) {
        if (IS_DEV)
          console.log(`[WasmLoader] Cleaning up old cache: ${pathname}`);
        await cache.delete(request);
      }
    }
  } catch (e) {
    console.warn('[WasmLoader] Cache cleanup failed:', e);
  }
}
