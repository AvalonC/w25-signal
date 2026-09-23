import { softStep } from './motion.ts';

export const RELAY_SHORES = [[60, 203], [280, 154], [78, 97], [278, 42]];
export const RELAY_BENDS = [[[116, 192], [232, 213]], [[246, 116], [128, 149]], [[109, 52], [226, 96]]];
export const RELAY_ROUTES = RELAY_BENDS.map((bend, i) => `M${RELAY_SHORES[i].join(' ')} C${bend[0].join(' ')} ${bend[1].join(' ')} ${RELAY_SHORES[i + 1].join(' ')}`);
export const RELAY_CODES = ['.--', '..---', '.....'];
export const RELAY_WISHES = [[60, 271], [180, 264], [300, 271]];
// Arrive from the foreground, not a future shore. Both this tangent and the
// first onward route lead up and right, with a quiet stop between them.
export const RELAY_ENTRY_START = [24, 284];
export const RELAY_ENTRY_CONTROL = [28, 210];
export const RELAY_ENTRY_TIMING = { dock: 1600, ready: 3000, reduced: 400 } as const;
function entryPoint(t: number) {
  const u = 1 - t;
  return RELAY_ENTRY_START.map((value, axis) => u*u*value + 2*u*t*RELAY_ENTRY_CONTROL[axis] + t*t*RELAY_SHORES[0][axis]);
}
export function relayCurve(round: number, progress: number) {
  const t = Math.max(0, Math.min(1, progress)), u = 1 - t;
  return RELAY_SHORES[round].map((v, axis) => u*u*u*v + 3*u*u*t*RELAY_BENDS[round][0][axis] + 3*u*t*t*RELAY_BENDS[round][1][axis] + t*t*t*RELAY_SHORES[round + 1][axis]);
}
export function relayArrival(ms: number, reduced = false) {
  const travel = reduced ? 1 : softStep(ms / RELAY_ENTRY_TIMING.dock);
  const main = entryPoint(travel);
  const settle = softStep((ms - (reduced ? 0 : RELAY_ENTRY_TIMING.dock)) / (reduced ? 350 : 1070));
  const horizon = softStep((ms - (reduced ? 0 : 1900)) / (reduced ? 300 : 950));
  const interfaceLight = softStep((ms - (reduced ? 0 : 2500)) / (reduced ? 350 : 500));
  const tailStart = Math.max(0, travel - .38);
  const tail = Array.from({ length: 16 }, (_, i) => entryPoint(tailStart + (travel - tailStart)*i/15));
  const companions = RELAY_WISHES.map((point, i) => {
    if (reduced) return [...point];
    const fan = softStep((ms - RELAY_ENTRY_TIMING.dock - i*110)/850);
    const offsets = [[18, -12], [27, 4], [12, 19]][i];
    const from = main.map((value, axis) => value + offsets[axis]);
    return from.map((value, axis) => value + (point[axis]-value)*fan - (axis === 1 ? Math.sin(fan*Math.PI)*(12+i*6) : 0));
  });
  return { main, settle, horizon, interfaceLight, companions,
    docked: ms >= (reduced ? 0 : RELAY_ENTRY_TIMING.dock),
    ready: ms >= (reduced ? RELAY_ENTRY_TIMING.reduced : RELAY_ENTRY_TIMING.ready),
    trail: reduced ? 0 : softStep(ms/180)*(1-softStep((ms-1450)/650)),
    trailPath: tail.map((point, i) => (i ? 'L' : 'M') + point.join(' ')).join(' '),
    companionLabels: RELAY_WISHES.map((_, i) => reduced ? interfaceLight : softStep((ms-2300-i*110)/300)),
  };
}
// Keep the completed pulses on their routes until the onward flight.
export const RELAY_MARKS = RELAY_CODES.flatMap((code, round) => code.split('').map((symbol, index) => ({
  round, index, symbol, point: relayCurve(round, (index+1)/(code.length+1)),
})));
