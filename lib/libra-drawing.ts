import { SAPPHIRE_VERTICES, type GemPoint, type GemVertex } from './sapphire-shape.ts';

type LibraStroke = readonly GemVertex[];
const vertex = (index: number): GemVertex => SAPPHIRE_VERTICES[index];
const between = (a: GemVertex, b: GemVertex, amount: number): GemVertex => a.map((value, axis) => value + (b[axis] - value) * amount) as GemVertex;
const crown: GemVertex = [0, vertex(0)[1], 0];
const tip = vertex(16);

// Every stroke belongs to the table, a shoulder, or an existing pavilion face.
// Opposite crown vertices carry the two pans; the culet is also their pedestal.
const pan = (index: number) => {
  const center = vertex(index), previous = vertex(8 + (index - 9 + 8) % 8), next = vertex(8 + (index - 7) % 8);
  const left = between(center, previous, .16), right = between(center, next, .16);
  const bottom = between(center, tip, .17);
  return { rim: [left, center, right], bowl: [left, bottom, right], bottom };
};
const leftPan = pan(9), rightPan = pan(13);
const footLeft = between(tip, vertex(8), .17), footCenter = between(tip, vertex(15), .17), footRight = between(tip, vertex(14), .17);

export const LIBRA_FACET_GEOMETRY = {
  beams: [[crown, vertex(1)], [crown, vertex(5)]],
  hangers: [[vertex(1), vertex(9)], [vertex(5), vertex(13)]],
  panRims: [leftPan.rim, rightPan.rim],
  panBowls: [leftPan.bowl, rightPan.bowl],
  axis: [crown, vertex(7), vertex(15), tip],
  base: [footLeft, footCenter, footRight, tip, footLeft],
  stars: [vertex(1), crown, vertex(5), vertex(9), vertex(13)],
  sign: between(crown, vertex(7), .46),
} satisfies {
  beams: LibraStroke[]; hangers: LibraStroke[]; panRims: LibraStroke[]; panBowls: LibraStroke[];
  axis: LibraStroke; base: LibraStroke; stars: GemVertex[]; sign: GemVertex;
};

export type LibraDiscoveryOptions = {
  project: (point: GemVertex) => GemPoint;
  scale: number;
  alignment: number;
  found: boolean;
  time: number;
  reduced: boolean;
  opacity: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };

export function drawLibraDiscovery(ctx: CanvasRenderingContext2D, options: LibraDiscoveryOptions) {
  if (options.scale <= 0 || options.opacity <= 0) return;
  const { project, found, time, reduced } = options;
  const close = smooth(options.alignment), reveal = found ? 1 : close;
  if (reveal <= .001) return;
  const opacity = clamp(options.opacity), unit = Math.max(.7, Math.min(1, options.scale / 112));
  const alpha = opacity * (found ? .34 : .66) * reveal;
  const colour = '246,223,239';
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  const line = (stroke: LibraStroke, progress: number, weight = 1, fade = 1) => {
    if (progress <= 0) return;
    const points = stroke.map(project);
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) * clamp(progress);
    ctx.strokeStyle = `rgba(${colour},${alpha * fade})`;
    ctx.lineWidth = weight * unit;
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length && remaining > 0; index++) {
      const previous = points[index - 1], point = points[index], length = lengths[index - 1];
      const portion = length > 0 ? Math.min(1, remaining / length) : 1;
      ctx.lineTo(previous.x + (point.x - previous.x) * portion, previous.y + (point.y - previous.y) * portion);
      remaining -= length;
    }
    ctx.stroke();
  };
  const phase = (start: number, duration: number) => smooth((reveal - start) / duration);
  LIBRA_FACET_GEOMETRY.beams.forEach((beam) => line(beam, phase(0, .52), .95));
  LIBRA_FACET_GEOMETRY.hangers.forEach((hanger) => line(hanger, phase(.18, .48), .7, .78));
  LIBRA_FACET_GEOMETRY.panRims.forEach((rim) => line(rim, phase(.36, .46), .7, .76));
  LIBRA_FACET_GEOMETRY.panBowls.forEach((bowl) => line(bowl, phase(.43, .48), .85, .92));
  line(LIBRA_FACET_GEOMETRY.axis, phase(.25, .58), .62, .58);
  line(LIBRA_FACET_GEOMETRY.base, phase(.64, .36), .7, .65);

  const breath = reduced || found ? 1 : .91 + Math.sin(time * .0011) ** 2 * .09;
  LIBRA_FACET_GEOMETRY.stars.forEach((point, index) => {
    const p = project(point), show = phase(index === 1 ? 0 : index < 3 ? .25 : .52, .38);
    if (show <= 0) return;
    ctx.fillStyle = `rgba(255,237,247,${Math.min(.9, alpha * 1.4) * show * breath})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, (index === 1 ? 1.25 : 1) * unit, 0, Math.PI * 2); ctx.fill();
  });
  const sign = project(LIBRA_FACET_GEOMETRY.sign), signReveal = phase(.78, .22);
  if (signReveal > 0) {
    ctx.fillStyle = `rgba(${colour},${alpha * .62 * signReveal})`;
    ctx.font = `${9 * unit}px "Segoe UI Symbol","Apple Symbols",serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♎\uFE0E', sign.x, sign.y);
  }
  ctx.restore();
}
