export const WASM_MANIFEST = {
  core: '/wasm/ice_core_260616.wasm',
  image: '/wasm/ice_image_260616.wasm',
  pe: '/wasm/ice_pe_260616.wasm',
} as const;

export type WasmType = keyof typeof WASM_MANIFEST;

/**
 * Go WASM 런타임 (wasm_exec.js)
 * Go 버전을 올려 wasm을 다시 빌드하면 쿼리 값도 함께 올려야 브라우저 HTTP 캐시에 남은 구버전 런타임을 쓰지 않음
 */
export const GO_RUNTIME_PATH = '/js/wasm_exec.js?v=go1.25.6';
