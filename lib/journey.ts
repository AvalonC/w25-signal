import { MOTION } from './motion.ts';
import { freshPath, readPath, visitPath, type StarPathState } from './star-path.ts';
export const PINK = '#ffb3de';
export const SAPPHIRE_QUOTES = [
  '愿你像蓝宝石一样，温柔，也坚韧。',
  '愿你喜欢的粉色，照亮每一个平常的日子。',
  '愿十月八日的星光，年年都为你而亮。',
] as const;
export function sapphireCanAdvance(elapsed: number, turned: boolean) {
  return turned && elapsed >= MOTION.blessing;
}
export const MORSE_CODES = ['.--', '..---', '.....'];
export const NOUNS = [
  ['勇气', 'COURAGE', '愿你向前时，心里有光。'],
  ['幸运', 'LUCK', '愿生活偶尔偏心，把好事留给你。'],
  ['惊喜', 'WONDER', '愿平常的日子，也有意外的欢喜。'],
  ['平静', 'PEACE', '愿喧嚣散去，你仍有自己的安静。'],
  ['爱', 'LOVE', '愿你被温柔地爱着，也自由地去爱。'],
  ['好奇', 'CURIOSITY', ''],
  ['归属', 'HOME', '愿你走得再远，都有一盏为你留的灯。'],
  ['明天', 'TOMORROW', '愿明天到来时，你仍有所期待。'],
] as const;
export interface Journey {
  version: 2;
  stage: number;
  choices: number[];
  history: number[];
  completed: boolean;
  replay: boolean;
  stars: number;
  month: number;
  day: number;
  stone: boolean;
  rotation: number;
  decoded: number;
  echoWishes?: number[];
  color: boolean;
  path?: StarPathState;
  pathClosed?: boolean;
}
export const fresh = (): Journey => ({
  version: 2,
  stage: 0,
  choices: [],
  history: [],
  completed: false,
  replay: false,
  stars: 0,
  month: 1,
  day: 1,
  stone: false,
  rotation: 0,
  decoded: 0,
  color: false,
  path: freshPath(),
});
export const validChoices = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length <= 3 &&
  new Set(v).size === v.length &&
  v.every((n) => Number.isInteger(n) && n >= 0 && n < 8);
export function readSave(raw: string | null, legacy?: string | null): Journey {
  try {
    const s = JSON.parse(raw || 'null');
    if (
      s?.version === 2 &&
      Number.isInteger(s.stage) &&
      s.stage >= 0 &&
      s.stage <= 7 &&
      validChoices(s.choices) &&
      validChoices(s.history) &&
      typeof s.completed === 'boolean' &&
      typeof s.replay === 'boolean' &&
      typeof s.color === 'boolean' &&
      typeof s.stone === 'boolean' &&
      Number.isInteger(s.stars) &&
      s.stars >= 0 &&
      s.stars <= 13 &&
      Number.isInteger(s.decoded) &&
      s.decoded >= 0 &&
      s.decoded <= 3 &&
      Number.isInteger(s.month) &&
      s.month >= 1 &&
      s.month <= 12 &&
      Number.isInteger(s.day) &&
      s.day >= 1 &&
      s.day <= 31 &&
      Number.isFinite(s.rotation) &&
      s.rotation >= 0
    ) {
      if (
        (s.completed && s.history.length !== 3) ||
        (s.stage >= 2 && s.choices.length !== 3) ||
        (s.stage >= 3 && !s.color) ||
        (s.stage >= 4 && s.stars !== 13) ||
        (s.stage >= 5 && (!s.stone || s.rotation < 100)) ||
        (s.stage >= 6 && s.decoded !== 3)
      )
        return fresh();
      // Older saves have no delivery order; retain their progress. A malformed
      // optional order must never inject wishes the player did not select.
      if (s.echoWishes !== undefined && (!validChoices(s.echoWishes) ||
        s.echoWishes.length !== s.decoded || !s.echoWishes.every((i: number) => s.choices.includes(i)))) {
        delete s.echoWishes;
      }
      if (s.pathClosed !== undefined && (typeof s.pathClosed !== 'boolean' || s.stage < 6)) {
        delete s.pathClosed;
      }
      // Keep version 2 so existing visits survive the new shared exploration.
      // Validate the old chapter gates first: adding optional path data must
      // never bypass the stone/rotation/decoded requirements above.
      if (s.stage >= 2 && s.stage <= 4) {
        const oldStage = s.stage;
        const legacyPath = s.path === undefined;
        let path = readPath(s.path, s);
        if (legacyPath && oldStage === 4) {
          path = visitPath(path, path.dateFound ? 'sapphire' : 'date');
        }
        s.path = path;
        s.stage = 2;
        s.color = path.color;
        if (path.dateFound) {
          s.month = 10;
          s.day = 8;
        }
      } else if (s.stage < 2) {
        // A fresh/replayed opening never inherits discoveries from a past run.
        s.path = freshPath();
      }
      return s;
    }
    const old = JSON.parse(legacy || 'null');
    if (
      old?.delivery === 'complete' &&
      Array.isArray(old.wishes) &&
      validChoices(old.wishes.slice(0, 3)) &&
      old.wishes.length >= 3
    )
      return { ...fresh(), completed: true, history: old.wishes.slice(0, 3) };
  } catch {}
  return fresh();
}
export function restart(s: Journey, replay: boolean): Journey {
  return {
    ...fresh(),
    completed: s.completed,
    history: [...s.history],
    stage: 1,
    replay: replay && s.history.length === 3,
    choices: replay ? [...s.history] : [],
  };
}
export function finish(s: Journey): Journey {
  return { ...s, stage: 7, pathClosed: true, completed: true, history: [...s.choices] };
}
export function revisitJourney(s: Journey, stage: 6 | 7): Journey {
  if (!s.completed || s.history.length !== 3) return s;
  return {
    ...fresh(), completed: true, history: [...s.history], choices: [...s.history],
    stage, color: true, month: 10, day: 8, stars: 13, stone: true, rotation: 150,
    decoded: 3, echoWishes: [...s.history], pathClosed: true,
    path: { place: 'sapphire', color: true, dateFound: true, infused: true },
  };
}
export function symbolFromHold(ms: number) {
  return ms >= 1000 ? '-' : '.';
}
// Three touches form W; the rest of W25 follows without further interaction.
export function constellationDelay(revealed: number) {
  if (revealed < 3) return Infinity;
  if (revealed >= 13) return 1600;
  return MORSE_CODES.join('')[revealed] === '-' ? 1050 : 620;
}
export function blessingDuration(line: string) {
  return Math.max(4000, Math.min(6500, line.length * 160 + 1300));
}
export function prefixOK(input: string, target: string) {
  return target.startsWith(input);
}
export function morseTimeline(code: string, unit = 140) {
  let at = 0;
  const frames: { start: number; end: number; symbol: string }[] = [];
  for (const c of code) {
    if (c === ' ') {
      at += unit * 2;
      continue;
    }
    frames.push({ start: at, end: at + unit * (c === '.' ? 1 : 3), symbol: c });
    at += unit * (c === '.' ? 2 : 4);
  }
  return { frames, duration: at };
}
