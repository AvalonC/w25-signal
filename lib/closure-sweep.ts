import { smooth, type Vec3 } from './bracelet-transition.ts';
import { CLOSURE_GEM, CLOSURE_PARTS, closureTimeline } from './path-closure.ts';

const DEGREES = 180 / Math.PI;
const START_ANGLE = 20;
const RESTING_GLOW = .16;
const REFLECTION_RADIUS = .00115;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const pointAngle = (point: Vec3) => (Math.atan2(point[0], point[2]) * DEGREES + 360) % 360;
const radius = (point: Vec3) => Math.hypot(point[0], point[2]);
const forwardAngle = (point: Vec3, after: number) => {
  let angle = pointAngle(point);
  while (angle < after - .000001) angle += 360;
  return angle;
};
const mix = (from: Vec3, to: Vec3, progress: number): Vec3 => {
  if (progress <= 0) return [...from];
  if (progress >= 1) return [...to];
  return from.map((value, axis) => value + (to[axis] - value) * progress) as Vec3;
};

/** The position at which the player has just connected the two ends of the path. */
export const CLOSURE_SWEEP_START: Vec3 = [
  Math.sin(START_ANGLE / DEGREES) * .023, 0, Math.cos(START_ANGLE / DEGREES) * .023,
];

type SweepSegment = {
  start: number;
  end: number;
  points: Vec3[];
  startAngle: number;
  endAngle: number;
  kind: 'arc' | 'stones';
  index: number;
};

function segmentsFor(reduced: boolean) {
  const timeline = closureTimeline(reduced);
  const segments: SweepSegment[] = [];
  let point = CLOSURE_SWEEP_START;
  let angle = START_ANGLE;
  let time = reduced ? 200 : 1100;
  for (const [index, frame] of timeline.frames.entries()) {
    const stones = CLOSURE_PARTS[index].stones;
    const firstAngle = forwardAngle(stones[0], angle);
    if (frame.start > time) segments.push({ start: time, end: frame.start, points: [point, stones[0]],
      startAngle: angle, endAngle: firstAngle, kind: 'arc', index: -1 });
    const endAngle = forwardAngle(stones[stones.length - 1], firstAngle);
    segments.push({ start: frame.start, end: frame.end, points: stones,
      startAngle: firstAngle, endAngle, kind: 'stones', index });
    point = stones[stones.length - 1];
    angle = endAngle;
    time = frame.end;
  }
  // Complete the circle through the clasp before approaching the right-hand star setting.
  const endAngle = forwardAngle(CLOSURE_GEM, angle);
  segments.push({ start: time, end: timeline.settle, points: [point, CLOSURE_GEM],
    startAngle: angle, endAngle, kind: 'arc', index: -1 });
  return { segments, timeline, endAngle };
}
const ordinarySweep = segmentsFor(false);
const reducedSweep = segmentsFor(true);

function segmentPoint(segment: SweepSegment, progress: number): Vec3 {
  const points = segment.points;
  if (progress <= 0) return [...points[0]];
  if (progress >= 1) return [...points[points.length - 1]];
  if (segment.kind === 'stones') {
    const offset = progress * (points.length - 1);
    const index = Math.floor(offset);
    return mix(points[index], points[Math.min(points.length - 1, index + 1)], offset - index);
  }
  const from = points[0], to = points[1];
  const angle = (segment.startAngle + (segment.endAngle - segment.startAngle) * progress) / DEGREES;
  const distance = radius(from) + (radius(to) - radius(from)) * progress;
  return [Math.sin(angle) * distance, from[1] + (to[1] - from[1]) * progress, Math.cos(angle) * distance];
}
const safeTime = (ms: number) => Number.isNaN(ms) ? 0 : Math.max(0, ms);

/**
 * A single physical cursor drives both the travelling star and reflected diamond light.
 * Angles unwrap clockwise from 20 degrees through 360 to the final pink star setting.
 * Reduced motion retains the same mapped reveal but hides the moving cursor and trail.
 */
export function closureSweep(ms: number, reduced = false) {
  const time = safeTime(ms);
  const { segments, timeline, endAngle } = reduced ? reducedSweep : ordinarySweep;
  const segment = segments.find((item) => time >= item.start && time < item.end);
  const after = time >= timeline.settle;
  const segmentProgress = segment ? smooth((time - segment.start) / (segment.end - segment.start)) : 0;
  const position: Vec3 = segment ? segmentPoint(segment, segmentProgress)
    : after ? [...CLOSURE_GEM] : [...CLOSURE_SWEEP_START];
  const angle = segment ? forwardAngle(position, segment.startAngle) : after ? endAngle : START_ANGLE;
  const index = segment?.index ?? -1;
  const starOpacity = reduced ? 0 : 1 - smooth((time - timeline.settle) / 500);
  const reflection = time >= segments[0].start && time < timeline.settle ? 1 : 0;
  const stoneStrengths = CLOSURE_PARTS.map((part, partIndex) => part.stones.map((stone, stoneIndex) => {
    const frame = timeline.frames[partIndex];
    const stoneProgress = part.stones.length === 1 ? 0 : stoneIndex / (part.stones.length - 1);
    const passed = time >= frame.end || (index === partIndex && segmentProgress >= stoneProgress);
    const distance = Math.hypot(...stone.map((value, axis) => value - position[axis]));
    const mapped = reflection * Math.exp(-.5 * (distance / REFLECTION_RADIUS) ** 2);
    return Math.max(passed ? RESTING_GLOW : 0, mapped);
  }));
  return { position, angle, progress: clamp((angle - START_ANGLE) / (endAngle - START_ANGLE)),
    index, stoneStrengths, starOpacity,
    trailOpacity: reduced ? 0 : 1 - smooth((time - timeline.settle) / 1200) };
}

/**
 * The already-travelled 3D path, including every reached real diamond centre.
 * Gaps are sampled on the bracelet arc; a long Morse mark follows its actual three stones.
 * Project these points with the same camera as closureSweep().position and the model.
 */
export function closureSweepPath(ms: number, reduced = false, maxAngleStep = 3): Vec3[] {
  const time = safeTime(ms);
  const { segments } = reduced ? reducedSweep : ordinarySweep;
  const result: Vec3[] = [[...CLOSURE_SWEEP_START]];
  const step = Number.isFinite(maxAngleStep) && maxAngleStep > 0 ? Math.max(.25, maxAngleStep) : 3;
  const append = (point: Vec3) => {
    const previous = result[result.length - 1];
    if (Math.hypot(...point.map((value, axis) => value - previous[axis])) > 1e-12) result.push(point);
  };
  for (const segment of segments) {
    if (time < segment.start) break;
    const progress = smooth((time - segment.start) / (segment.end - segment.start));
    if (segment.kind === 'arc') {
      const count = Math.ceil((segment.endAngle - segment.startAngle) * progress / step);
      for (let sample = 1; sample <= count; sample++) append(segmentPoint(segment, progress * sample / count));
    } else {
      const reached = progress * (segment.points.length - 1);
      for (let stone = 0; stone <= Math.floor(reached); stone++) append([...segment.points[stone]]);
      append(segmentPoint(segment, progress));
    }
    if (time < segment.end) break;
  }
  return result;
}
