import styled from 'styled-components';

// 데스크톱에서의 한 줄 높이 (px). 좁은 화면에서는 가로폭에 맞춰 줄어듦
const LINE_HEIGHT_PX = 7;
// 아이콘 27칸 + 간격 2칸 + 워드마크 42칸, 한 칸 폭 0.6줄
const VIEW_W_LINES = (27 + 2 + 42) * 0.6;

export const LogoArt = styled.svg`
  display: block;
  width: min(${LINE_HEIGHT_PX * VIEW_W_LINES}px, 100%);
  height: auto;
  max-width: 100%;
  fill: var(--main-color);
  cursor: pointer;
  user-select: none;

  /* 로고와 같은 색: 아이콘은 강조색, 글자는 본문색 */
  .icon {
    fill: var(--ice-icon-bg-color);
  }

  /* 블록 그림은 안티앨리어싱 없이 그려 줄 사이에 가는 선이 생기지 않도록 */
  path {
    shape-rendering: crispEdges;
  }

  /* 디코딩 중 표시되는 16진수 글자 */
  text {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 85px; /* 한 칸 높이(100)의 85% */
    font-weight: 700;
    text-anchor: middle;
  }
`;
