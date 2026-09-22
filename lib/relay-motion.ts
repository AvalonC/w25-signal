import { softStep } from './motion.ts';

export const RELAY_SHORES = [[60, 203], [280, 154], [78, 97], [278, 42]];
export const RELAY_BENDS = [[[116, 192], [232, 213]], [[246, 116], [128, 149]], [[109, 52], [226, 96]]];
export const RELAY_ROUTES = RELAY_BENDS.map((bend, i) => `M${RELAY_SHORES[i].join(' ')} C${bend[0].join(' ')} ${bend[1].join(' ')} ${RELAY_SHORES[i + 1].join(' ')}`);
export const RELAY_CODES = ['.--', '..---', '.....'];
export const RELAY_WISHES = [[60, 271], [180, 264], [300, 271]];
export function relayCurve(round: number, progress: number) {
  const t = Math.max(0, Math.min(1, progress)), u = 1 - t;
  return RELAY_SHORES[round].map((v, axis) => u*u*u*v + 3*u*u*t*RELAY_BENDS[round][0][axis] + 3*u*t*t*RELAY_BENDS[round][1][axis] + t*t*t*RELAY_SHORES[round + 1][axis]);
}
export function relayArrival(ms: number, reduced = false) {
  const travel = reduced ? 1 : softStep(ms / 1900);
  const settle = softStep((ms - (reduced ? 0 : 1550)) / (reduced ? 350 : 950));
  const start = [230, 132], end = RELAY_SHORES[0];
  const rest = 1-travel;
  const main = [rest*rest*start[0]+2*rest*travel*128+travel*travel*end[0], rest*rest*start[1]+2*rest*travel*120+travel*travel*end[1]];
  return { main, settle, ready: ms >= (reduced ? 400 : 2600),
    trail: reduced ? 0 : 1-softStep((ms-1700)/750),
    companions: RELAY_WISHES.map((point, i) => {
      const from = [main[0] + Math.cos(i*2.1)*21, main[1] + Math.sin(i*2.1)*16];
      return from.map((value, axis) => value + (point[axis]-value)*settle);
    }) };
}
// Each completed pulse remains in the sky, then contributes to a letter stroke.
const LETTERS = [
  [[69, 112, 81, 153], [81, 153, 94, 124], [94, 124, 108, 153], [108, 153, 120, 112]],
  [[151, 116, 180, 112], [180, 112, 194, 126], [194, 126, 153, 153], [153, 153, 196, 153]],
  [[238, 112, 276, 112], [238, 112, 238, 132], [238, 132, 271, 132], [271, 132, 276, 151], [276, 151, 237, 153]],
];
export const RELAY_MARKS = RELAY_CODES.flatMap((code, round) => code.split('').map((symbol, index) => ({
  round, index, symbol, point: relayCurve(round, (index+1)/(code.length+1)),
})));
export function relayReveal(ms: number, reduced = false, letterYScale = 1) {
  const gather = softStep((ms-(reduced ? 0 : 650))/(reduced ? 350 : 2000));
  const returnLight = softStep((ms-(reduced ? 600 : 3700))/(reduced ? 300 : 1600));
  return { gather, returnLight, ready: ms >= (reduced ? 1000 : 5500),
    routeOpacity: 1-gather*.86, glyphOpacity: gather,
    main: [278 + (180-278)*returnLight, 42 + (215-42)*returnLight],
    mainOpacity: ms < (reduced ? 450 : 3150) ? 1-gather : returnLight,
    marks: RELAY_MARKS.map((mark) => {
      const strokes = LETTERS[mark.round];
      const target = strokes[Math.min(mark.index, strokes.length-1)].map((value, axis) => axis % 2 ? 132+(value-132)*letterYScale : value);
      const size = mark.symbol === '-' ? 7 : 0;
      const source = [mark.point[0]-size, mark.point[1], mark.point[0]+size, mark.point[1]];
      return { ...mark, line: source.map((value, axis) => value+(target[axis]-value)*gather) };
    }),
    // W has three pulses and four strokes; its centre unfolds with the third pulse.
    extraStroke: LETTERS[0][3].map((value, axis) => axis % 2 ? 132+(value-132)*letterYScale : value),
    companions: RELAY_WISHES.map((point, i) => {
      const angle = i*2.1+.3, end = [180+Math.cos(angle)*32, 215+Math.sin(angle)*26];
      return point.map((value, axis) => value+(end[axis]-value)*returnLight);
    }),
  };
}
