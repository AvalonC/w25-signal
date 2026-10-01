'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef } from 'react';
import { DATE_NEBULA_TIMING, NEBULA_STAR_COUNT, nebulaFrame, nebulaSeed, nebulaStarPoint, type NebulaPoint } from '@/lib/date-nebula';

type Props = {
  elapsed: number;
  paused: boolean;
  pink: boolean;
  reduced: boolean;
  sources?: [NebulaPoint, NebulaPoint];
  radii?: [number, number];
  settled?: boolean;
};

const DEFAULT_SOURCES: [NebulaPoint, NebulaPoint] = [{ x: .25, y: .42 }, { x: .75, y: .54 }];
const DEFAULT_RADII: [number, number] = [.18, .18];
const STARS = Array.from({ length: NEBULA_STAR_COUNT }, (_, index) => ({
  index,
  side: index % 2,
  size: .32 + nebulaSeed(index + 38) * .52,
  bright: index % 29 === 0,
}));

export function DateNebula({ elapsed, paused, pink, reduced, sources = DEFAULT_SOURCES, radii = DEFAULT_RADII, settled = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ elapsed, paused, pink, reduced, sources, radii, settled });
  const wake = useRef<(() => void) | null>(null);
  live.current = { elapsed, paused, pink, reduced, sources, radii, settled };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    let raf = 0, last = 0, shade = live.current.pink ? 1 : 0;
    let width = 0, height = 0, dpr = 1;
    const resize = () => {
      width = c.clientWidth;
      height = c.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width <= 0 || height <= 0) return;
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    const draw = (now: number) => {
      raf = 0;
      const p = live.current;
      if (p.paused || document.hidden) { last = 0; return; }
      if (last && now - last < 1000 / 30) { raf = requestAnimationFrame(draw); return; }
      const dt = last ? Math.min(70, now - last) : 1000 / 30;
      last = now;
      shade += ((p.pink ? 1 : 0) - shade) * (1 - Math.exp(-dt / 380));
      if (!width || !height) resize();
      if (!width || !height) return;
      const time = p.settled ? (p.reduced ? DATE_NEBULA_TIMING.reduced : DATE_NEBULA_TIMING.total) : p.elapsed;
      const state = nebulaFrame(time, p.reduced);
      const unit = Math.min(1.25, Math.max(.9, width / 390));
      const colour = [Math.round(235 + shade * 20), Math.round(242 - shade * 28), Math.round(255 - shade * 15)].join(',');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgb(${colour})`;
      g.strokeStyle = `rgb(${colour})`;
      g.lineCap = 'round';
      for (const star of STARS) {
        const source = p.sources[star.side], radius = p.radii[star.side];
        const point = nebulaStarPoint(star.index, time, source, radius, width, height, p.reduced);
        if (point.alpha < .002) continue;
        if (!p.reduced && point.departure > .015 && point.departure < .99) {
          const tail = nebulaStarPoint(star.index, Math.max(0, time - 90), source, radius, width, height);
          g.globalAlpha = point.alpha * .21;
          g.lineWidth = .45 * unit;
          g.beginPath(); g.moveTo(tail.x, tail.y); g.lineTo(point.x, point.y); g.stroke();
        }
        const quietTwinkle = p.reduced ? 1 : .88 + Math.sin(state.time * .00065 + star.index * 2.7) ** 2 * .12;
        g.globalAlpha = point.alpha * quietTwinkle;
        g.beginPath(); g.arc(point.x, point.y, star.size * unit, 0, Math.PI * 2); g.fill();
        if (star.bright) {
          const reach = (1.5 + star.size) * unit;
          g.globalAlpha = point.alpha * .30;
          g.lineWidth = .4 * unit;
          g.beginPath();
          g.moveTo(point.x - reach, point.y); g.lineTo(point.x + reach, point.y);
          g.moveTo(point.x, point.y - reach); g.lineTo(point.x, point.y + reach);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      // No free-running layer remains behind the completed stone.
      if (!state.done) raf = requestAnimationFrame(draw);
    };
    const start = () => {
      if (live.current.paused || document.hidden) {
        cancelAnimationFrame(raf); raf = 0; last = 0;
      } else if (!raf) raf = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(() => { resize(); start(); });
    observer.observe(c);
    document.addEventListener('visibilitychange', start);
    wake.current = start;
    resize(); start();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', start);
      wake.current = null;
    };
  }, []);

  useEffect(() => { wake.current?.(); }, [paused, elapsed, settled, pink, reduced, sources, radii]);

  return <canvas ref={canvas} className="date-nebula-canvas" aria-hidden="true" />;
}
