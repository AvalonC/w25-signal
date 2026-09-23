'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef } from 'react';
import { DATE_NEBULA_TIMING, nebulaCloudPoint, nebulaFrame, nebulaParticlePoint, nebulaSeed, type NebulaPoint } from '@/lib/date-nebula';

type Props = {
  elapsed: number;
  paused: boolean;
  pink: boolean;
  reduced: boolean;
  sources?: [NebulaPoint, NebulaPoint];
  settled?: boolean;
};

const DEFAULT_SOURCES: [NebulaPoint, NebulaPoint] = [{ x: .25, y: .42 }, { x: .75, y: .54 }];
const FLOW = Array.from({ length: 360 }, (_, index) => ({
  index,
  side: index % 2,
  start: 120 + nebulaSeed(index + 5) * 1830,
  duration: 1750 + nebulaSeed(index + 83) * 1050,
  size: .7 + nebulaSeed(index + 38) * 1.25,
  glow: 7 + nebulaSeed(index + 27) * 8,
}));
const CLOUD = Array.from({ length: 220 }, (_, index) => ({
  index,
  size: .55 + nebulaSeed(index + 107) * 1.3,
  alpha: .35 + nebulaSeed(index + 56) * .65,
}));

function makeSprite(pink: boolean, mist = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const g = canvas.getContext('2d')!;
  const glow = g.createRadialGradient(48, 48, 0, 48, 48, 47);
  glow.addColorStop(0, pink ? 'rgba(255,226,245,.9)' : 'rgba(248,250,255,.9)');
  glow.addColorStop(mist ? .28 : .08, pink ? 'rgba(255,175,217,.55)' : 'rgba(232,239,255,.55)');
  glow.addColorStop(mist ? .72 : .38, pink ? 'rgba(230,133,196,.18)' : 'rgba(197,213,246,.18)');
  glow.addColorStop(1, 'rgba(110,130,230,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 96, 96);
  return canvas;
}

export function DateNebula({ elapsed, paused, pink, reduced, sources = DEFAULT_SOURCES, settled = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ elapsed, paused, pink, reduced, sources, settled });
  const wake = useRef<(() => void) | null>(null);
  live.current = { elapsed, paused, pink, reduced, sources, settled };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const white = makeSprite(false), rose = makeSprite(true);
    const whiteMist = makeSprite(false, true), roseMist = makeSprite(true, true);
    let raf = 0, last = 0, drift = 0, shade = live.current.pink ? 1 : 0;
    let width = 0, height = 0, dpr = 1;
    const resize = () => {
      width = c.clientWidth;
      height = c.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width <= 0 || height <= 0) return;
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    const sprite = (x: number, y: number, rx: number, ry: number, alpha: number, mist = false) => {
      if (alpha < .001) return;
      if (shade < .999) {
        g.globalAlpha = alpha * (1 - shade);
        g.drawImage(mist ? whiteMist : white, x - rx, y - ry, rx * 2, ry * 2);
      }
      if (shade > .001) {
        g.globalAlpha = alpha * shade;
        g.drawImage(mist ? roseMist : rose, x - rx, y - ry, rx * 2, ry * 2);
      }
    };
    const core = (x: number, y: number, size: number, alpha: number) => {
      g.globalAlpha = alpha;
      g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
    };
    const draw = (now: number) => {
      raf = 0;
      const p = live.current;
      if (p.paused || document.hidden) { last = 0; return; }
      raf = requestAnimationFrame(draw);
      if (last && now - last < 1000 / 30) return;
      const dt = last ? Math.min(70, now - last) : 1000 / 30;
      last = now;
      drift += p.reduced ? 0 : dt;
      shade += ((p.pink ? 1 : 0) - shade) * (1 - Math.exp(-dt / 380));
      resize();
      if (!width || !height) return;
      const state = nebulaFrame(p.settled ? (p.reduced ? DATE_NEBULA_TIMING.reduced : DATE_NEBULA_TIMING.total) : p.elapsed, p.reduced);
      const size = Math.min(width, height);
      const unit = Math.min(1.35, Math.max(.9, width / 390));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#fff2fc';

      if (!p.settled && state.time < 5000) {
        for (const particle of FLOW) {
          const t = (state.time - particle.start) / particle.duration;
          if (t < 0 || t > 1) continue;
          const envelope = Math.min(1, t * 8) * Math.min(1, (1 - t) * 8);
          if (p.reduced) {
            const source = p.sources[particle.side];
            const a = nebulaSeed(particle.index + 51) * Math.PI * 2;
            const r = .015 + nebulaSeed(particle.index + 12) * .075;
            const x = source.x * width + Math.cos(a) * size * r;
            const y = source.y * height + Math.sin(a) * size * r;
            sprite(x, y, 8 * unit, 8 * unit, envelope * .2);
            core(x, y, particle.size * unit, envelope * .7);
          } else {
            const point = nebulaParticlePoint(p.sources[particle.side], t, particle.index, height / width);
            const x = point.x * width, y = point.y * height;
            sprite(x, y, particle.glow * unit, particle.glow * unit, envelope * .62);
            core(x, y, particle.size * unit, envelope * .95);
          }
        }
      }

      const cloud = state.nebula;
      if (cloud > 0) {
        const rotation = p.reduced ? 0 : drift * .00012;
        // Thin overlapping cloudlets follow three broken spiral arms, leaving a visible dark sky between them.
        for (let i = 0; i < 72; i++) {
          const point = nebulaCloudPoint(i * 7, rotation, state.formation);
          const x = width * .5 + (point.x - .5) * size * 1.32;
          const y = height * .47 + (point.y - .47) * size * 1.32;
          const breath = p.reduced ? 1 : .9 + Math.sin(drift * .0006 + i * 1.7) * .1;
          const spread = size * (.052 + nebulaSeed(i + 36) * .044);
          sprite(x, y, spread, spread * (.36 + nebulaSeed(i + 19) * .27), cloud * .53 * breath, true);
        }
        for (const particle of CLOUD) {
          const point = nebulaCloudPoint(particle.index, rotation, state.formation);
          const x = width * .5 + (point.x - .5) * size * 1.48;
          const y = height * .47 + (point.y - .47) * size * 1.48;
          const twinkle = p.reduced ? 1 : .7 + .3 * Math.sin(drift * .0013 + particle.index * 2.7) ** 2;
          const alpha = cloud * particle.alpha * twinkle;
          sprite(x, y, particle.size * 7 * unit, particle.size * 7 * unit, alpha * .46);
          core(x, y, particle.size * unit, alpha * .95);
          if (particle.index % 17 === 0) {
            sprite(x, y, 14 * unit, 1.8 * unit, alpha * .55);
            sprite(x, y, 1.8 * unit, 11 * unit, alpha * .45);
          }
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
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
    start();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', start);
      wake.current = null;
    };
  }, []);

  useEffect(() => { wake.current?.(); }, [paused]);

  return <canvas ref={canvas} className="date-nebula-canvas" aria-hidden="true" />;
}
