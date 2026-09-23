export type NebulaPoint = { x: number; y: number };

export const DATE_NEBULA_TIMING = {
  release: 1800,
  gather: 3800,
  nebula: 5200,
  total: 7800,
  reduced: 1800,
} as const;

export const DATE_NEBULA_CENTER: NebulaPoint = { x: .5, y: .47 };

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const between = (time: number, start: number, end: number) => smooth((time - start) / (end - start));

export function nebulaSeed(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function nebulaFrame(elapsed: number, reduced = false) {
  const duration = reduced ? DATE_NEBULA_TIMING.reduced : DATE_NEBULA_TIMING.total;
  const time = clamp(elapsed / duration) * DATE_NEBULA_TIMING.total;
  const release = between(time, 180, DATE_NEBULA_TIMING.release);
  const formation = between(time, DATE_NEBULA_TIMING.nebula, DATE_NEBULA_TIMING.total);
  return {
    time,
    release,
    gather: between(time, 700, DATE_NEBULA_TIMING.gather),
    dialOpacity: 1 - release,
    dialScale: 1 - release * .13,
    nebula: between(time, 1400, 4200) * (1 - formation * .85),
    formation,
    done: time >= DATE_NEBULA_TIMING.total,
  };
}

/** A broad rotating flow, with exact source and arrival positions in normalized space. */
export function nebulaParticlePoint(source: NebulaPoint, progress: number, seed: number, aspect = 1): NebulaPoint {
  const t = clamp(progress);
  if (t === 0) return { ...source };
  if (t === 1) return { ...DATE_NEBULA_CENTER };
  const ratio = Math.max(.1, aspect);
  const dx = source.x - DATE_NEBULA_CENTER.x;
  const dy = (source.y - DATE_NEBULA_CENTER.y) * ratio;
  const envelope = Math.sin(Math.PI * t);
  const angle = Math.atan2(dy, dx) + (2.3 + nebulaSeed(seed + 21) * 1.2) * t ** 1.25;
  const radius = Math.hypot(dx, dy) * (1 - t) ** 1.1;
  const width = (nebulaSeed(seed + 63) - .5) * .13 * envelope;
  const drift = Math.sin(t * 6 + seed) * .013 * envelope;
  return {
    x: DATE_NEBULA_CENTER.x + Math.cos(angle) * (radius + width) + drift,
    y: DATE_NEBULA_CENTER.y + (Math.sin(angle) * (radius + width) + drift * .6) / ratio,
  };
}

/** Uneven spiral arms leave dark gaps between illuminated dust and cloudlets. */
export function nebulaCloudPoint(index: number, rotation = 0, contraction = 0): NebulaPoint {
  const arm = index % 3;
  const depth = nebulaSeed(index + 17);
  const radius = (.018 + depth ** .7 * .2) * (1 - clamp(contraction) * .32);
  const angle = arm * Math.PI * 2 / 3 + depth * 4.5 + rotation + (nebulaSeed(index + 6) - .5) * .7;
  return {
    x: DATE_NEBULA_CENTER.x + Math.cos(angle) * radius,
    y: DATE_NEBULA_CENTER.y + Math.sin(angle) * radius * .64,
  };
}
