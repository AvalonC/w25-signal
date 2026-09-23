import { NOUNS } from './journey.ts';
import { softStep } from './motion.ts';

export const BLESSING_ASCENT = {
  focus: 1200, line: 1900, reveal: 1000, settle: 700, hold: 3000,
  reducedFocus: 320,
} as const;
export type BlessingOrigin = { x: number; y: number };
export const BLESSING_CENTER = { x: .5, y: .52 } as const;
export const BLESSING_REST = { x: .5, y: .18 } as const;
const unit = (v: number) => Math.max(0, Math.min(1, v));

/** Curiosity deliberately has no verse: it must not restore the removed wish. */
export function blessingLines(choices: number[]) {
  return ['HBD, Leah', ...choices.flatMap((choice) => {
    const verse = NOUNS[choice]?.[2];
    return verse ? [verse] : [];
  }), '愿你珍爱的，都能陪你走过新的岁月。'];
}
export function blessingDuration(lineCount: number, reduced = false) {
  const focus = reduced ? BLESSING_ASCENT.reducedFocus : BLESSING_ASCENT.focus;
  return focus + (Math.max(1, lineCount) - 1) * BLESSING_ASCENT.line + BLESSING_ASCENT.reveal + BLESSING_ASCENT.settle;
}

/** A single visible clock raises the star and its growing letter together. */
export function blessingFrame(elapsed: number, lineCount: number, origin?: BlessingOrigin | null, reduced = false) {
  const time = Math.max(0, elapsed);
  const focus = reduced ? BLESSING_ASCENT.reducedFocus : BLESSING_ASCENT.focus;
  const count = Math.max(1, Math.floor(lineCount));
  const versesEnd = focus + (count - 1) * BLESSING_ASCENT.line + BLESSING_ASCENT.reveal;
  const duration = versesEnd + BLESSING_ASCENT.settle;
  const from = {
    x: Number.isFinite(origin?.x) ? unit(origin!.x) : BLESSING_CENTER.x,
    y: Number.isFinite(origin?.y) ? unit(origin!.y) : BLESSING_CENTER.y,
  };
  const focused = softStep(time / focus);
  const ascent = softStep((time - focus) / (versesEnd - focus));
  const point = reduced ? { ...BLESSING_REST } : time < focus ? {
    x: from.x + (BLESSING_CENTER.x - from.x) * focused,
    y: from.y + (BLESSING_CENTER.y - from.y) * focused,
  } : {
    x: .5,
    y: BLESSING_CENTER.y + (BLESSING_REST.y - BLESSING_CENTER.y) * ascent,
  };
  return {
    point, duration, focus: focused, ready: time >= duration,
    verseTop: reduced ? .31 : .64 + (.31 - .64) * ascent,
    phase: time < focus ? 'focus' : time < versesEnd ? 'blessing' : time < duration ? 'settling' : 'ready',
    starOpacity: reduced ? softStep(time / focus) : 1,
    lines: Array.from({ length: count }, (_, i) => softStep((time - focus - i * BLESSING_ASCENT.line) / BLESSING_ASCENT.reveal)),
    trail: reduced ? 0 : Math.sin(Math.PI * unit((time - focus) / (duration - focus))) * .8,
  };
}
