'use client';

import React, { useRef } from 'react';
import { FxCanvas } from './Logo.styles';
import { useIceFreeze, type IceCell } from '@/hooks/useIceFreeze';

/*
 * 로고에 마우스를 올리면 아이콘과 ICE 글자가 도트로 얼어붙는 효과 (useIceFreeze 참고)
 * 화면에 그려진 로고를 칸으로 나눠 얼릴 칸을 찾음
 * 캔버스는 로고 전체 둘레로 아이콘 크기만큼 여유를 두고 겹쳐 그림 (고드름, 물방울이 밖으로 나갈 수 있도록)
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
  /** ICE 글자 한 자씩의 글자와 기준선 위치 */
  letters: { ch: string; x: number; baseline: number }[];
  font: string;
};

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
 * 칸의 절반 이상이 채워져야 그 칸으로 봄
 */
function logoCells(env: Env, u: number): IceCell[] {
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

  const cells: IceCell[] = [];
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

/** 글자와 함께 있으면 로고 전체 기준 (글자에 마우스를 올려도 효과가 나도록) */
const hostOf = (canvas: HTMLCanvasElement) =>
  (canvas.closest('[data-logo]') as HTMLElement | null) ?? canvas.parentElement;

export default function LogoFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useIceFreeze(canvasRef, {
    host: hostOf,
    layout(canvas, ctx) {
      const wrapper = canvas.parentElement;
      const host = hostOf(canvas);
      if (!wrapper || !host) return null;
      const hostRect = host.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      const s = wrapRect.width;
      // 캔버스 좌표의 원점 (화면 좌표)
      const ox = hostRect.left - s;
      const oy = hostRect.top - s;
      const w = hostRect.width + s * 2;
      const h = hostRect.height + s * 2;

      const textEl = host.querySelector('[data-logo-text]');
      const textStyle = textEl ? getComputedStyle(textEl) : null;
      const font = textStyle
        ? `${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`
        : '';
      // 아이콘이 16칸이 되는 크기로 나눔
      const u = s / 16;
      return {
        left: ox - wrapRect.left,
        top: oy - wrapRect.top,
        width: w,
        height: h,
        cells: logoCells(
          {
            s,
            ix: wrapRect.left - ox,
            iy: wrapRect.top - oy,
            w,
            h,
            letters: measureLetters(textEl, ox, oy, ctx, font),
            font,
          },
          u
        ),
        ux: u,
        uy: u,
        ox: 0,
        oy: 0,
      };
    },
  });

  return <FxCanvas ref={canvasRef} aria-hidden="true" />;
}
