import React, { useEffect, useRef, useState } from 'react';
import { FrostCanvas, LogoArt, LogoBox } from './AsciiArt.styles';
import { useIceFreeze, type IceCell } from '@/hooks/useIceFreeze';

/*
 * ICE 로고를 반 블록 문자(▀▄█)로 그린 아스키 아트
 * 로고와 같은 도형(둥근 사각형 + 8개 팔, Arial "ICE")을 canvas로 그려 변환했다.
 * 한 글자가 세로 2픽셀을 표현하므로 일반 아스키 아트보다 해상도가 두 배.
 *
 * 화면에는 글꼴 대신 SVG 도형으로 그린다.
 * (블록 문자는 기기마다 대체 글꼴로 그려져 폭과 높이가 어긋나므로 모양이 깨짐)
 *
 * - 아이콘 속 별도 같은 반 블록 문자로 채워 흰색으로 그림
 * - 처음 표시될 때: 한 번 도트로 얼어붙었다가 녹음
 * - 마우스를 올리면: 상단 로고처럼 도트로 얼어붙고 고드름에서 물방울이 떨어짐 (useIceFreeze)
 * - 클릭하면: 얼음이 와르르 부서졌다가 다시 얼어붙음
 * - 워드마크 E 위에는 작은 픽셀 강아지가 서 있음 (PixelDog)
 */
const ICON = `  ▄█████████████████████▄
 █████████████████████████
████████████▀▀▀████████████
████████████   ████████████
██████▀  ▀██   ██▀  ▀██████
███████▄   ▀   ▀   ▄███████
█████████         █████████
████▀                 ▀████
████▄                 ▄████
█████████         █████████
███████▀   ▄   ▄   ▀███████
██████▄  ▄██   ██▄  ▄██████
████████████   ████████████
████████████▄▄▄████████████
 █████████████████████████
  ▀█████████████████████▀`;

const WORDMARK = `   ▄▄         ▄▄▄▄▄▄       ▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  ███      ▄████▀▀████▄    ██████████████
  ███    ▄███▀      ▀██▄   ███
  ███    ██▀         ▀██   ███
  ███   ███                ███
  ███   ███                ███▄▄▄▄▄▄▄▄▄▄▄
  ███   ███                █████████████▀
  ███   ███                ███
  ███   ▀██           ██▄  ███
  ███    ███         ▄██▀  ███
  ███     ▀██▄▄    ▄███▀   ███▄▄▄▄▄▄▄▄▄▄▄
  ███      ▀▀████████▀     ███████████████`;

// 아이콘 크기: 16줄, 27칸 (글자 폭 0.6 기준으로 정사각형)
const ICON_LINES = 16;
const ICON_COLS = 27;

// 한 글자 칸 크기 (일반 고정폭 글꼴처럼 폭:높이 = 0.6:1)
const CELL_W = 60;
const CELL_H = 100;
// 줄 경계가 화면 픽셀 한가운데에 걸리면 위아래 줄 모두 그 픽셀을 비워 가는 선이 생기므로
// 각 줄을 아래로 아주 조금 겹쳐 그림 (한 path 안에서 겹친 부분은 진해지지 않음)
const ROW_OVERLAP = 2;
// 아이콘과 워드마크 사이 간격 (글자 2칸)
const GAP_COLS = 2;
const WORDMARK_LINES = 12;
const WORDMARK_COLS = 42;
const WORDMARK_X = (ICON_COLS + GAP_COLS) * CELL_W;
const WORDMARK_Y = ((ICON_LINES - WORDMARK_LINES) / 2) * CELL_H;
const VIEW_W = WORDMARK_X + WORDMARK_COLS * CELL_W;
const VIEW_H = ICON_LINES * CELL_H;

/** 반 블록 문자 → [위 칸 채움, 아래 칸 채움] */
const HALVES: Record<string, [boolean, boolean]> = {
  '█': [true, true],
  '▀': [true, false],
  '▄': [false, true],
};

/**
 * 아스키 아트 문자열을 SVG path로 변환
 * 같은 줄에서 이어지는 칸끼리 사각형으로 합쳐 하나의 path로 그림
 */
function AsciiShape({ text }: { text: string }) {
  let path = '';
  const halfH = CELL_H / 2;

  text.split('\n').forEach((line, row) => {
    ([0, 1] as const).forEach((half) => {
      const y = row * CELL_H + half * halfH;
      let runStart = -1;
      for (let col = 0; col <= line.length; col++) {
        const filled = HALVES[line[col]]?.[half] ?? false;
        if (filled && runStart < 0) runStart = col;
        if (!filled && runStart >= 0) {
          const w = (col - runStart) * CELL_W;
          path += `M${runStart * CELL_W} ${y}h${w}v${halfH + ROW_OVERLAP}h${-w}z`;
          runStart = -1;
        }
      }
    });
  });

  return <path d={path} />;
}

/** 아이콘 둥근 사각형 안쪽의 빈칸(별 모양)을 반 블록 문자로 변환 */
function starArt(icon: string) {
  return icon
    .split('\n')
    .map((line) => {
      const chars = [...line];
      // 위/아래 칸마다 가장 왼쪽~오른쪽 채워진 칸 사이가 사각형 안쪽
      const [top, bottom] = ([0, 1] as const).map((half) => {
        const filled = chars.map((ch) => HALVES[ch]?.[half] ?? false);
        const first = filled.indexOf(true);
        const last = filled.lastIndexOf(true);
        return (col: number) => col > first && col < last && !filled[col];
      });
      return chars
        .map((_, col) => {
          const t = top(col);
          const b = bottom(col);
          return t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
        })
        .join('');
    })
    .join('\n');
}

const STAR = starArt(ICON);

/** 반 블록 한 칸(픽셀)의 높이 (SVG 좌표) */
const PIXEL_H = CELL_H / 2;

/** 아스키 아트의 채워진 반 칸을 얼음 효과의 칸으로 변환 (dx, dy: 칸 단위 위치) */
function asciiCells(
  text: string,
  type: IceCell['type'],
  dx = 0,
  dy = 0
): IceCell[] {
  return text
    .split('\n')
    .flatMap((line, row) =>
      [...line].flatMap((ch, col) =>
        ([0, 1] as const)
          .filter((half) => HALVES[ch]?.[half])
          .map((half) => ({ x: col + dx, y: row * 2 + half + dy, type }))
      )
    );
}

// 얼어붙는 칸: 아이콘 바탕, 별, 워드마크 (강아지는 제외)
const LOGO_CELLS = [
  ...asciiCells(ICON, 1),
  ...asciiCells(STAR, 2),
  ...asciiCells(WORDMARK, 3, WORDMARK_X / CELL_W, WORDMARK_Y / PIXEL_H),
];

/*
 * 워드마크 E 위에 서 있는 작은 픽셀 강아지 (웰시코기를 닮은 우리 집 강아지)
 * 흰 털에 눈과 귀 주변, 등에만 짙은 갈색 무늬가 있음
 * 로고와 같은 픽셀 크기(반 블록 한 칸)로 그려 로고의 일부처럼 보이게 함
 * - 가끔 눈을 깜빡이고 꼬리를 흔듦
 * - 마우스를 올리면 눈을 감고 혀를 내밀며 꼬리를 빠르게 흔들고,
 *   클릭하면 폴짝 뛰며 하트를 띄움
 * 'o' 짙은 갈색 털, 'w' 흰 털, 'k' 눈·코, 't' 혀, '.' 빈칸
 */
const DOG = [
  '..o..o..........',
  '..oo.oo.........',
  '..owoooo........',
  '.wwkoooo........',
  'wwwwwoowwoooowwo',
  'kwwwwwwwwwoowwww',
  '.wwwwwwwwwwwwwww',
  '...wwwwwwwwwwwww',
  '...ww.ww...ww.ww',
];
// 줄 번호별로 바꿔 끼우는 부분
// 눈 감은 얼굴 (깜빡임, 좋아할 때)
const DOG_EYES_CLOSED: Record<number, string> = { 3: '.wkkoooo........' };
// 혀 내민 입
const DOG_TONGUE: Record<number, string> = {
  6: '.ttwwwwwwwwwwwww',
  7: '..twwwwwwwwwwwww',
};
// 흰 꼬리 (오른쪽 한 칸): 위로 든 모양, 내린 모양
const DOG_TAILS: Record<number, string>[] = [
  { 3: 'w', 4: 'w' },
  { 4: 'w', 5: 'w' },
];
const HEART = ['##.##', '#####', '.###.', '..#..'];

const PX_W = CELL_W;
const PX_H = CELL_H / 2;
// 꼬리 한 칸 포함 크기
const DOG_COLS = DOG[0].length + 1;
const DOG_ROWS = DOG.length;
// 오른쪽 끝을 로고 끝에 맞추고, 발이 E 윗면(워드마크 첫 줄 아래 반 칸)에 닿도록 배치
const DOG_X = VIEW_W - DOG_COLS * PX_W;
const DOG_Y = WORDMARK_Y + PX_H - DOG_ROWS * PX_H;

/** 픽셀 문자열에서 ch 칸을 같은 줄끼리 이어 하나의 path로 변환 */
function pixelPath(rows: string[], ch: string) {
  let path = '';
  rows.forEach((line, row) => {
    let runStart = -1;
    for (let col = 0; col <= line.length; col++) {
      const filled = line[col] === ch;
      if (filled && runStart < 0) runStart = col;
      if (!filled && runStart >= 0) {
        const w = (col - runStart) * PX_W;
        path += `M${runStart * PX_W} ${row * PX_H}h${w}v${PX_H + ROW_OVERLAP}h${-w}z`;
        runStart = -1;
      }
    }
  });
  return path;
}

/** 강아지 한 프레임: 기본 그림에 눈, 입, 꼬리를 바꿔 끼움 */
function dogFrame(eyesClosed: boolean, tongue: boolean, tail: number) {
  return DOG.map((line, y) => {
    const row =
      (tongue && DOG_TONGUE[y]) || (eyesClosed && DOG_EYES_CLOSED[y]) || line;
    return row + (DOG_TAILS[tail][y] ?? '.');
  });
}

const DOG_COLORS = ['o', 'w', 'k', 't'];

function PixelDog() {
  const [blink, setBlink] = useState(false);
  const [tail, setTail] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const [jumps, setJumps] = useState(0);
  const heartId = useRef(0);

  // 가끔 눈 깜빡임 (3~6초마다)
  useEffect(() => {
    if (prefersReducedMotion() || hovered) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlink(true);
          timer = setTimeout(() => {
            setBlink(false);
            schedule();
          }, 160);
        },
        3000 + Math.random() * 3000
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [hovered]);

  // 꼬리 흔들기 (마우스를 올리면 빠르게)
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(
      () => setTail((t) => 1 - t),
      hovered ? 180 : 1200
    );
    return () => clearInterval(timer);
  }, [hovered]);

  const rows = dogFrame(blink || hovered, hovered, tail);

  return (
    <g
      className="dog"
      transform={`translate(${DOG_X} ${DOG_Y})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setBlink(false);
      }}
      onClick={(e) => {
        // 로고 클릭(디코딩 재생)과 분리
        e.stopPropagation();
        setJumps((n) => n + 1);
        const id = ++heartId.current;
        setHearts((list) => [...list, id]);
        setTimeout(
          () => setHearts((list) => list.filter((h) => h !== id)),
          900
        );
      }}
    >
      {/* 클릭할 때마다 다시 그려 점프 애니메이션을 처음부터 재생 */}
      <g key={jumps} className={jumps ? 'jump' : undefined}>
        {DOG_COLORS.map((ch) => (
          <path key={ch} className={ch} d={pixelPath(rows, ch)} />
        ))}
      </g>
      {hearts.map((id) => (
        <g key={id} transform={`translate(${3 * PX_W} ${-5 * PX_H})`}>
          <path className="heart" d={pixelPath(HEART, '#')} />
        </g>
      ))}
    </g>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function IceLogoArt() {
  const frostRef = useRef<HTMLCanvasElement>(null);

  useIceFreeze(frostRef, {
    host: (canvas) => canvas.parentElement,
    layout(canvas) {
      const svg = canvas.parentElement?.querySelector('svg');
      if (!svg) return null;
      const boxRect = canvas.parentElement!.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      // SVG 좌표 → 화면 px
      const k = svgRect.width / VIEW_W;
      const uy = PIXEL_H * k;
      // 고드름과 물방울이 그려질 여유
      const pad = 10 * uy;
      return {
        left: svgRect.left - boxRect.left - pad,
        top: svgRect.top - boxRect.top - pad,
        width: svgRect.width + pad * 2,
        height: svgRect.height + pad * 2,
        cells: LOGO_CELLS,
        ux: CELL_W * k,
        uy,
        ox: pad,
        // viewBox가 강아지 자리만큼 위(DOG_Y)에서 시작
        oy: pad - DOG_Y * k,
      };
    },
    // 강아지를 누를 때는 얼음을 부수지 않음
    ignorePress: (target) => !!target.closest('.dog'),
    // 페이지에 들어오면 한 번 얼었다가 녹음
    intro: true,
  });

  return (
    <LogoBox>
      <LogoArt
        viewBox={`0 ${DOG_Y} ${VIEW_W} ${VIEW_H - DOG_Y}`}
        aria-hidden="true"
      >
        <g className="icon">
          <AsciiShape text={ICON} />
          {/* 별도 같은 아스키 아트로 채움 (실제 로고처럼 테마와 관계없이 흰 별) */}
          <g className="star">
            <AsciiShape text={STAR} />
          </g>
        </g>
        <g transform={`translate(${WORDMARK_X} ${WORDMARK_Y})`}>
          <AsciiShape text={WORDMARK} />
        </g>
        <PixelDog />
      </LogoArt>
      <FrostCanvas ref={frostRef} aria-hidden="true" />
    </LogoBox>
  );
}
