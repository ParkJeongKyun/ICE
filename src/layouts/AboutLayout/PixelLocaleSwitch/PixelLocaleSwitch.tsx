'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname, type Locale } from '@/locales/routing';
import { SwitchButton } from './PixelLocaleSwitch.styles';

/*
 * 개발자 소개 페이지 전용 언어 전환 스위치 (로고 아스키 아트와 같은 도트 그림)
 * - 한 칸 = SVG 1단위. 테두리, 얼음 손잡이, 글자를 모두 칸 단위 사각형으로 그림
 * - 마우스를 올리면: 손잡이가 반대쪽으로 한 칸 기울어짐
 * - 누르면: 손잡이가 한 칸씩 끊어지며 미끄러지고, 도착하면 얼음 조각이 튀고 언어가 바뀜
 */

// 4×5 도트 글꼴
const GLYPHS: Record<string, string[]> = {
  K: ['1001', '1010', '1100', '1010', '1001'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  N: ['1001', '1101', '1011', '1001', '1001'],
};

// 스위치 크기 (칸): 테두리 1칸 + 여백 1칸 + 손잡이 13칸 × 2
const W = 30;
const H = 13;
const KNOB_W = 13;
const KNOB_H = 9;
const KNOB_Y = 2;
const KNOB_X = { ko: 2, en: 15 } as const;
// 손잡이가 미끄러진 뒤 언어를 바꿀 때까지 (스타일의 이동 시간보다 조금 길게)
const NAVIGATE_DELAY_MS = 320;

/** 칸 목록 → 칸마다 1×1 사각형인 path */
function cellsPath(cells: [number, number][]) {
  return cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');
}

/** 글자들을 (x, y)부터 한 칸 띄워 도트로 */
function textCells(text: string, x: number, y: number) {
  const cells: [number, number][] = [];
  [...text].forEach((ch, i) => {
    GLYPHS[ch].forEach((row, dy) =>
      [...row].forEach((bit, dx) => {
        if (bit === '1') cells.push([x + i * 5 + dx, y + dy]);
      })
    );
  });
  return cellsPath(cells);
}

/** 모서리를 한 칸씩 깎은 사각형 (도트 그림의 둥근 모서리) */
function roundedRect(x: number, y: number, w: number, h: number) {
  return `M${x + 1} ${y}h${w - 2}v1h1v${h - 2}h-1v1h${-(w - 2)}v-1h-1v${-(h - 2)}h1z`;
}

const TRACK = `${roundedRect(0, 0, W, H)}${roundedRect(1, 1, W - 2, H - 2)}`;
const KNOB = roundedRect(0, 0, KNOB_W, KNOB_H);
// 손잡이 왼쪽 위 반짝임
const SHINE = cellsPath([
  [1, 1],
  [2, 1],
  [1, 2],
]);
const LABELS = {
  ko: textCells('KO', KNOB_X.ko + 2, KNOB_Y + 2),
  en: textCells('EN', KNOB_X.en + 2, KNOB_Y + 2),
};
// 도착할 때 튀는 얼음 조각 방향 (칸 단위, 4의 배수라 4단계로 끊어 움직이면 한 칸씩)
const SHARDS = [
  [-4, -4],
  [0, -8],
  [4, -4],
  [-4, 4],
  [4, 4],
  [8, 0],
  [-8, 0],
];

const PixelLocaleSwitch: React.FC = () => {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // 누른 직후 손잡이가 먼저 움직이도록 화면에 보일 언어를 따로 둠
  const [target, setTarget] = useState<Locale | null>(null);
  const [burst, setBurst] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const shown = target ?? locale;
  const next: Locale = shown === 'ko' ? 'en' : 'ko';

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = () => {
    if (target || isPending) return;
    setTarget(next);
    setBurst((n) => n + 1);
    localStorage.setItem('user-locale', next);
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    timer.current = window.setTimeout(
      () => startTransition(() => router.replace(pathname, { locale: next })),
      reduced ? 0 : NAVIGATE_DELAY_MS
    );
  };

  return (
    <SwitchButton
      type="button"
      onClick={handleClick}
      aria-label={next === 'en' ? 'Switch to English' : '한국어로 변경'}
      lang={next}
      data-side={shown}
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path className="track" d={TRACK} fillRule="evenodd" />
        <g className="knob">
          <g transform={`translate(${KNOB_X.ko} ${KNOB_Y})`}>
            <path className="body" d={KNOB} />
            <path className="shine" d={SHINE} />
            <rect className="glint" x={KNOB_W - 3} y={1} width={1} height={1} />
          </g>
        </g>
        <path className={shown === 'ko' ? 'label on' : 'label'} d={LABELS.ko} />
        <path className={shown === 'en' ? 'label on' : 'label'} d={LABELS.en} />
        {burst > 0 && (
          <g key={burst} className="shards">
            {SHARDS.map(([dx, dy]) => (
              <rect
                key={`${dx},${dy}`}
                // 손잡이 가장자리에서 출발 (손잡이와 같은 색이라 안쪽에서는 안 보임)
                x={KNOB_X[shown] + (KNOB_W - 1) / 2 + Math.sign(dx) * 7}
                y={KNOB_Y + (KNOB_H - 1) / 2 + Math.sign(dy) * 5}
                width={1}
                height={1}
                style={
                  {
                    '--dx': `${dx}px`,
                    '--dy': `${dy}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </g>
        )}
      </svg>
    </SwitchButton>
  );
};

export default PixelLocaleSwitch;
