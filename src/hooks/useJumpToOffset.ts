import { useCallback } from 'react';
import { useRefs } from '@/contexts/RefContext/RefContext';

/**
 * 헥스 뷰어의 특정 오프셋으로 이동하는 핸들러
 */
export const useJumpToOffset = () => {
  const { searcherRef } = useRefs();

  return useCallback(
    async (offset: number, length: number = 1) => {
      if (!searcherRef?.current || offset < 0) return;
      try {
        await searcherRef.current.findByOffset(offset, length);
      } catch (e) {
        // ignore
      }
    },
    [searcherRef]
  );
};
