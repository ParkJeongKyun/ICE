import { useCallback, useRef, useState, RefObject, useEffect } from 'react';

interface UseHexViewerXScrollProps {
  containerRef: RefObject<HTMLDivElement | null>;
  minHexWidth: number;
}

export const useHexViewerXScroll = ({
  containerRef,
  minHexWidth,
}: UseHexViewerXScrollProps) => {
  // ===== States =====
  const [scrollbarDragging, setScrollbarDragging] = useState(false);
  const [scrollbarState, setScrollbarState] = useState({
    width: 0,
    left: 0,
  });
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // ===== Update Scrollbar State =====
  const updateScrollbarState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    if (minHexWidth <= containerWidth) {
      setScrollbarState({ width: 0, left: 0 });
      return;
    }

    const maxScrollLeft = minHexWidth - containerWidth;
    const scrollbarWidth = Math.max(
      30,
      (containerWidth / minHexWidth) * containerWidth
    );
    const maxScrollbarLeft = containerWidth - scrollbarWidth;
    const scrollbarLeft = Math.min(
      (scrollLeft / maxScrollLeft) * maxScrollbarLeft,
      maxScrollbarLeft
    );

    setScrollbarState({
      width: scrollbarWidth,
      left: scrollbarLeft,
    });
  }, [containerRef, minHexWidth]);

  // 🐛 Fix: minHexWidth(레이아웃) 변경 시 즉시 스크롤바 갱신
  useEffect(() => {
    updateScrollbarState();
  }, [minHexWidth, updateScrollbarState]);

  // ===== Scroll Event Listener =====
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (rafIdRef.current !== null) return; // RAF 중복 방지

      rafIdRef.current = requestAnimationFrame(() => {
        updateScrollbarState();
        rafIdRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [containerRef, updateScrollbarState]);

  // ===== Resize Observer =====
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      updateScrollbarState();

      if (minHexWidth <= container.clientWidth && container.scrollLeft !== 0) {
        container.scrollLeft = 0;
      }
    });

    observer.observe(container);
    updateScrollbarState();

    return () => observer.disconnect();
  }, [containerRef, updateScrollbarState, minHexWidth]);

  // ===== Scrollbar Drag =====
  const handleScrollbarStart = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;

      setScrollbarDragging(true);
      dragStartXRef.current = clientX;
      dragStartScrollRef.current = container.scrollLeft;
      document.body.style.userSelect = 'none';
    },
    [containerRef]
  );

  const handleScrollbarEnd = useCallback(() => {
    setScrollbarDragging(false);
    document.body.style.userSelect = '';
  }, []);

  const handleScrollbarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // e.preventDefault();
      e.stopPropagation();
      handleScrollbarStart(e.clientX);
    },
    [handleScrollbarStart]
  );

  const handleScrollbarTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // e.preventDefault();
      e.stopPropagation();
      if (e.touches.length === 1) {
        handleScrollbarStart(e.touches[0].clientX);
      }
    },
    [handleScrollbarStart]
  );

  const scrollbarDragEffect = useCallback(() => {
    if (!scrollbarDragging) return;

    let rafId: number | null = null;
    let pendingDeltaX: number | null = null;

    const applyScroll = (deltaX: number) => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const maxScrollLeft = minHexWidth - containerWidth;
      const scrollbarWidth = scrollbarState.width;
      const totalScrollable = containerWidth - scrollbarWidth;
      if (totalScrollable <= 0) return;

      const scrollDelta = (deltaX / totalScrollable) * maxScrollLeft;
      container.scrollLeft = Math.max(
        0,
        Math.min(dragStartScrollRef.current + scrollDelta, maxScrollLeft)
      );
    };

    // 프레임마다 가장 최근 위치만 반영 (중간 이벤트는 건너뛰되 마지막 위치는 버리지 않음)
    const updateScroll = (deltaX: number) => {
      pendingDeltaX = deltaX;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pendingDeltaX !== null) applyScroll(pendingDeltaX);
        pendingDeltaX = null;
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateScroll(e.clientX - dragStartXRef.current);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      updateScroll(e.touches[0].clientX - dragStartXRef.current);
    };

    const handleEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // 아직 반영되지 않은 마지막 위치 적용
      if (pendingDeltaX !== null) applyScroll(pendingDeltaX);
      pendingDeltaX = null;
      handleScrollbarEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [
    scrollbarDragging,
    scrollbarState.width,
    containerRef,
    handleScrollbarEnd,
    minHexWidth,
  ]);

  return {
    shouldShowScrollbar: scrollbarState.width > 0,
    scrollbarWidth: scrollbarState.width,
    scrollbarLeft: scrollbarState.left,
    scrollbarDragging,
    handleScrollbarMouseDown,
    handleScrollbarTouchStart,
    scrollbarDragEffect,
  };
};
