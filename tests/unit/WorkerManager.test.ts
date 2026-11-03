import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WASM_MANIFEST } from '@/constants/wasm';
import { WorkerManager } from '@/utils/WorkerManager';

/** postMessage를 기록하고, 테스트에서 워커 응답을 흉내 낼 수 있는 가짜 워커 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  posted: { type: string; id: string }[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: { type: string; id: string }) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data: Record<string, unknown>) {
    this.onmessage?.({ data } as MessageEvent);
  }

  lastId() {
    return this.posted[this.posted.length - 1].id;
  }
}

const latestWorker = () =>
  FakeWorker.instances[FakeWorker.instances.length - 1];

function createManager() {
  const startProcessing = vi.fn();
  const stopProcessing = vi.fn();
  const manager = new WorkerManager(
    () => new FakeWorker() as unknown as Worker,
    { startProcessing, stopProcessing }
  );
  return { manager, startProcessing, stopProcessing };
}

const hashPayload = () => ({
  file: new File(['abc'], 'a.bin'),
  hashType: 'sha256' as const,
});

beforeEach(() => {
  FakeWorker.instances = [];
  // 재시작/오류 로그는 의도된 동작이므로 출력하지 않음
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('처리 중 상태 (startProcessing / stopProcessing)', () => {
  it('일반 작업은 시작과 완료 시 정확히 한 번씩 호출', async () => {
    const { manager, startProcessing, stopProcessing } = createManager();
    const done = vi.fn();
    manager.events.on('DONE', done);

    const promise = manager.execute('PROCESS_HASH', hashPayload());
    expect(startProcessing).toHaveBeenCalledTimes(1);

    const worker = latestWorker();
    worker.reply({ status: 'SUCCESS', id: worker.lastId(), data: 'hash' });

    await expect(promise).resolves.toMatchObject({ data: 'hash' });
    expect(stopProcessing).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('작업 실패 시에도 한 번만 해제하고 ERROR 이벤트 발행', async () => {
    const { manager, stopProcessing } = createManager();
    const onError = vi.fn();
    manager.events.on('ERROR', onError);

    const promise = manager.execute('PROCESS_HASH', hashPayload());
    const worker = latestWorker();
    worker.reply({
      status: 'ERROR',
      id: worker.lastId(),
      errorCode: 'HASH_ERROR',
    });

    await expect(promise).rejects.toThrow('HASH_ERROR');
    expect(stopProcessing).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ code: 'HASH_ERROR' });
  });

  it('동시에 진행 중인 작업이 모두 끝나야 처리 중 상태가 풀림', async () => {
    const { manager, startProcessing, stopProcessing } = createManager();

    const first = manager.execute('PROCESS_HASH', hashPayload());
    const firstId = latestWorker().lastId();
    const second = manager.execute('PROCESS_HASH', hashPayload());
    const secondId = latestWorker().lastId();
    expect(startProcessing).toHaveBeenCalledTimes(2);

    latestWorker().reply({ status: 'SUCCESS', id: firstId, data: 1 });
    await first;
    expect(stopProcessing).toHaveBeenCalledTimes(1);

    latestWorker().reply({ status: 'SUCCESS', id: secondId, data: 2 });
    await second;
    expect(stopProcessing).toHaveBeenCalledTimes(2);
  });

  it('엔진 로드(백그라운드 작업)는 UI를 잠그지 않고 DONE도 보내지 않음', async () => {
    const { manager, startProcessing, stopProcessing } = createManager();
    const done = vi.fn();
    manager.events.on('DONE', done);

    const promise = manager.execute('LOAD_ENGINE', {
      engineType: 'image',
      path: WASM_MANIFEST.image,
    });
    const worker = latestWorker();
    worker.reply({ status: 'SUCCESS', id: worker.lastId(), data: true });

    await promise;
    expect(startProcessing).not.toHaveBeenCalled();
    expect(stopProcessing).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
});

describe('타임아웃 / 취소', () => {
  it('타임아웃 시 워커를 재시작하고 남은 요청까지 모두 실패 처리', async () => {
    vi.useFakeTimers();
    const { manager, startProcessing, stopProcessing } = createManager();
    const onError = vi.fn();
    manager.events.on('ERROR', onError);

    const hash = manager.execute('PROCESS_HASH', hashPayload());
    const engine = manager.execute('LOAD_ENGINE', {
      engineType: 'pe',
      path: WASM_MANIFEST.pe,
    });
    const firstWorker = latestWorker();
    const hashResult = expect(hash).rejects.toThrow('HASH_TIMEOUT');
    const engineResult = expect(engine).rejects.toThrow('WORKER_RESTARTED');

    // 해시 타임아웃(30초 + 파일 크기 비례)이 엔진 로드(5분)보다 먼저 발생
    await vi.advanceTimersByTimeAsync(31_000);

    await hashResult;
    await engineResult;
    expect(firstWorker.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(onError).toHaveBeenCalledWith({ code: 'HASH_TIMEOUT' });
    expect(startProcessing).toHaveBeenCalledTimes(1);
    expect(stopProcessing).toHaveBeenCalledTimes(1);
  });

  it('타임아웃된 요청의 늦은 응답은 무시', async () => {
    vi.useFakeTimers();
    const { manager } = createManager();
    const done = vi.fn();
    manager.events.on('DONE', done);

    const hash = manager.execute('PROCESS_HASH', hashPayload());
    const staleWorker = latestWorker();
    const staleId = staleWorker.lastId();
    const result = expect(hash).rejects.toThrow('HASH_TIMEOUT');
    await vi.advanceTimersByTimeAsync(31_000);
    await result;

    staleWorker.reply({ status: 'SUCCESS', id: staleId, data: 'late' });
    expect(done).not.toHaveBeenCalled();
  });

  it('cancel은 대기 요청을 실패 처리하고 워커를 재시작', async () => {
    const { manager, stopProcessing } = createManager();
    const hash = manager.execute('PROCESS_HASH', hashPayload());
    const result = expect(hash).rejects.toThrow('USER_CANCELLED');

    manager.cancel();

    await result;
    expect(stopProcessing).toHaveBeenCalledTimes(1);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('대기 요청이 없으면 cancel은 아무것도 하지 않음', () => {
    const { manager } = createManager();
    manager.cancel();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('워커 스크립트 오류(onerror) 시 모든 요청 실패 처리', async () => {
    const { manager, stopProcessing } = createManager();
    const hash = manager.execute('PROCESS_HASH', hashPayload());
    const result = expect(hash).rejects.toThrow('WORKER_ERROR');

    latestWorker().onerror?.({ message: 'boom' } as ErrorEvent);

    await result;
    expect(stopProcessing).toHaveBeenCalledTimes(1);
  });
});
