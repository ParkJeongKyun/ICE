import styled from 'styled-components';

// SF Mono 등 일부 글꼴은 블록 문자 폭이 달라 깨지므로 제외
const MONO = `Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace`;

// 로고 아스키 아트 전체 폭 (아이콘 27 + 간격 + 글자 42 ≈ 72글자)
const LOGO_COLUMNS = 72;

export const LogoArt = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2ch;
  font-family: ${MONO};
  /* 좁은 화면에서는 가로폭에 맞춰 글자 크기를 줄임 */
  font-size: min(7px, calc((100vw - 32px) / ${LOGO_COLUMNS * 0.6}));
  line-height: 1;
  cursor: pointer;
  user-select: none;

  pre {
    margin: 0;
    font: inherit;
    /* 블록 문자 사이에 생기는 얇은 틈을 같은 색으로 메움 */
    /* (글자 크기가 소수점이 되는 모바일에서도 메워지도록 em 단위) */
    text-shadow:
      0.05em 0 currentColor,
      0 0.12em currentColor;
  }

  /* 로고와 같은 색: 아이콘은 강조색, 글자는 본문색 */
  pre:first-child {
    color: var(--ice-icon-bg-color);
  }
`;
