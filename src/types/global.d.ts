// src/types/global.d.ts
import type {
  WasmDetectTypeFunction,
  WasmExifFunction,
  WasmPeFunction,
  WasmSearchFunction,
  WasmTextChunkFunction,
} from './worker/analysis.worker.types';

export {}; // 이 파일이 모듈임을 선언

declare module '*.glb';
declare module '*.png';

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: Record<string, any>
    ) => void;
    dataLayer: any[];
  }

  interface DedicatedWorkerGlobalScope {
    readBlockSync(
      file: File,
      offset: number,
      length: number
    ): Uint8Array | null;
    // Go WASM이 초기화되면서 등록하는 전역 함수 (등록 전에는 undefined)
    Go?: typeof Go;
    searchFunc?: WasmSearchFunction;
    detectTypeFunc?: WasmDetectTypeFunction;
    exifFunc?: WasmExifFunction;
    textChunkFunc?: WasmTextChunkFunction;
    peFunc?: WasmPeFunction;
  }

  class Go {
    constructor();
    run(instance: WebAssembly.Instance): Promise<void>;
    importObject: WebAssembly.Imports;
    argv: string[];
    env: Record<string, string>;
    exit(code: number): void;
  }
}
