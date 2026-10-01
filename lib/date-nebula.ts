import { projectSapphire, SAPPHIRE_EDGES, SAPPHIRE_VERTICES, type GemVertex } from './sapphire-shape.ts';

export type NebulaPoint = { x: number; y: number };

export const DATE_NEBULA_TIMING = {
  release: 1800,
  gather: 3800,
  nebula: 5200,
  total: 7800,
  reduced: 1800,
} as const;

export const DATE_NEBULA_CENTER: NebulaPoint = { x: .5, y: .47 };
export const NEBULA_STAR_COUNT = SAPPHIRE_EDGES.length * 9;
export const NEBULA_FACET_ANGLE = .32;
const FACET_SEEDS = SAPPHIRE_EDGES.flatMap(([a, b]) => Array.from({ length: 9 }, (_, index) =>
  SAPPHIRE_VERTICES[a].map((value, axis) => value + (SAPPHIRE_VERTICES[b][axis] - value) * index / 8) as GemVertex));

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
    dialScale: 1,
    nebula: between(time, 700, 2800) * .3 * (1 - between(time, 6500, 7700)),
    resolve: between(time, 3000, 6600),
    etched: between(time, DATE_NEBULA_TIMING.nebula, 7300),
    formation,
    done: time >= DATE_NEBULA_TIMING.total,
  };
}

/** A single shallow arc, without winding around the destination. */
export function nebulaParticlePoint(source: NebulaPoint, progress: number, seed: number, aspect = 1): NebulaPoint {
  const t = smooth(progress), ratio = Math.max(.1, aspect);
  if (t === 0) return { ...source };
  if (t === 1) return { ...DATE_NEBULA_CENTER };
  const dx = DATE_NEBULA_CENTER.x - source.x, dy = (DATE_NEBULA_CENTER.y - source.y) * ratio;
  const bend = Math.sin(Math.PI * t) * (.035 + nebulaSeed(seed + 21) * .045);
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: source.x + dx * t - dy / length * bend,
    y: source.y + dy / ratio * t + dx / length * bend / ratio,
  };
}

/** A still, open star cluster; density varies, but no luminous fog is added. */
export function nebulaCloudPoint(index: number, rotation = 0, contraction = 0): NebulaPoint {
  const arm = index % 3;
  const depth = nebulaSeed(index + 17);
  const radius = (.025 + depth ** .76 * .27) * (1 - clamp(contraction) * .25);
  const angle = arm * Math.PI * 2 / 3 + depth * 2.3 + rotation + (nebulaSeed(index + 6) - .5) * .85;
  return {
    x: DATE_NEBULA_CENTER.x + Math.cos(angle) * radius,
    y: DATE_NEBULA_CENTER.y + Math.sin(angle) * radius * .72,
  };
}

/** Pixel coordinates shared with StarSapphire, including its perspective. */
export function nebulaFacetPoint(index: number, width: number, height: number): NebulaPoint {
  const vertex = FACET_SEEDS[((index % FACET_SEEDS.length) + FACET_SEEDS.length) % FACET_SEEDS.length];
  const point = projectSapphire(vertex, NEBULA_FACET_ANGLE, width, height);
  return { x: point.x, y: point.y };
}

/** Stars lift from the measured circular dial marks, not from the dial center. */
export function nebulaDialPoint(index: number, source: NebulaPoint, radius: number, width: number, height: number): NebulaPoint {
  const mark = Math.floor(index / 2), count = index % 2 ? 62 : 72;
  const angle = (mark % count) * Math.PI * 2 / count - Math.PI / 2;
  const ring = mark < count ? 1 : .87;
  const distance = radius * Math.min(width, height) * ring;
  return { x: source.x * width + Math.cos(angle) * distance, y: source.y * height + Math.sin(angle) * distance };
}

/** One persistent star travels from a dial mark to the cluster and its own facet. */
export function nebulaStarPoint(index: number, elapsed: number, source: NebulaPoint, radius: number, width: number, height: number, reduced = false) {
  const state = nebulaFrame(elapsed, reduced);
  const start = 90 + nebulaSeed(index + 5) * 850;
  const arrive = start + 1600 + nebulaSeed(index + 83) * 650;
  const departure = between(state.time, start, arrive);
  const alpha = between(state.time, start, start + 340) * (1 - between(state.time, 6500, 7700)) * (.32 + nebulaSeed(index + 56) * .53);
  const facet = nebulaFacetPoint(index, width, height);
  if (reduced || state.resolve === 1) return { ...facet, alpha, departure, resolved: state.resolve };
  const origin = nebulaDialPoint(index, source, radius, width, height);
  const cloud = nebulaCloudPoint(index);
  const size = Math.min(width, height);
  const destination = { x: width * .5 + (cloud.x - .5) * size * 1.24, y: height * .47 + (cloud.y - .47) * size * 1.24 };
  const dx = destination.x - origin.x, dy = destination.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  const curve = Math.sin(departure * Math.PI) * size * (.035 + nebulaSeed(index + 21) * .045);
  const flow = { x: origin.x + dx * departure - dy / length * curve, y: origin.y + dy * departure + dx / length * curve };
  return {
    x: flow.x + (facet.x - flow.x) * state.resolve,
    y: flow.y + (facet.y - flow.y) * state.resolve,
    alpha,
    departure,
    resolved: state.resolve,
  };
}
