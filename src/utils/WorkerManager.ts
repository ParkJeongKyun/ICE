import {
  WorkerStats,
  TaskMap,
  StandardWorkerResponse,
  ExecuteResponse,
} from '@/types/worker/index.worker.types';
import { isImageMimeType } from '@/utils/thumbnail';
import mitt, { Emitter } from 'mitt';

export type WorkerEvents = {
  PROGRESS: WorkerStats;
  DONE: {
    type: keyof TaskMap;
    result: TaskMap[keyof TaskMap]['res'];
    stats?: WorkerStats;
  };
  WASM_READY: void;
  ERROR: { code: string };
};

// 사용자 작업이 아닌 백그라운드 작업 (진행 중 상태로 UI를 잠그지 않음)
const BACKGROUND_TASKS = new Set<keyof TaskMap>(['LOAD_ENGINE']);

// UUID v4 랜덤 생성 유틸
function generateUUID(): string {
  return crypto.randomUUID();
}

export class WorkerManager {
  private worker!: Worker;
  private workerFactory: () => Worker; // 워커 생성 함수(레시피) 보관
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: ExecuteResponse<unknown>) => void;
      reject: (reason: Error) => void;
      taskType: keyof TaskMap;
      file?: File; // HEIC/HEIF 썸네일 생성용
    }
  >();

  public events: Emitter<WorkerEvents>;
  private startProcessing?: () => void;
  private stopProcessing?: () => void;
  // ProcessContext에 보고한 진행 중 작업 수 (실제 대기 요청 수와 맞추는 데 사용)
  private reportedBusyCount = 0;

  // 기존 worker: Worker 대신 workerFactory 함수를 받습니다.
  constructor(
    workerFactory: () => Worker,
    callbacks?: {
      startProcessing?: () => void;
      stopProcessing?: () => void;
    }
  ) {
    this.workerFactory = workerFactory;
    this.events = mitt<WorkerEvents>();
    this.startProcessing = callbacks?.startProcessing;
    this.stopProcessing = callbacks?.stopProcessing;

    // 초기 워커 생성
    this.initWorker();
  }

  // 워커 초기화 및 리스너 부착
  private initWorker() {
    this.worker = this.workerFactory();
    this.setupListener();
  }

  // 워커 부활 프로세스 (기존 워커 죽이고 새로 생성)
  private respawnWorker() {
    console.warn('[WorkerManager] Respawning worker...');
    this.worker.terminate();
    this.initWorker(); // 새 워커 생성 후 리스너 다시 연결!
  }

  /**
   * 진행 중 상태를 실제 대기 요청 수와 일치시킴
   * (요청마다 start/stop을 직접 호출하면 경로별로 중복 호출되어 수가 어긋나므로,
   *  pendingRequests를 바꾼 뒤에는 항상 이 메서드로 동기화)
   */
  private syncProcessing() {
    let busyCount = 0;
    this.pendingRequests.forEach((req) => {
      if (!BACKGROUND_TASKS.has(req.taskType)) busyCount++;
    });

    for (; this.reportedBusyCount < busyCount; this.reportedBusyCount++) {
      this.startProcessing?.();
    }
    for (; this.reportedBusyCount > busyCount; this.reportedBusyCount--) {
      this.stopProcessing?.();
    }
  }

  /**
   * 대기 중인 모든 요청을 실패 처리
   */
  private rejectAll(errorCode: string) {
    this.pendingRequests.forEach((req) => {
      req.reject(new Error(errorCode));
    });
    this.pendingRequests.clear();
    this.syncProcessing();
  }

  // 외부에서 워커를 강제로 재시작할 수 있도록 공개 메서드 추가
  public restart(errorCode: string = 'WORKER_RESTARTED') {
    this.rejectAll(errorCode);
    this.respawnWorker();
  }

  private setupListener() {
    // 1️⃣ 메시지 수신 리스너
    this.worker.onmessage = (e: MessageEvent<StandardWorkerResponse>) => {
      const { status, taskType, data, stats, errorCode, id } = e.data;
      const targetId = id ?? stats?.id ?? '';

      switch (status) {
        case 'WASM_READY':
          this.events.emit('WASM_READY');
          break;

        case 'PROGRESS':
          // 모든 워커의 진행률이 여기로 통합됨
          if (stats) {
            this.events.emit('PROGRESS', stats);
          }
          break;

        case 'SUCCESS':
          // 모든 워커의 성공 결과가 여기로 통합됨
          const req = this.pendingRequests.get(targetId);
          if (!req) break; // Request not found (timed out), ignore result

          // EXIF 썸네일 처리는 taskType으로 구분 (isProcessing 유지를 위해 매니저에서 수행)
          if (
            req.taskType === 'PROCESS_ANALYSIS' &&
            data &&
            typeof data === 'object' &&
            'mimeType' in data &&
            isImageMimeType(data.mimeType as string)
          ) {
            this.handleThumbnail(targetId, req, data, stats);
          } else {
            this.resolveRequest(targetId, req, data, stats);
          }
          break;

        case 'ERROR':
          // 모든 워커의 에러가 여기로 통합됨
          const errReq = this.pendingRequests.get(targetId);

          // [수정] 요청 ID가 없더라도(전역 에러) 외부로 ERROR 이벤트를 보냅니다.
          this.events.emit('ERROR', { code: errorCode || 'WORKER_ERROR' });

          if (errReq) {
            errReq.reject(new Error(errorCode || 'Unknown error'));
            this.pendingRequests.delete(targetId);
            this.syncProcessing();
          }
          break;
      }
    };

    // 2️⃣ 치명적 에러 리스너 (onmessage 바깥에 위치)
    // worker.onerror: 워커 스크립트 로딩/초기화 에러 처리
    // HASH_ERROR, SEARCH_ERROR 등의 로직상 에러는 메시지로 옴
    // 하지만 워커 파일이 404이거나 문법 에러가 있으면, self.addEventListener가 실행되기 전에
    // 워커가 뻗어버리므로 메시지가 오지 않고 worker.onerror만 발생함
    this.worker.onerror = (event: ErrorEvent) => {
      console.error('[WorkerManager] Critical Worker Error:', event.message);

      // 대기 중인 모든 요청을 에러 처리
      this.rejectAll(`WORKER_ERROR: ${event.message}`);

      // 컴포넌트에 에러 전파
      this.events.emit('ERROR', {
        code: 'WORKER_ERROR',
      });
    };
  }

  /**
   * 헬퍼: 요청을 즉시 resolve 처리
   */
  private resolveRequest(
    id: string,
    req: {
      resolve: (value: ExecuteResponse<unknown>) => void;
      taskType: keyof TaskMap;
    },
    data: unknown,
    stats?: WorkerStats
  ) {
    req.resolve({ data, stats });
    // 백그라운드 작업 완료로 진행 중인 검색 등의 진행률 표시가 지워지지 않도록 제외
    if (!BACKGROUND_TASKS.has(req.taskType)) {
      this.events.emit('DONE', {
        type: req.taskType,
        result: data as TaskMap[keyof TaskMap]['res'],
        stats,
      });
    }
    this.pendingRequests.delete(id);
    this.syncProcessing();
  }

  /**
   * 헬퍼: EXIF 썸네일 생성 후 resolve 처리
   */
  private handleThumbnail(
    id: string,
    req: {
      resolve: (value: ExecuteResponse<unknown>) => void;
      taskType: keyof TaskMap;
      file?: File;
    },
    data: unknown,
    stats?: WorkerStats
  ) {
    // 타입 가드를 통해 안전하게 속성 접근
    if (
      typeof data === 'object' &&
      data !== null &&
      'exifInfo' in data &&
      'mimeType' in data
    ) {
      const typedData = data as Record<string, any>;
      // 썸네일 처리 (이미지 타입만 메인 스레드에서 생성)
      if (typedData.exifInfo && !typedData.exifInfo.thumbnail && req.file) {
        // 동적 import로 썸네일 생성 함수 로드
        import('@/utils/thumbnail')
          .then(({ generateThumbnailInMainThread }) =>
            generateThumbnailInMainThread(req.file!, typedData.mimeType)
          )
          .then((generatedThumbnail) => {
            if (generatedThumbnail) {
              typedData.exifInfo.thumbnail = generatedThumbnail;
            }
            this.resolveRequest(id, req, typedData, stats);
          })
          .catch((err) => {
            console.error('[WorkerManager] Thumbnail generation failed:', err);
            // 썸네일 생성 실패해도 EXIF 결과는 반환
            this.resolveRequest(id, req, data, stats);
          });
      } else {
        // 썸네일 생성이 필요 없는 경우
        this.resolveRequest(id, req, data, stats);
      }
    } else {
      // data가 예상 형식이 아니면 그냥 반환
      this.resolveRequest(id, req, data, stats);
    }
  }

  // 파일 크기 기반 동적 타임아웃 계산
  // 공식: Timeout = Base Time + (File Size (MB) / Min Speed (MB/s)) × Safety Factor
  // (최대값: 20분)
  private calculateDynamicTimeout(
    taskType: string,
    fileSizeBytes?: number
  ): number {
    // 엔진 로드는 네트워크 다운로드(수~수십 MB) 시간이 포함되므로 넉넉하게
    // (짧으면 저속 회선에서 타임아웃 → 워커 부활 → 엔진 재로드가 반복됨)
    if (taskType === 'LOAD_ENGINE') {
      return 300000; // 5분
    }

    // 파열 크기가 없으면 기본값 사용
    if (!fileSizeBytes || fileSizeBytes <= 0) {
      return 30000; // 기본 대기 시간: 30초
    }

    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    // 작업 타입별 기본값
    // Base Time: 워커 초기화 및 메시지 왕복 비용
    // Min Speed: 저사양 기기에서도 나올 법한 최소 속도
    const config: Record<string, { baseTime: number; minSpeed: number }> = {
      PROCESS_HASH: {
        baseTime: 30000, // 30초
        minSpeed: 5, // MB/s (SHA256)
      },
      PROCESS_ANALYSIS: {
        baseTime: 30000, // 30초
        minSpeed: 10, // MB/s (메모리 I/O)
      },
      SEARCH_HEX: {
        baseTime: 30000, // 30초
        minSpeed: 10, // MB/s (WASM)
      },
      SEARCH_ASCII: {
        baseTime: 30000, // 30초
        minSpeed: 10, // MB/s (WASM)
      },
    };

    const { baseTime, minSpeed } = config[taskType] ?? {
      baseTime: 30000,
      minSpeed: 10,
    };

    // 안전 계수: 2배 (예상치 못한 렉이나 백그라운드 작업 고려)
    const SAFETY_FACTOR = 2;
    // 최대 제한: 20분
    const MAX_TIMEOUT = 20 * 60 * 1000; // 1200000ms

    const calculatedTimeout =
      baseTime + (fileSizeMB / minSpeed) * SAFETY_FACTOR * 1000;

    // 최대값으로 제한
    const finalTimeout = Math.min(calculatedTimeout, MAX_TIMEOUT);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[WorkerManager] Task: ${taskType}, File: ${fileSizeMB.toFixed(2)}MB, Timeout: ${(finalTimeout / 1000).toFixed(1)}s`
      );
    }

    return Math.round(finalTimeout);
  }

  // 최종 응늵 타입은 ExecuteResponse<TaskMap[K]['res']>
  public async execute<K extends keyof TaskMap>(
    type: K,
    payload: TaskMap[K]['req']
  ): Promise<ExecuteResponse<TaskMap[K]['res']>> {
    const id = generateUUID();

    // 타입별 타임아웃 토스트 코드 매핑
    const timeoutCodeMap: Record<string, string> = {
      PROCESS_HASH: 'HASH_TIMEOUT',
      PROCESS_ANALYSIS: 'ANALYSIS_TIMEOUT',
      SEARCH_HEX: 'SEARCH_TIMEOUT',
      SEARCH_ASCII: 'SEARCH_TIMEOUT',
      LOAD_ENGINE: 'ENGINE_LOAD_FAILED',
    };

    const timeoutCode = timeoutCodeMap[type] ?? 'TIMEOUT';

    // 📏 파일 크기 기반 동적 타임아웃 계산
    const fileSizeBytes =
      'file' in payload && payload.file instanceof File
        ? payload.file.size
        : undefined;
    const timeoutMs = this.calculateDynamicTimeout(type, fileSizeBytes);

    return new Promise((resolve, reject) => {
      // 타임아웃 설정 (워커에 취소 신호 전송 + 에러 반환)
      const timeoutId = setTimeout(() => {
        // [수정됨] 해시든 분석이든 타임아웃 걸리면 무조건 하드 종료 후 부활!
        this.respawnWorker();

        // 주요 리소스 정리
        this.pendingRequests.delete(id);

        // 죽은 워커에 남아있던 다른 요청도 정리 (방치 시 나중에 각자 타임아웃되며 새 워커까지 재시작함)
        this.rejectAll('WORKER_RESTARTED');

        // 글로벌 ERROR 이벤트 발행 (WorkerContext가 구독하여 진행률 UI 비움)
        this.events.emit('ERROR', {
          code: timeoutCode,
        });

        // Promise reject (컴포넌트 로딩 상태 해제용)
        reject(new Error(timeoutCode));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutId);
          resolve(value as ExecuteResponse<TaskMap[K]['res']>);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        taskType: type,
        // PROCESS_ANALYSIS인 경우 file 저장 (HEIC/HEIF 썸네일 생성용)
        file:
          'file' in payload && payload.file instanceof File
            ? payload.file
            : undefined,
      });
      this.syncProcessing();
      this.worker.postMessage({ type, id, ...payload });
    });
  }

  /**
   * 현재 진행 중인 작업을 즉시 강제 취소(하드 종료)합니다.
   */
  public cancel(errorCode: string = 'USER_CANCELLED'): void {
    if (this.pendingRequests.size === 0) return;

    this.rejectAll(errorCode);
    this.respawnWorker();
    this.events.emit('ERROR', { code: errorCode });
  }

  public terminate() {
    // 대기 중인 모든 요청을 에러 처리
    this.rejectAll('WORKER_TERMINATED');

    // 워커 종료 및 정리
    this.worker.terminate();
    this.events.all.clear();
  }
}
