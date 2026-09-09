export const PINK = '#ffb3de';
export const SAPPHIRE_QUOTES = [
  '愿你像蓝宝石一样，温柔，也坚韧。',
  '愿你喜欢的粉色，照亮每一个平常的日子。',
  '愿十月八日的星光，年年都为你而亮。',
] as const;
export function sapphireCanAdvance(elapsed: number, turned: boolean) {
  return turned && elapsed >= 4600;
}
export const MORSE_CODES = ['.--', '..---', '.....'];
export const NOUNS = [
  ['勇气', 'COURAGE', '愿你有勇气，走向每一个心之所往。'],
  ['幸运', 'LUCK', '愿生活偶尔偏心，把好事留给你。'],
  ['惊喜', 'WONDER', '愿你总能在平常的日子里，发现新的星光。'],
  ['平静', 'PEACE', '愿纷扰经过，而你心里仍有一片安静的海。'],
  ['爱', 'LOVE', '愿你被温柔地爱着，也自由地去爱。'],
  ['好奇', 'CURIOSITY', '愿世界一直辽阔，你的好奇一直明亮。'],
  ['归属', 'HOME', '愿无论走多远，总有一束光为你而亮。'],
  ['明天', 'TOMORROW', '愿所有尚未抵达的明天，都值得期待。'],
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
  color: boolean;
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
  return { ...s, stage: 7, completed: true, history: [...s.choices] };
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
export function endingPhase(elapsed: number): 'project' | 'hbd' {
  return elapsed < 6400 ? 'project' : 'hbd';
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
