import styled, { css } from 'styled-components';

/**
 * 모바일에서 로고를 탭하거나 길게 누를 때 브라우저가 그리는 표시를 끔
 * (탭할 때 반투명 상자, 길게 누를 때 선택 영역·메뉴, 끌 때 드래그 미리보기)
 */
const noTouchHighlight = css`
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
`;

export const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--text-gap);
  ${noTouchHighlight}
`;

export const LogoWrapper = styled.div`
  position: relative;
  width: var(--size);
  height: var(--size);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  ${noTouchHighlight}
`;

export const LogoInner = styled.div`
  width: 100%;
  height: 100%;
  background: var(--bg);
  border-radius: var(--corner);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px var(--ice-shadow-light);
  box-sizing: border-box;
`;

export const Star = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: block;

  span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--arm-w);
    height: var(--arm-h);
    background: var(--arm-color);
    border-radius: var(--arm-radius);
    transform-origin: 50% 100%;
  }

  span:nth-child(1) {
    transform: translate(-50%, -100%) rotate(0deg);
  }
  span:nth-child(2) {
    transform: translate(-50%, -100%) rotate(45deg);
  }
  span:nth-child(3) {
    transform: translate(-50%, -100%) rotate(90deg);
  }
  span:nth-child(4) {
    transform: translate(-50%, -100%) rotate(135deg);
  }
  span:nth-child(5) {
    transform: translate(-50%, -100%) rotate(180deg);
  }
  span:nth-child(6) {
    transform: translate(-50%, -100%) rotate(225deg);
  }
  span:nth-child(7) {
    transform: translate(-50%, -100%) rotate(270deg);
  }
  span:nth-child(8) {
    transform: translate(-50%, -100%) rotate(315deg);
  }
`;

export const LogoText = styled.div`
  font-size: var(--text-size);
  font-weight: var(--text-weight);
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  color: var(--text-color);
  letter-spacing: var(--letter-spacing);
  user-select: none;
  line-height: 1;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

/* 얼음 효과 캔버스: 위치와 크기는 LogoFx가 로고 전체에 맞춰 정함 (클릭은 통과) */
export const FxCanvas = styled.canvas`
  position: absolute;
  left: -100%;
  top: -100%;
  width: 300%;
  height: 300%;
  pointer-events: none;
  z-index: 1;
`;
