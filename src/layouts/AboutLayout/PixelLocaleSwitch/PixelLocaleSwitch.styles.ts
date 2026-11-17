import styled from 'styled-components';

// 한 칸 크기 (px)
const CELL_PX = 3;
// 손잡이가 오른쪽(EN)으로 갈 때 이동 칸 수
const KNOB_TRAVEL = 13;

export const SwitchButton = styled.button`
  display: block;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;

  svg {
    display: block;
    width: ${30 * CELL_PX}px;
    height: ${13 * CELL_PX}px;
    overflow: visible;
  }

  path,
  rect {
    shape-rendering: crispEdges;
  }

  .track {
    fill: var(--main-line-color);
    transition: fill 0.15s;
  }

  /* 손잡이: 도트 게임처럼 몇 칸씩 끊어지며 이동 */
  .knob {
    transition: transform 0.2s steps(5, end);
  }

  &[data-side='en'] .knob {
    transform: translateX(${KNOB_TRAVEL}px);
  }

  .body {
    fill: var(--ice-main-color);
  }

  .shine {
    fill: #ffffff;
    opacity: 0.55;
  }

  /* 가끔 반짝이는 얼음 */
  .glint {
    fill: #ffffff;
    opacity: 0;
    animation: switch-glint 4s steps(1) infinite;
  }

  .label {
    fill: var(--main-color-reverse);
    transition: fill 0s 0.1s;
  }

  .label.on {
    fill: #ffffff;
  }

  .shards rect {
    fill: var(--ice-main-color);
    opacity: 0;
    animation: switch-shard 0.24s steps(4) 0.16s;
  }

  @media (hover: hover) {
    &:hover .track {
      fill: var(--ice-main-color);
    }

    /* 반대쪽으로 한 칸 기울어 누를 수 있음을 알림 */
    &:hover[data-side='ko'] .knob {
      transform: translateX(1px);
    }

    &:hover[data-side='en'] .knob {
      transform: translateX(${KNOB_TRAVEL - 1}px);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--ice-main-color);
    outline-offset: 3px;
  }

  @keyframes switch-glint {
    0%,
    100% {
      opacity: 0;
    }
    92% {
      opacity: 1;
    }
    96% {
      opacity: 0;
    }
  }

  @keyframes switch-shard {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.4;
      transform: translate(var(--dx), var(--dy));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .knob,
    .label {
      transition: none;
    }

    .glint,
    .shards rect {
      animation: none;
    }
  }
`;
