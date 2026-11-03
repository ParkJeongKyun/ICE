import { describe, expect, it } from 'vitest';
import { createStats } from '@/workers/utils';

describe('createStats', () => {
  it('처리 속도(MB/s)와 초 단위 시간을 계산', () => {
    const stats = createStats(
      'id',
      2000,
      4 * 1024 * 1024,
      8 * 1024 * 1024,
      'a'
    );
    expect(stats.durationSec).toBe(2);
    expect(stats.speed).toBe(2);
    expect(stats.processedBytes).toBe(4 * 1024 * 1024);
  });

  it('여러 번 읽어 처리량이 파일 크기를 넘으면 파일 크기로 제한', () => {
    expect(createStats('id', 10, 1980, 990, 'a').processedBytes).toBe(990);
  });

  it('소요 시간이 0이면 속도는 0 (Infinity 방지)', () => {
    expect(createStats('id', 0, 100, 100, 'a').speed).toBe(0);
  });
});
