'use client';

import React, { useEffect, useRef } from 'react';
import { FxCanvas } from './Logo.styles';

/*
 * 로고에 마우스를 올리면 아이콘과 ICE 글자가 왼쪽부터 도트로 얼어붙고 아래로 고드름이 맺힘
 * 다 얼면 고드름 끝에 물방울이 맺혔다가 떨어져 바닥에서 톡 튐
 * 마우스를 떼면 얼음이 녹고, 클릭하면 얼음이 와르르 부서졌다가 다시 얼어붙음
 *
 * 캔버스는 로고 전체 둘레로 아이콘 크기만큼 여유를 두고 겹쳐 그림 (고드름, 물방울이 밖으로 나갈 수 있도록)
 * 도트 느낌이 나도록 초당 15번만 바뀜
 */

type Env = {
  /** 아이콘 크기 (px) */
  s: number;
  /** 아이콘 왼쪽 위 좌표 (캔버스 좌표) */
  ix: number;
  iy: number;
  /** 캔버스 크기 */
  w: number;
  h: number;
  /** 밝은 테마 여부 (밝은 배경에서 흰색이 묻히지 않도록 색을 바꿀 때 사용) */
  light: boolean;
  /** ICE 글자 한 자씩의 글자와 기준선 위치 */
  letters: { ch: string; x: number; baseline: number }[];
  font: string;
};

type Fx = {
  enter(): void;
  leave(): void;
  /** 얼음을 부숨 (클릭) */
  shatter(): void;
  /** 한 프레임을 그리고 계속 그려야 하면 true */
  draw(ctx: CanvasRenderingContext2D, dt: number): boolean;
};

const STEP = 1 / 15;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const randomItem = <T,>(list: T[]) =>
  list[Math.floor(Math.random() * list.length)];

/** Logo와 같은 모양 (둥근 사각형 + 8개 팔, 팔 폭 10% 길이 35%) */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  bg: string,
  star: string
) {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.2);
  ctx.fill();
  ctx.fillStyle = star;
  const w = s * 0.1;
  const h = s * 0.35;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h, w, h, w / 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 캔버스 전체를 u 크기 칸으로 나눠 로고가 있는 칸을 찾음
 * 칸마다 1(아이콘 바탕), 2(별), 3(글자), 칸의 절반 이상이 채워져야 그 칸으로 봄
 */
function logoCells(env: Env, u: number) {
  const K = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(env.w * K);
  canvas.height = Math.ceil(env.h * K);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.scale(K, K);
  // 바탕은 파랑, 별은 빨강, 글자는 초록으로 그려 채널로 구분
  drawIcon(ctx, env.ix, env.iy, env.s, '#0000ff', '#ff0000');
  ctx.font = env.font;
  ctx.fillStyle = '#00ff00';
  for (const l of env.letters) ctx.fillText(l.ch, l.x, l.baseline);
  const { data, width, height } = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const cells: { x: number; y: number; type: number }[] = [];
  for (let gy = 0; gy < Math.ceil(env.h / u); gy++) {
    for (let gx = 0; gx < Math.ceil(env.w / u); gx++) {
      const x0 = Math.floor(gx * u * K);
      const y0 = Math.floor(gy * u * K);
      const x1 = Math.min(width, Math.floor((gx + 1) * u * K));
      const y1 = Math.min(height, Math.floor((gy + 1) * u * K));
      let alpha = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          alpha += data[i + 3];
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
      }
      const count = (x1 - x0) * (y1 - y0);
      if (!count || alpha / (count * 255) < 0.5) continue;
      cells.push({ x: gx, y: gy, type: b >= r && b >= g ? 1 : r >= g ? 2 : 3 });
    }
  }
  return cells;
}

function pixelFreeze(env: Env): Fx {
  const u = env.s / 16;
  const solid = logoCells(env, u);
  if (!solid.length)
    return { enter() {}, leave() {}, shatter() {}, draw: () => false };
  const minX = Math.min(...solid.map((c) => c.x));
  const maxX = Math.max(...solid.map((c) => c.x));

  // 테마별 얼음 색
  // 어두운 배경: 옅은 얼음이 덮여 하얗게 빛남
  // 밝은 배경: 하얀 얼음이 배경에 묻히지 않도록 어두운 배경보다 조금 진한 하늘빛을 섞음
  const color = env.light
    ? {
        icon: 'rgba(255, 255, 255, 0.6)',
        star: 'rgba(205, 235, 250, 0.7)',
        text: '#a8d9f1',
        crust: 'rgba(180, 222, 244, 0.45)',
        icicle: '#a8d9f1',
        tip: '#d9f0fb',
      }
    : {
        icon: 'rgba(225, 246, 255, 0.55)',
        star: 'rgba(150, 215, 245, 0.55)',
        text: 'rgba(191, 230, 247, 0.85)',
        crust: 'rgba(205, 238, 250, 0.6)',
        icicle: '#bfe6f7',
        tip: '#e6f6fd',
      };
  const tint: Record<number, string> = {
    1: color.icon,
    2: color.star,
    3: color.text,
  };

  // 칸마다 얼어붙는 시각 (0~0.9, 왼쪽부터)
  const cells = solid.map((c) => ({
    x: c.x,
    y: c.y,
    color: tint[c.type],
    at: ((c.x - minX) / (maxX - minX + 1)) * 0.7 + Math.random() * 0.2,
  }));
  // 얼음이 로고보다 한 칸 더 바깥까지 덮음 (바로 옆 칸이 언 뒤에 조금 늦게)
  const solidAt = new Map(cells.map((c) => [`${c.x},${c.y}`, c.at]));
  const crust = new Map<string, (typeof cells)[number]>();
  for (const c of solid) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const k = `${x},${y}`;
      if (solidAt.has(k) || crust.has(k)) continue;
      crust.set(k, {
        x,
        y,
        color: color.crust,
        at: (solidAt.get(`${c.x},${c.y}`) ?? 0) + 0.1,
      });
    }
  }
  // 얼음 위의 하얀 결 (로고 위에만 드문드문)
  for (const c of [...cells])
    if (Math.random() < 0.025) cells.push({ ...c, color: '#ffffff' });
  cells.push(...crust.values());

  // 열마다 맨 아랫칸에서 도트 고드름
  const bottoms = new Map<number, (typeof cells)[number]>();
  for (const c of cells)
    if (!bottoms.has(c.x) || bottoms.get(c.x)!.y < c.y) bottoms.set(c.x, c);
  const icicles = [...bottoms.values()]
    .filter(() => Math.random() < 0.35)
    .map((b) => ({
      x: b.x,
      y: b.y + 1,
      len: 1 + Math.floor(Math.random() * 3),
      at: b.at + 0.15,
    }));
  const fullAt = Math.max(
    ...cells.map((c) => c.at),
    ...icicles.map((ic) => ic.at + ic.len * 0.08)
  );
  // 바닥: 가장 긴 고드름보다 조금 아래 (물방울이 튀는 곳)
  const floor = Math.max(...cells.map((c) => c.y)) + 7;

  type Drop = {
    x: number;
    y: number;
    vy: number;
    /** 고드름 끝에 맺혀 부푸는 단계 (0이면 떨어지는 중) */
    swell: number;
  };
  const drops: Drop[] = [];
  const splashes: { x: number; dx: number; life: number }[] = [];
  const shards: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
  }[] = [];

  let active = false;
  let f = 0;
  let acc = 0;
  let nextDrip = 1;
  // 부서진 뒤 다시 얼기 시작할 때까지 남은 시간
  let refreeze = 0;

  /** 지금 보이는 고드름 길이 (얼어붙는 중이면 짧음) */
  const shownLength = (ic: (typeof icicles)[number], p: number) => {
    let n = 0;
    while (n < ic.len && p >= ic.at + n * 0.08) n++;
    return n;
  };

  const tick = () => {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (d.swell > 0) {
        if (++d.swell > 7) d.swell = 0;
        continue;
      }
      // 떨어질수록 빨라짐 (바닥까지 약 1초)
      d.vy = Math.min(d.vy + 0.06, 0.7);
      d.y += d.vy;
      // 바닥에 닿으면 양옆으로 튐
      if (d.y >= floor) {
        splashes.push({ x: d.x, dx: -1, life: 3 }, { x: d.x, dx: 1, life: 3 });
        drops.splice(i, 1);
      }
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].x += splashes[i].dx;
      if (--splashes[i].life <= 0) splashes.splice(i, 1);
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const sh = shards[i];
      sh.x += sh.vx;
      sh.y += sh.vy;
      sh.vy += 0.35;
      if (sh.y * u > env.h) shards.splice(i, 1);
    }
  };

  return {
    enter: () => (active = true),
    leave: () => (active = false),
    shatter() {
      if (f <= 0) return;
      // 지금 언 칸, 고드름, 물방울이 조각이 되어 튀었다가 떨어짐
      const p = Math.floor(f * 15) / 15;
      const pieces = [
        ...cells.filter((c) => p >= c.at),
        ...icicles.flatMap((ic) =>
          Array.from({ length: shownLength(ic, p) }, (_, k) => ({
            x: ic.x,
            y: ic.y + k,
            color: color.icicle,
          }))
        ),
        ...drops.map((d) => ({ x: d.x, y: d.y, color: color.icicle })),
      ];
      for (const c of pieces)
        shards.push({
          x: c.x,
          y: c.y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.2,
          color: c.color,
        });
      f = 0;
      drops.length = 0;
      refreeze = 0.6;
    },
    draw(ctx, dt) {
      refreeze = Math.max(0, refreeze - dt);
      if (!refreeze || !active)
        f = clamp(f + (active ? dt : -dt * 2), 0, fullAt + 1);
      for (acc += dt; acc >= STEP; acc -= STEP) tick();
      const busy = drops.length || splashes.length || shards.length;
      if (f <= 0 && !active && !busy) return false;
      const p = Math.floor(f * 15) / 15;

      for (const c of cells) {
        if (p < c.at) continue;
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x * u, c.y * u, u + 0.3, u + 0.3);
      }
      for (const ic of icicles) {
        const n = shownLength(ic, p);
        for (let k = 0; k < n; k++) {
          const tip = k === n - 1 && n > 1;
          const w = tip ? u * 0.6 : u;
          ctx.fillStyle = tip ? color.tip : color.icicle;
          ctx.fillRect(ic.x * u + (u - w) / 2, (ic.y + k) * u, w, u);
        }
      }

      // 다 얼면 고드름 끝에서 물방울이 가끔 하나씩 생김 (앞 물방울이 떨어진 뒤에만)
      if (active && p >= fullAt && icicles.length && !drops.length) {
        nextDrip -= dt;
        if (nextDrip <= 0) {
          const ic = randomItem(icicles);
          drops.push({ x: ic.x, y: ic.y + ic.len, vy: 0, swell: 1 });
          nextDrip = 2.5 + Math.random() * 2;
        }
      }

      ctx.fillStyle = color.icicle;
      for (const d of drops) {
        const x = d.x * u;
        const y = Math.round(d.y) * u;
        if (d.swell > 0) {
          // 고드름 끝에 맺혀 점점 커짐
          const size = u * (0.3 + d.swell * 0.07);
          ctx.fillRect(x + (u - size) / 2, y, size, size);
        } else {
          ctx.fillRect(x + u * 0.2, y, u * 0.6, u);
          // 빨라지면 위로 꼬리가 늘어짐
          if (d.vy > 0.5) {
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x + u * 0.3, y - u, u * 0.4, u);
            ctx.globalAlpha = 1;
          }
        }
      }
      for (const sp of splashes)
        ctx.fillRect(sp.x * u + u * 0.25, (floor - 1) * u, u * 0.5, u * 0.5);

      for (const sh of shards) {
        ctx.fillStyle = sh.color;
        ctx.fillRect(Math.round(sh.x) * u, Math.round(sh.y) * u, u, u);
      }
      return true;
    },
  };
}

/** CSS 색 문자열의 밝기 (0~1). 해석할 수 없으면 null */
function luminance(color: string) {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** ICE 글자 한 자씩의 위치를 캔버스 좌표로 측정 */
function measureLetters(
  textEl: Element | null,
  ox: number,
  oy: number,
  ctx: CanvasRenderingContext2D,
  font: string
): Env['letters'] {
  const node = textEl?.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  ctx.font = font;
  const ascent = ctx.measureText('ICE').fontBoundingBoxAscent;
  const range = document.createRange();
  return [...(node.textContent ?? '')].map((ch, i) => {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    return { ch, x: r.left - ox, baseline: r.top - oy + ascent };
  });
}

export default function LogoFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !wrapper || !ctx) return;
    // 움직임 줄이기 설정이거나, 마우스가 없는 기기(터치에서는 떼는 동작이 없어 얼음이 남음)에서는 끔
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(hover: hover)').matches
    )
      return;
    // 글자와 함께 있으면 로고 전체 기준 (글자에 마우스를 올려도 효과가 나도록)
    const host = (canvas.closest('[data-logo]') as HTMLElement) ?? wrapper;

    let fx: Fx | null = null;
    let frame = 0;
    let last = 0;

    const setup = () => {
      const hostRect = host.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      const s = wrapRect.width;
      // 캔버스 좌표의 원점 (화면 좌표)
      const ox = hostRect.left - s;
      const oy = hostRect.top - s;
      const w = hostRect.width + s * 2;
      const h = hostRect.height + s * 2;
      Object.assign(canvas.style, {
        left: `${ox - wrapRect.left}px`,
        top: `${oy - wrapRect.top}px`,
        width: `${w}px`,
        height: `${h}px`,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const textEl = host.querySelector('[data-logo-text]');
      const textStyle = textEl ? getComputedStyle(textEl) : null;
      const font = textStyle
        ? `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`
        : '';
      // 글자색(--ice-icon-color)이 어두우면 밝은 테마
      const text = luminance(
        getComputedStyle(wrapper).getPropertyValue('--ice-icon-color')
      );
      fx = pixelFreeze({
        s,
        ix: wrapRect.left - ox,
        iy: wrapRect.top - oy,
        w,
        h,
        light:
          text !== null
            ? text < 0.5
            : !document.documentElement.classList.contains('dark'),
        letters: measureLetters(textEl, ox, oy, ctx, font),
        font,
      });
    };

    const loop = (time: number) => {
      // requestAnimationFrame 시각은 performance.now()보다 이를 수 있어 음수가 되지 않도록
      const dt = clamp((time - last) / 1000, 0, 0.05);
      last = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const running = fx?.draw(ctx, dt) ?? false;
      frame = running ? requestAnimationFrame(loop) : 0;
    };

    const onEnter = () => {
      if (!frame) setup();
      fx?.enter();
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const onLeave = () => fx?.leave();
    const onPress = () => {
      fx?.shatter();
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };

    host.addEventListener('mouseenter', onEnter);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('pointerdown', onPress);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('mouseenter', onEnter);
      host.removeEventListener('mouseleave', onLeave);
      host.removeEventListener('pointerdown', onPress);
    };
  }, []);

  return <FxCanvas ref={canvasRef} aria-hidden="true" />;
}
