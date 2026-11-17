import { useEffect, useRef, type RefObject } from 'react';

/*
 * 도트 얼음 효과 (상단 로고, 개발자 소개 페이지 아스키 로고에서 사용)
 * 마우스를 올리면 로고 칸이 왼쪽부터 도트로 얼어붙고 아래로 고드름이 맺힘
 * 다 얼면 고드름 끝에 물방울이 맺혔다가 떨어져 바닥에서 톡 튐
 * 마우스를 떼면 얼음이 녹고, 클릭하면 얼음이 와르르 부서졌다가 다시 얼어붙음
 * 마우스가 없는 기기에서는 탭하면 얼고, 얼어 있을 때 다시 탭하면 부서지며, 그대로 두면 잠시 뒤 녹음
 * intro를 켜면 페이지에 들어올 때 한 번 얼었다가 녹음
 * 도트 느낌이 나도록 초당 15번만 바뀜
 */

/** 로고 한 칸: 1(아이콘 바탕), 2(별), 3(글자) */
export type IceCell = { x: number; y: number; type: 1 | 2 | 3 };

export type IceLayout = {
  /** 캔버스 위치와 크기 (캔버스가 들어 있는 요소 기준, px) */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 로고 칸 (칸 단위 좌표) */
  cells: IceCell[];
  /** 한 칸의 크기와 칸 좌표 (0, 0)의 캔버스 위치 (px) */
  ux: number;
  uy: number;
  ox: number;
  oy: number;
};

type IceFx = {
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
const randomItem = <T>(list: T[]) =>
  list[Math.floor(Math.random() * list.length)];

function createIceFreeze(layout: IceLayout, light: boolean): IceFx {
  const solid = layout.cells;
  if (!solid.length)
    return { enter() {}, leave() {}, shatter() {}, draw: () => false };
  const minX = Math.min(...solid.map((c) => c.x));
  const maxX = Math.max(...solid.map((c) => c.x));

  // 테마별 얼음 색
  // 어두운 배경: 옅은 얼음이 덮여 하얗게 빛남
  // 밝은 배경: 하얀 얼음이 배경에 묻히지 않도록 어두운 배경보다 조금 진한 하늘빛을 섞음
  const color = light
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
  const tint = { 1: color.icon, 2: color.star, 3: color.text };

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
  for (const c of cells) {
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
      crust.set(k, { x, y, color: color.crust, at: c.at + 0.1 });
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
      // 물방울이 튀는 바닥까지만 떨어지고 사라짐 (로고 영역 밖으로 흘러내리지 않도록)
      if (sh.y >= floor) shards.splice(i, 1);
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

      // 칸 단위 좌표로 그림 (한 칸 = 1)
      ctx.save();
      ctx.translate(layout.ox, layout.oy);
      ctx.scale(layout.ux, layout.uy);
      // 칸 사이에 가는 틈이 보이지 않도록 살짝 겹침
      const gap = 0.05;

      for (const c of cells) {
        if (p < c.at) continue;
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, 1 + gap, 1 + gap);
      }
      for (const ic of icicles) {
        const n = shownLength(ic, p);
        for (let k = 0; k < n; k++) {
          const tip = k === n - 1 && n > 1;
          const w = tip ? 0.6 : 1;
          ctx.fillStyle = tip ? color.tip : color.icicle;
          ctx.fillRect(ic.x + (1 - w) / 2, ic.y + k, w, 1 + gap);
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
        const y = Math.round(d.y);
        if (d.swell > 0) {
          // 고드름 끝에 맺혀 점점 커짐
          const size = 0.3 + d.swell * 0.07;
          ctx.fillRect(d.x + (1 - size) / 2, y, size, size);
        } else {
          ctx.fillRect(d.x + 0.2, y, 0.6, 1);
          // 빨라지면 위로 꼬리가 늘어짐
          if (d.vy > 0.5) {
            ctx.globalAlpha = 0.5;
            ctx.fillRect(d.x + 0.3, y - 1, 0.4, 1);
            ctx.globalAlpha = 1;
          }
        }
      }
      for (const sp of splashes) ctx.fillRect(sp.x + 0.25, floor - 1, 0.5, 0.5);

      for (const sh of shards) {
        ctx.fillStyle = sh.color;
        ctx.fillRect(Math.round(sh.x), Math.round(sh.y), 1, 1);
      }
      ctx.restore();
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

/** 글자색(--ice-icon-color)이 어두우면 밝은 테마 */
function isLightTheme(el: Element) {
  const text = luminance(
    getComputedStyle(el).getPropertyValue('--ice-icon-color')
  );
  return text !== null
    ? text < 0.5
    : !document.documentElement.classList.contains('dark');
}

type Options = {
  /** 마우스를 올리고 누르는 영역 */
  host: (canvas: HTMLCanvasElement) => HTMLElement | null;
  /** 캔버스 위치와 로고 칸 (마우스를 올릴 때마다 다시 계산) */
  layout: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => IceLayout | null;
  /** 이 요소를 누를 때는 얼음을 부수지 않음 */
  ignorePress?: (target: Element) => boolean;
  /** 페이지에 들어오면 한 번 얼었다가 녹음 */
  intro?: boolean;
};

// 들어온 뒤 얼기 시작할 때까지, 얼기 시작해서 녹기 시작할 때까지 (ms)
const INTRO_DELAY = 400;
const INTRO_HOLD = 2000;
// 터치로 얼린 뒤 저절로 녹기 시작할 때까지 (ms)
const TOUCH_HOLD = 4000;

/** canvas에 도트 얼음 효과를 연결 */
export function useIceFreeze(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: Options
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const host = canvas && optionsRef.current.host(canvas);
    if (!canvas || !ctx || !host) return;
    // 움직임 줄이기 설정이면 끔
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let fx: IceFx | null = null;
    let frame = 0;
    let last = 0;
    let hovering = false;
    // 터치로 얼려 둔 상태 (다음 탭에 부서짐)
    let tapped = false;
    let meltTimer: ReturnType<typeof setTimeout> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const setup = () => {
      const layout = optionsRef.current.layout(canvas, ctx);
      if (!layout) return;
      Object.assign(canvas.style, {
        left: `${layout.left}px`,
        top: `${layout.top}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(layout.width * dpr);
      canvas.height = Math.round(layout.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx = createIceFreeze(layout, isLightTheme(host));
    };

    const loop = (time: number) => {
      // requestAnimationFrame 시각은 performance.now()보다 이를 수 있어 음수가 되지 않도록
      const dt = clamp((time - last) / 1000, 0, 0.05);
      last = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const running = fx?.draw(ctx, dt) ?? false;
      frame = running ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    const freeze = () => {
      if (!frame) setup();
      fx?.enter();
      start();
    };
    const onEnter = () => {
      hovering = true;
      freeze();
    };
    const onLeave = () => {
      hovering = false;
      fx?.leave();
    };
    const ignored = (e: PointerEvent) => {
      const ignore = optionsRef.current.ignorePress;
      return !!ignore && e.target instanceof Element && ignore(e.target);
    };
    const onPress = (e: PointerEvent) => {
      if (ignored(e)) return;
      fx?.shatter();
      start();
    };
    // 마우스가 없는 기기: 탭하면 얼고, 얼어 있을 때 다시 탭하면 부서짐
    const onTap = (e: PointerEvent) => {
      if (ignored(e)) return;
      clearTimeout(meltTimer);
      if (tapped) {
        tapped = false;
        fx?.shatter();
        // 계속 올려 둘 수 없으므로 부서진 뒤 다시 얼지 않음
        fx?.leave();
        start();
        return;
      }
      tapped = true;
      freeze();
      meltTimer = setTimeout(() => {
        tapped = false;
        fx?.leave();
      }, TOUCH_HOLD);
    };

    // 들어오면 한 번 얼었다가 녹음 (그사이 마우스를 올리고 있으면 계속 얼어 있음)
    if (optionsRef.current.intro) {
      timers.push(
        setTimeout(() => {
          freeze();
          timers.push(
            setTimeout(() => !hovering && !tapped && fx?.leave(), INTRO_HOLD)
          );
        }, INTRO_DELAY)
      );
    }

    // 마우스가 없는 기기는 탭으로 동작 (마우스를 올리고 떼는 동작이 없으므로)
    if (!window.matchMedia('(hover: hover)').matches) {
      host.addEventListener('pointerdown', onTap);
      return () => {
        timers.forEach(clearTimeout);
        clearTimeout(meltTimer);
        cancelAnimationFrame(frame);
        host.removeEventListener('pointerdown', onTap);
      };
    }

    host.addEventListener('mouseenter', onEnter);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('pointerdown', onPress);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      host.removeEventListener('mouseenter', onEnter);
      host.removeEventListener('mouseleave', onLeave);
      host.removeEventListener('pointerdown', onPress);
    };
  }, [canvasRef]);
}
