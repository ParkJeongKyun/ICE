'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { WorkerManager } from '@/utils/WorkerManager';
import { useProcess } from '@/contexts/ProcessContext/ProcessContext';
import eventBus from '@/types/eventBus';
import { useConfig } from '@/contexts/ConfigContext/ConfigContext';
import { WASM_MANIFEST } from '@/constants/wasm';
import { EngineType } from '@/types/worker/analysis.worker.types';

interface WorkerContextType {
  hashManager: WorkerManager | null; // 제네릭 제거!
  analysisManager: WorkerManager | null; // 제네릭 제거!
  chunkWorker: Worker | null;
  isWasmReady: boolean;
  restartAnalysisWorker: () => void;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

export const WorkerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // ✅ Manager를 State로 관리하여 초기화 직후 리렌더링 유발 (하위 컴포넌트가 null 안 받게)
  const [managers, setManagers] = useState<{
    hashManager: WorkerManager | null; // 제네릭 제거!
    analysisManager: WorkerManager | null; // 제네릭 제거!
    chunkWorker: Worker | null;
  }>({
    hashManager: null,
    analysisManager: null,
    chunkWorker: null,
  });

  const [isWasmReady, setIsWasmReady] = useState(false);
  // 워커가 새로 뜰 때마다(재시작, 타임아웃 후 부활 등) 증가 → 엔진 재로드 트리거
  const [wasmEpoch, setWasmEpoch] = useState(0);

  const {
    startHashProcessing,
    stopHashProcessing,
    startAnalysisProcessing,
    stopAnalysisProcessing,
  } = useProcess();

  const { config } = useConfig();

  // Core WASM 초기화 중 표시 (WASM_READY 또는 실패 시 정확히 한 번만 해제)
  const coreInitPendingRef = useRef(false);
  const beginCoreInit = () => {
    if (coreInitPendingRef.current) return;
    coreInitPendingRef.current = true;
    startAnalysisProcessing();
  };
  const endCoreInit = () => {
    if (!coreInitPendingRef.current) return;
    coreInitPendingRef.current = false;
    stopAnalysisProcessing();
  };

  // ✅ 엔진 동적 로딩 관리
  useEffect(() => {
    if (!isWasmReady || !managers.analysisManager) return;

    const enabledEngines: EngineType[] = [];
    if (config.engines.image.enabled) enabledEngines.push('image');
    if (config.engines.pe) enabledEngines.push('pe');

    enabledEngines.forEach((engineType) => {
      managers.analysisManager
        ?.execute('LOAD_ENGINE', {
          engineType,
          path: WASM_MANIFEST[engineType],
        })
        .then(() => console.log(`[WorkerContext] ${engineType} engine loaded`))
        .catch((err) =>
          console.error(
            `[WorkerContext] Failed to load ${engineType} engine:`,
            err
          )
        );
    });
  }, [
    isWasmReady,
    wasmEpoch,
    managers.analysisManager,
    config.engines.image.enabled,
    config.engines.pe,
  ]);

  useEffect(() => {
    beginCoreInit();

    let hashManager: WorkerManager | null = null; // 제네릭 제거!
    let analysisManager: WorkerManager | null = null; // 제네릭 제거!
    let chunkWorker: Worker | null = null;

    try {
      // 청크 워커만 직접 생성 (스트리밍용)
      const chunkWorkerInstance = new Worker(
        new URL('../../workers/chunk.worker.ts', import.meta.url)
      );

      // Manager 생성 (워커 팩토리 함수 전달)
      hashManager = new WorkerManager(
        () =>
          new Worker(new URL('../../workers/hash.worker.ts', import.meta.url)),
        {
          startProcessing: startHashProcessing,
          stopProcessing: stopHashProcessing,
        }
      );

      analysisManager = new WorkerManager(
        () =>
          new Worker(
            new URL('../../workers/analysis.worker.ts', import.meta.url)
          ),
        {
          startProcessing: startAnalysisProcessing,
          stopProcessing: stopAnalysisProcessing,
        }
      );

      chunkWorker = chunkWorkerInstance;

      // State 업데이트 (리렌더링 트리거)
      setManagers({
        hashManager,
        analysisManager,
        chunkWorker,
      });

      // ---------------------------------------------------------
      // 독립적인 이벤트 리스너 설정 (완벽한 채널 분리)
      // ---------------------------------------------------------

      // ✅ 1. 해시 매니저 전용 이벤트
      if (hashManager) {
        hashManager.events.on('PROGRESS', (data) => {
          eventBus.emit('hashProgress', data);
        });

        hashManager.events.on('DONE', () => {
          eventBus.emit('hashProgress', null);
        });

        // 진행 중 상태는 WorkerManager가 대기 요청 수에 맞춰 관리
        hashManager.events.on('ERROR', (err) => {
          eventBus.emit('toast', { code: err.code }); // 토스트 띄우기
          eventBus.emit('hashProgress', null); // 해시 진행률 0으로
        });
      }

      // ✅ 2. 분석(검색) 매니저 전용 이벤트
      if (analysisManager) {
        analysisManager.events.on('WASM_READY', () => {
          setIsWasmReady(true);
          setWasmEpoch((prev) => prev + 1);
          endCoreInit();
        });

        analysisManager.events.on('PROGRESS', (data) => {
          eventBus.emit('analysisProgress', data);
        });

        analysisManager.events.on('DONE', () => {
          eventBus.emit('analysisProgress', null);
        });

        analysisManager.events.on('ERROR', (err) => {
          eventBus.emit('toast', { code: err.code }); // 토스트 띄우기
          eventBus.emit('analysisProgress', null); // 검색 진행률 0으로
          endCoreInit(); // Core 초기화 실패인 경우 초기화 중 상태 해제
        });
      }

      return () => {
        endCoreInit();
        hashManager?.terminate();
        analysisManager?.terminate();
        chunkWorker?.terminate();
      };
    } catch (error) {
      console.error('[WorkerContext] Failed to create workers:', error);
      endCoreInit();

      // 초기화 실패 에러
      eventBus.emit('toast', {
        code: 'WORKER_CREATION_FAILED',
      });
    }

    // 의존성 배열을 비워서 마운트 시 1회만 실행되도록 함 (안전)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restartAnalysisWorker = () => {
    if (managers.analysisManager) {
      setIsWasmReady(false);
      beginCoreInit();
      managers.analysisManager.restart();
    }
  };

  const value = useMemo(
    () => ({
      hashManager: managers.hashManager,
      analysisManager: managers.analysisManager,
      chunkWorker: managers.chunkWorker,
      isWasmReady,
      restartAnalysisWorker,
    }),
    [managers, isWasmReady]
  );

  return (
    <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>
  );
};

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) throw new Error('useWorker must be used within WorkerProvider');
  return context;
};
