import { softStep } from './motion.ts';

export const DATE_ENTRY_TIMING = {
  duration: 2600,
  reduced: 500,
  dialDuration: 2200,
  dayDelay: 240,
} as const;

const unit = (value: number) => Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
const layer = (progress: number, start: number, end: number) => softStep((progress - start) / (end - start));

// A stationary dial is engraved from its rim inward. The caller gives its marks
// a visual order starting at twelve o'clock; values retain their own positions.
export function dialReveal(progress: number, count: number) {
  const p = unit(progress);
  const length = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const order = Array.from({ length }, (_, index) => index / Math.max(1, length - 1));
  return {
    outer: layer(p, 0, .35),
    ticks: order.map((at) => layer(p, .14 + at * .28, .22 + at * .28)),
    labels: order.map((at) => layer(p, .30 + at * .27, .43 + at * .27)),
    inner: layer(p, .56, .85),
    pointer: layer(p, .70, .90),
    reading: layer(p, .78, 1),
    ready: p === 1,
  };
}

// The second dial follows the first; the final quiet beat leaves the complete
// calendar in place before pointer and keyboard input become available.
export function dateEntryFrame(elapsed: number, reducedMotion: boolean, found = false) {
  if (found) return { month: 1, day: 1, ready: true };
  if (reducedMotion) {
    const progress = unit(elapsed / DATE_ENTRY_TIMING.reduced);
    return { month: progress, day: progress, ready: progress === 1 };
  }
  return {
    month: unit(elapsed / DATE_ENTRY_TIMING.dialDuration),
    day: unit((elapsed - DATE_ENTRY_TIMING.dayDelay) / DATE_ENTRY_TIMING.dialDuration),
    ready: elapsed >= DATE_ENTRY_TIMING.duration,
  };
}
