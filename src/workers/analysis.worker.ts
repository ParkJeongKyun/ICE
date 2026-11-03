/// <reference lib="webworker" />
import {
  AnalysisWorkerRequest,
  EngineType,
  SearchOptions,
  WasmDetectTypeFunction,
  WasmExifFunction,
  WasmPeFunction,
  WasmSearchFunction,
  WasmTextChunkFunction,
} from '@/types/worker/analysis.worker.types';
import { createStats, calculateProgressInterval } from './utils';
import {
  cleanupOldWasmCache,
  deleteWasmCache,
  instantiateWasmWithCache,
  WASM_NOT_FOUND,
} from './utils/wasmLoader';
import { parseExifDataInWorker } from '@/workers/utils/exifParser';
import { GO_RUNTIME_PATH, WASM_MANIFEST } from '@/constants/wasm';

declare const self: DedicatedWorkerGlobalScope;

/**
 * 분석 가능한 파일 카테고리 정의
 */
const FILE_CATEGORY = {
  IMAGE: 'image',
  PE: 'pe',
  UNKNOWN: 'unknown',
} as const;

type FileCategory = (typeof FILE_CATEGORY)[keyof typeof FILE_CATEGORY];

/**
 * 분석 요청 시 core/엔진 로딩 완료를 기다리는 최대 시간
 * (PROCESS_ANALYSIS 최소 타임아웃 30초보다 충분히 짧아야 함)
 */
const ENGINE_WAIT_MS = 15000;

/** Go WASM이 self에 등록하는 전역 함수 이름 */
type WasmFunctionName =
  | 'searchFunc'
  | 'detectTypeFunc'
  | 'exifFunc'
  | 'textChunkFunc'
  | 'peFunc';

/**
 * 분석 워커 클래스
 * EXIF 파싱, 패턴 검색, WASM 관리
 */
class AnalysisWorker {
  // 📊 [최적화된 로깅] 배열 대신 '단순 숫자 변수'만 사용
  private totalReadCount = 0;
  private totalReadBytes = 0;

  // ✅ 진행률 추적 변수
  private currentFileSize = 0;
  private currentFileName = '';
  private currentRequestId: string | undefined;
  private lastProgressReportBytes = 0;
  private progressReportInterval = 4 * 1024 * 1024;
  private progressStartTime = 0;

  // ✅ FileReaderSync를 사용한 동기 파일 읽기
  private syncReader = new FileReaderSync();

  // WASM 관련 변수
  private coreReady = false;
  private coreLoading: Promise<void> | null = null;
  private engineReady: Record<EngineType, boolean> = {
    image: false,
    pe: false,
  };
  // 엔진별 로딩 Promise (중복 요청 시 같은 로딩을 함께 대기)
  private engineLoading: Partial<Record<EngineType, Promise<void>>> = {};

  private wasmSearchFunc: WasmSearchFunction | null = null;
  private wasmDetectTypeFunc: WasmDetectTypeFunction | null = null;
  private wasmExifFunc: WasmExifFunction | null = null;
  private wasmTextChunkFunc: WasmTextChunkFunction | null = null;
  private wasmPeFunc: WasmPeFunction | null = null;

  /**
   * Go WASM에서 호출할 전역 동기 함수 설정
   */
  setupReadBlockSync(): void {
    const readBlockSync = (
      file: File,
      offset: number,
      length: number
    ): Uint8Array | null => {
      try {
        this.totalReadCount++;

        const blob = file.slice(offset, offset + length);
        const buffer = this.syncReader.readAsArrayBuffer(blob);
        // 요청 길이가 아니라 실제로 읽은 양 (파일 끝을 넘는 요청은 잘림)
        this.totalReadBytes += buffer.byteLength;

        // ✅ 진행률 전송 (동적 간격마다)
        if (this.currentFileSize > 0 && this.currentRequestId !== undefined) {
          const bytesProcessed =
            this.totalReadBytes - this.lastProgressReportBytes;
          if (bytesProcessed >= this.progressReportInterval) {
            this.sendSearchProgress();
            this.lastProgressReportBytes = this.totalReadBytes;
          }
        }

        return new Uint8Array(buffer);
      } catch (e) {
        console.error('[Worker] readBlockSync error:', e);
        return null;
      }
    };
    (
      self as DedicatedWorkerGlobalScope & {
        readBlockSync: typeof readBlockSync;
      }
    ).readBlockSync = readBlockSync;
  }

  /**
   * 진행률 초기화
   */
  private initProgress(
    fileSize: number,
    requestId: string,
    fileName: string = ''
  ): void {
    this.totalReadCount = 0;
    this.totalReadBytes = 0;
    this.lastProgressReportBytes = 0;
    this.currentFileSize = fileSize;
    this.currentFileName = fileName;
    this.currentRequestId = requestId;
    this.progressReportInterval = calculateProgressInterval(fileSize).bytes;
    this.progressStartTime = performance.now();
  }

  /**
   * 검색 진행률 전송 (StandardWorkerResponse 형식)
   */
  private sendSearchProgress(): void {
    const requestId = this.currentRequestId;
    if (requestId === undefined) return;

    const duration = performance.now() - this.progressStartTime;

    self.postMessage({
      status: 'PROGRESS',
      taskType: 'SEARCH_HEX', // or SEARCH_ASCII (taskType은 호출자가 구분하지만, 진행률에서는 크게 중요하지 않음)
      stats: createStats(
        requestId,
        duration,
        this.totalReadBytes,
        this.currentFileSize,
        this.currentFileName
      ),
    });
  }

  /**
   * 특정 전역 함수가 등록될 때까지 대기 (WASM 초기화 확인용)
   */
  private async waitForFunctions(
    fnNames: WasmFunctionName[],
    timeoutMs: number = 10000
  ): Promise<void> {
    const start = Date.now();
    while (fnNames.some((name) => typeof self[name] !== 'function')) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `TIMEOUT: WASM functions not registered: ${fnNames.join(', ')}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Core 초기화를 한 번만 시작하고, 진행 중인 초기화 Promise를 반환
   */
  ensureCore(): Promise<void> {
    if (!this.coreLoading) {
      this.coreLoading = this.initCoreWasm();
    }
    return this.coreLoading;
  }

  /**
   * 엔진 로딩을 한 번만 시작하고, 진행 중이면 같은 Promise를 반환
   * (실패 시 Promise를 제거하여 다음 요청에서 재시도 가능)
   */
  private ensureEngine(
    engineType: EngineType,
    path: string = WASM_MANIFEST[engineType]
  ): Promise<void> {
    if (this.engineReady[engineType]) return Promise.resolve();

    if (!this.engineLoading[engineType]) {
      this.engineLoading[engineType] = this.initEngine(
        engineType,
        path
      ).finally(() => {
        delete this.engineLoading[engineType];
      });
    }
    return this.engineLoading[engineType]!;
  }

  /**
   * Promise를 최대 ms까지 기다림 (완료 시 true, 실패/시간 초과 시 false)
   */
  private async waitWithTimeout(
    promise: Promise<unknown>,
    ms: number
  ): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    });
    try {
      return await Promise.race([
        promise.then(
          () => true,
          () => false
        ),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private isNotFound(error: unknown): boolean {
    return error instanceof Error && error.message === WASM_NOT_FOUND;
  }

  /**
   * Go WASM 로드 → 실행 → 전역 함수 등록 대기 (core/엔진 공통)
   * 실패 시 해당 캐시를 삭제하여 다음 로드 때는 서버에서 새로 받도록 함
   * (인스턴스화는 됐지만 함수 등록이 안 되는 등 캐시된 파일이 현재 코드와 맞지 않는 경우)
   */
  private async runGoWasm(
    path: string,
    fnNames: WasmFunctionName[]
  ): Promise<void> {
    try {
      const go = new self.Go!();
      const result = await instantiateWasmWithCache(path, go.importObject);

      go.run(result.instance).catch((err) =>
        console.error(`[Worker] go.run error (${path}):`, err)
      );

      await this.waitForFunctions(fnNames);
    } catch (error) {
      if (!this.isNotFound(error)) await deleteWasmCache(path);
      throw error;
    }
  }

  /**
   * WASM 초기화 (Core)
   */
  private async initCoreWasm(): Promise<void> {
    try {
      self.importScripts(GO_RUNTIME_PATH);
      if (typeof self.Go !== 'function') {
        throw new Error('Go class not found');
      }

      await this.runGoWasm(WASM_MANIFEST.core, [
        'searchFunc',
        'detectTypeFunc',
      ]);

      this.wasmSearchFunc = self.searchFunc!;
      this.wasmDetectTypeFunc = self.detectTypeFunc!;
      this.coreReady = true;
      self.postMessage({ status: 'WASM_READY' });
    } catch (error) {
      console.error('[Worker] Core WASM init error:', error);
      self.postMessage({
        status: 'ERROR',
        errorCode: this.isNotFound(error) ? 'APP_UPDATED' : 'WASM_LOAD_FAILED',
      });
    }
  }

  /**
   * 엔진 로드 (Image, PE 등)
   */
  async loadEngine(
    id: string,
    engineType: EngineType,
    path: string
  ): Promise<void> {
    try {
      await this.ensureEngine(engineType, path);
      self.postMessage({ id, status: 'SUCCESS', taskType: 'LOAD_ENGINE' });
    } catch (error) {
      console.error(`[Worker] ${engineType} engine init error:`, error);
      self.postMessage({
        id,
        status: 'ERROR',
        taskType: 'LOAD_ENGINE',
        errorCode: this.isNotFound(error)
          ? 'APP_UPDATED'
          : 'ENGINE_LOAD_FAILED',
      });
    }
  }

  /**
   * 엔진 WASM 인스턴스화 및 함수 등록 대기
   */
  private async initEngine(
    engineType: EngineType,
    path: string
  ): Promise<void> {
    if (engineType === 'image') {
      await this.runGoWasm(path, ['exifFunc', 'textChunkFunc']);
      this.wasmExifFunc = self.exifFunc!;
      this.wasmTextChunkFunc = self.textChunkFunc!;
    } else {
      await this.runGoWasm(path, ['peFunc']);
      this.wasmPeFunc = self.peFunc!;
    }
    this.engineReady[engineType] = true;
  }

  /**
   * 분석 직전 엔진 준비 (로딩 중이면 잠시 기다림, 첫 방문 직후 파일을 연 경우 등)
   */
  private async prepareEngine(engineType: EngineType): Promise<boolean> {
    if (!this.engineReady[engineType]) {
      await this.waitWithTimeout(this.ensureEngine(engineType), ENGINE_WAIT_MS);
    }
    return this.engineReady[engineType];
  }

  /**
   * 파일 타입 감지 및 카테고리 분류
   */
  private getFileInfo(
    file: File,
    options?: AnalysisWorkerRequest['options']
  ): { mimeType: string; extension: string; category: FileCategory } {
    let mimeType = options?.mimeType;
    let extension = options?.extension;

    if (!mimeType && this.wasmDetectTypeFunc) {
      const typeResult = this.wasmDetectTypeFunc(file);
      if (typeResult.success && typeResult.data) {
        mimeType = typeResult.data.mimeType;
        extension = typeResult.data.extension;
      }
    }

    mimeType = mimeType || file.type || 'application/octet-stream';
    extension = extension || '';

    let category: FileCategory = FILE_CATEGORY.UNKNOWN;
    if (mimeType.startsWith('image/')) {
      category = FILE_CATEGORY.IMAGE;
    } else if (
      // core(h2non/filetype)는 PE를 vnd.microsoft.portable-executable로 반환
      // (application/x-executable은 ELF의 MIME이므로 PE로 분류하지 않음)
      mimeType === 'application/vnd.microsoft.portable-executable' ||
      mimeType === 'application/x-msdownload' ||
      ['exe', 'dll', 'sys', 'ocx'].includes(extension.toLowerCase())
    ) {
      category = FILE_CATEGORY.PE;
    }

    return { mimeType, extension, category };
  }

  /**
   * JSON 파싱 헬퍼 (WASM 응답 처리용)
   */
  private parseJsonData<T>(data: any): T | undefined {
    if (!data) return undefined;
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[Worker] JSON parsing failed:', e);
      return undefined;
    }
  }

  /**
   * 이미지 파일 분석 로직
   */
  private analyzeImage(
    file: File,
    mimeType: string,
    extension: string,
    options?: AnalysisWorkerRequest['options']
  ) {
    let exifInfo = undefined;
    let textChunkData = undefined;

    const imageOpts = options?.image;

    // EXIF와 textChunk는 독립적이므로 한쪽 실패가 다른 쪽 결과에 영향을 주지 않도록 분리
    if (imageOpts?.exif !== false && this.wasmExifFunc) {
      try {
        const wasmResult = this.wasmExifFunc(file, mimeType, extension);
        if (wasmResult?.success && wasmResult.found) {
          exifInfo = parseExifDataInWorker(wasmResult.data || '{}');
        }
      } catch (e) {
        console.warn('[Worker] EXIF analysis failed:', e);
      }
    }

    if (
      imageOpts?.textChunk !== false &&
      this.wasmTextChunkFunc &&
      mimeType.includes('image/png')
    ) {
      try {
        const pngResponse = this.wasmTextChunkFunc(file, mimeType, extension);
        if (pngResponse?.success && pngResponse.found) {
          textChunkData = this.parseJsonData(pngResponse.data);
        }
      } catch (e) {
        console.warn('[Worker] TextChunk analysis failed:', e);
      }
    }

    return { exifInfo, textChunkData };
  }

  /**
   * PE 파일 분석 로직
   */
  private analyzePe(file: File, mimeType: string, extension: string) {
    let peData = undefined;

    try {
      const wasmResult = this.wasmPeFunc!(file, mimeType, extension);
      if (wasmResult && wasmResult.success && wasmResult.found) {
        peData = this.parseJsonData(wasmResult.data);
      }
    } catch (e) {
      console.warn('[Worker] PE engine analysis failed:', e);
    }

    return { peData };
  }

  /**
   * 파일 분석 (기본 타입 감지 + 선택적 플러그인 분석)
   */
  async processAnalysis(
    id: string,
    file: File,
    options?: AnalysisWorkerRequest['options']
  ): Promise<void> {
    try {
      this.initProgress(file.size, id);

      // 워커 시작 직후라면 core 초기화를 잠시 기다림
      if (!this.coreReady) {
        await this.waitWithTimeout(this.ensureCore(), ENGINE_WAIT_MS);
      }

      if (!this.coreReady || !this.wasmDetectTypeFunc) {
        throw new Error('WASM_NOT_READY');
      }

      const perfStart = performance.now();
      const { mimeType, extension, category } = this.getFileInfo(file, options);

      let analysisResult: any = {
        exifInfo: undefined,
        textChunkData: undefined,
        peData: undefined,
      };

      const engines = {
        core: true, // Core는 항상 사용됨
        image: false,
        pe: false,
      };

      // 활성화된 엔진이 아직 로딩 중이라 분석을 건너뛴 경우
      let engineNotReady = false;

      // 분석 기능 자체가 꺼져있으면 기본 정보만 반환
      if (options?.enabled !== false) {
        switch (category) {
          case FILE_CATEGORY.IMAGE:
            if (options?.image?.enabled === false) break;
            if (!(await this.prepareEngine('image'))) {
              engineNotReady = true;
              break;
            }
            analysisResult = {
              ...analysisResult,
              ...this.analyzeImage(file, mimeType, extension, options),
            };
            engines.image = true;
            break;

          case FILE_CATEGORY.PE:
            if (options?.pe === false) break;
            if (!(await this.prepareEngine('pe'))) {
              engineNotReady = true;
              break;
            }
            analysisResult = {
              ...analysisResult,
              ...this.analyzePe(file, mimeType, extension),
            };
            engines.pe = true;
            break;

          default:
            // 기본 분석 외 추가 작업 없음
            break;
        }
      }

      const duration = performance.now() - perfStart;

      self.postMessage({
        id,
        status: 'SUCCESS',
        taskType: 'PROCESS_ANALYSIS',
        stats: createStats(
          id,
          duration,
          this.totalReadBytes,
          this.currentFileSize,
          file.name
        ),
        data: {
          mimeType,
          extension,
          ...analysisResult,
          engines,
          engineNotReady,
        },
      });
    } catch (error: any) {
      console.error('[Worker] processAnalysis error:', error);
      self.postMessage({
        id,
        status: 'ERROR',
        taskType: 'PROCESS_ANALYSIS',
        errorCode:
          error.message === 'WASM_NOT_READY'
            ? 'WASM_NOT_READY'
            : 'ANALYSIS_ERROR',
      });
    }
  }

  /**
   * WASM 기반 검색 (스트리밍)
   */
  async search(
    id: string,
    file: File,
    pattern: Uint8Array,
    type: 'HEX' | 'ASCII',
    ignoreCase: boolean = false
  ): Promise<void> {
    this.initProgress(file.size, id, file.name);

    if (!this.coreReady || !this.wasmSearchFunc) {
      self.postMessage({
        id,
        status: 'ERROR',
        taskType: type === 'HEX' ? 'SEARCH_HEX' : 'SEARCH_ASCII',
        errorCode: 'WASM_NOT_READY',
      });
      return;
    }

    try {
      const perfStart = performance.now();
      const searchOptions: SearchOptions = {
        ignoreCase: type === 'ASCII' ? ignoreCase : false,
        maxResults: 1000,
      };

      const result = this.wasmSearchFunc(file, pattern, searchOptions);
      const duration = performance.now() - perfStart;

      if (!result.success) {
        throw new Error('SEARCH_WASM_ERROR');
      }

      const parsedIndices: number[] =
        this.parseJsonData<number[]>(result.data) || [];
      const results = parsedIndices.map((idx: number) => ({
        index: idx,
        offset: pattern.length,
      }));

      self.postMessage({
        id,
        status: 'SUCCESS',
        taskType: type === 'HEX' ? 'SEARCH_HEX' : 'SEARCH_ASCII',
        stats: createStats(
          id,
          duration,
          this.totalReadBytes,
          this.currentFileSize,
          file.name
        ),
        data: {
          indices: results,
        },
      });
    } catch (error: any) {
      self.postMessage({
        id,
        status: 'ERROR',
        taskType: type === 'HEX' ? 'SEARCH_HEX' : 'SEARCH_ASCII',
        errorCode:
          error.message === 'SEARCH_WASM_ERROR'
            ? 'SEARCH_WASM_ERROR'
            : 'SEARCH_ERROR',
      });
    }
  }

  /**
   * 메시지 핸들러
   */
  async handle(data: AnalysisWorkerRequest): Promise<void> {
    const { type, id, file, pattern, ignoreCase, engineType, path, options } =
      data;

    switch (type) {
      case 'LOAD_ENGINE':
        if (engineType && path) {
          await this.loadEngine(id, engineType, path);
        }
        break;

      case 'SEARCH_HEX':
      case 'SEARCH_ASCII':
        if (file && pattern) {
          await this.search(
            id,
            file,
            pattern,
            type === 'SEARCH_HEX' ? 'HEX' : 'ASCII',
            ignoreCase
          );
        }
        break;

      case 'PROCESS_ANALYSIS':
        if (file) {
          await this.processAnalysis(id, file, options);
        }
        break;
    }
  }
}

// 전역 에러 핸들러 (StandardWorkerResponse 형식)
self.addEventListener('error', (event) => {
  self.postMessage({
    status: 'ERROR',
    errorCode: 'WORKER_ERROR',
  });
});

self.addEventListener('unhandledrejection', (event) => {
  self.postMessage({
    status: 'ERROR',
    errorCode: 'WORKER_ERROR',
  });
});

// 워커 인스턴스 생성 및 메시지 리스너 등록
const analysisWorker = new AnalysisWorker();
analysisWorker.setupReadBlockSync();
self.addEventListener('message', (e: MessageEvent<AnalysisWorkerRequest>) => {
  analysisWorker.handle(e.data as AnalysisWorkerRequest);
});

// 워커 생성 직후 자동으로 Core WASM 초기화
analysisWorker.ensureCore();

// 현재 버전에 없는 구버전 WASM 캐시 정리 (백그라운드)
cleanupOldWasmCache();
