import styled from 'styled-components';

// 데스크톱에서의 한 줄 높이 (px). 좁은 화면에서는 가로폭에 맞춰 줄어듦
const LINE_HEIGHT_PX = 7;
// 아이콘 27칸 + 간격 2칸 + 워드마크 42칸, 한 칸 폭 0.6줄
const VIEW_W_LINES = (27 + 2 + 42) * 0.6;

/* 로고와 얼음 효과 캔버스를 겹치는 상자 */
export const LogoBox = styled.div`
  position: relative;
  width: min(${LINE_HEIGHT_PX * VIEW_W_LINES}px, 100%);
`;

/* 얼음 효과 캔버스: 위치와 크기는 useIceFreeze가 로고에 맞춰 정함 (클릭은 통과) */
export const FrostCanvas = styled.canvas`
  position: absolute;
  pointer-events: none;
  z-index: 1;
`;

export const LogoArt = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  fill: var(--main-color);
  cursor: pointer;
  user-select: none;

  /* 로고와 같은 색: 아이콘은 강조색, 글자는 본문색 */
  .icon {
    fill: var(--ice-icon-bg-color);

    /* 별은 실제 로고처럼 테마와 관계없이 흰색 */
    .star {
      fill: #ffffff;
    }
  }

  /* 블록 그림은 안티앨리어싱 없이 그려 줄 사이에 가는 선이 생기지 않도록 */
  path {
    shape-rendering: crispEdges;
  }

  /* 강아지 (하트가 로고 위로 떠오를 수 있도록 영역 밖도 그림) */
  overflow: visible;

  .dog {
    .o {
      fill: #5c3b2a;
    }
    .w {
      fill: #fffaf3;
    }
    .k {
      fill: #0d0907;
    }
    .t,
    .heart {
      fill: #f47a8f;
    }
  }

  /* 밝은 배경에서는 흰 털이 묻히지 않도록 연한 크림색 */
  html:not(.dark) & .dog .w {
    fill: #eadfd2;
  }

  .dog .jump {
    animation: dog-jump 0.45s ease-out;
  }

  .dog .heart {
    animation: dog-heart 0.9s ease-out forwards;
  }

  @keyframes dog-jump {
    40% {
      transform: translateY(-150px);
    }
  }

  @keyframes dog-heart {
    to {
      transform: translateY(-300px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dog .jump,
    .dog .heart {
      animation: none;
    }
  }
`;
