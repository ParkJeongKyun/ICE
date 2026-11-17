import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogoArt } from './AsciiArt.styles';

/*
 * ICE 로고를 반 블록 문자(▀▄█)로 그린 아스키 아트
 * 로고와 같은 도형(둥근 사각형 + 8개 팔, Arial "ICE")을 canvas로 그려 변환했다.
 * 한 글자가 세로 2픽셀을 표현하므로 일반 아스키 아트보다 해상도가 두 배.
 *
 * 화면에는 글꼴 대신 SVG 도형으로 그린다.
 * (블록 문자는 기기마다 대체 글꼴로 그려져 폭과 높이가 어긋나므로 모양이 깨짐)
 *
 * - 처음 표시될 때: 16진수 글자가 하나씩 로고로 바뀌는 디코딩 효과
 * - 아이콘 속 별도 같은 반 블록 문자로 채워 흰색으로 그림
 * - 마우스를 올리면: 실제 로고처럼 별이 회전 (각도마다 도형을 다시 그려 변환)
 * - 클릭하면: 디코딩 효과 다시 재생
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
const SUPERSAMPLE = 8;

/** 별을 angle(라디안)만큼 돌린 아이콘을 반 블록 문자로 변환 */
function renderIcon(angle: number) {
  const width = ICON_COLS * SUPERSAMPLE;
  const height = ICON_LINES * 2 * SUPERSAMPLE;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return ICON;

  // 1단위 = 한 줄 높이인 정사각형 좌표계
  const size = ICON_LINES;
  ctx.scale(width / size, height / size);
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // 로고와 같은 8개 팔 (폭 10%, 길이 35%)을 비워 냄
  ctx.globalCompositeOperation = 'destination-out';
  const armWidth = size * 0.1;
  const armLength = size * 0.35;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle + (i * Math.PI) / 4);
    ctx.beginPath();
    ctx.roundRect(-armWidth / 2, -armLength, armWidth, armLength, armWidth / 2);
    ctx.fill();
    ctx.restore();
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  const filled = (x: number, y: number) => {
    let sum = 0;
    for (let j = 0; j < SUPERSAMPLE; j++) {
      for (let i = 0; i < SUPERSAMPLE; i++) {
        const px = x * SUPERSAMPLE + i;
        const py = y * SUPERSAMPLE + j;
        sum += data[(py * width + px) * 4 + 3];
      }
    }
    return sum / (SUPERSAMPLE * SUPERSAMPLE * 255) >= 0.5;
  };

  const lines: string[] = [];
  for (let y = 0; y < ICON_LINES * 2; y += 2) {
    let line = '';
    for (let x = 0; x < ICON_COLS; x++) {
      const top = filled(x, y);
      const bottom = filled(x, y + 1);
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(line.replace(/ +$/, ''));
  }
  return lines.join('\n');
}

// 한 글자 칸 크기 (일반 고정폭 글꼴처럼 폭:높이 = 0.6:1)
// SVG 좌표 단위를 크게 잡아 16진수 글자 크기가 브라우저 최소 글꼴 크기 설정에 걸리지 않도록 함
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
 * 아스키 아트 문자열을 SVG 요소로 변환
 * 블록은 같은 줄에서 이어지는 칸끼리 사각형으로 합쳐 하나의 path로 그림
 * 그 밖의 글자(디코딩 중인 16진수)는 칸 가운데에 글자로 그림
 */
function AsciiShape({ text }: { text: string }) {
  let path = '';
  const chars: React.ReactNode[] = [];
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

    [...line].forEach((ch, col) => {
      if (ch === ' ' || HALVES[ch]) return;
      chars.push(
        <text
          key={`${row}-${col}`}
          x={(col + 0.5) * CELL_W}
          y={row * CELL_H + CELL_H * 0.8}
        >
          {ch}
        </text>
      );
    });
  });

  return (
    <>
      <path d={path} />
      {chars}
    </>
  );
}

/**
 * 아이콘 둥근 사각형 안쪽의 빈칸(별 모양)을 반 블록 문자로 변환
 * 줄 길이를 아이콘과 같게 유지해 글자 위치(디코딩 순서)가 아이콘과 일치하도록 함
 */
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

const HEX_DIGITS = '0123456789ABCDEF';
const randomHex = () => HEX_DIGITS[Math.floor(Math.random() * 16)];

/**
 * 아직 풀리지 않은 글자는 16진수로 표시 (공백은 그대로)
 * blank(i)인 칸은 다른 그림이 그 칸의 16진수를 그리므로 비워 둠
 */
function scramble(
  text: string,
  revealAt: number[],
  elapsed: number,
  blank?: (i: number) => boolean
) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ' || ch === '\n' || elapsed >= revealAt[i]) out += ch;
    else out += blank?.(i) ? ' ' : randomHex();
  }
  return out;
}

const DECODE_MS = 900;
const SPIN_MS = 700;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function IceLogoArt() {
  const [icon, setIcon] = useState(ICON);
  const [star, setStar] = useState(STAR);
  const [word, setWord] = useState(WORDMARK);
  const frameRef = useRef<number | null>(null);
  const spinCache = useRef(new Map<number, { icon: string; star: string }>());

  const stop = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  /** 왼쪽에서 오른쪽으로 (약간씩 불규칙하게) 글자가 풀림 */
  const decode = useCallback(() => {
    if (prefersReducedMotion()) return;
    stop();
    const timing = (text: string) => {
      const lines = text.split('\n');
      const width = Math.max(...lines.map((l) => l.length));
      return lines.flatMap((line, row) =>
        [...line, '\n'].map(
          (_, col) =>
            (col / width) * DECODE_MS * 0.7 +
            Math.random() * DECODE_MS * 0.3 +
            row * 4
        )
      );
    };
    // 아이콘 글자 다음에 워드마크 글자가 이어서 풀리도록 지연
    const iconAt = timing(ICON);
    const wordAt = timing(WORDMARK).map((ms) => ms + DECODE_MS * 0.25);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      // 아이콘과 별이 반씩 걸친 칸(▀▄)은 별 쪽에 16진수를 그려 디코딩 중에도 별이 가늘어 보이지 않게 함
      setIcon(scramble(ICON, iconAt, elapsed, (i) => STAR[i] !== ' '));
      setStar(scramble(STAR, iconAt, elapsed));
      setWord(scramble(WORDMARK, wordAt, elapsed));
      if (elapsed < DECODE_MS * 1.3) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setIcon(ICON);
        setStar(STAR);
        setWord(WORDMARK);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  /** 별 회전: 8방향 대칭이라 45°마다 같은 모양 → 90° 돌리고 원래 모양으로 끝남 */
  const spin = useCallback(() => {
    if (prefersReducedMotion() || frameRef.current !== null) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / SPIN_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      // 1° 단위로 나눠 같은 각도는 다시 그리지 않음
      const degree = Math.round(eased * 90) % 45;
      let frame = spinCache.current.get(degree);
      if (!frame) {
        const rendered = renderIcon((degree * Math.PI) / 180);
        frame = { icon: rendered, star: starArt(rendered) };
        spinCache.current.set(degree, frame);
      }
      setIcon(frame.icon);
      setStar(frame.star);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setIcon(ICON);
        setStar(STAR);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    decode();
    return stop;
  }, [decode]);

  return (
    <LogoArt
      viewBox={`0 ${DOG_Y} ${VIEW_W} ${VIEW_H - DOG_Y}`}
      aria-hidden="true"
      onMouseEnter={(e) => {
        // 강아지에 마우스를 올린 경우는 별을 돌리지 않음
        if (!(e.target as Element).closest('.dog')) spin();
      }}
      onClick={decode}
    >
      <g className="icon">
        <AsciiShape text={icon} />
        {/* 별도 같은 아스키 아트로 채움 (실제 로고처럼 테마와 관계없이 흰 별) */}
        <g className="star">
          <AsciiShape text={star} />
        </g>
      </g>
      <g transform={`translate(${WORDMARK_X} ${WORDMARK_Y})`}>
        <AsciiShape text={word} />
      </g>
      <PixelDog />
    </LogoArt>
  );
}
