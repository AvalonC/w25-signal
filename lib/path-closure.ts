import { projectPoint, smooth, type CameraView, type Vec3 } from './bracelet-transition.ts';

export type ClosurePart = { group: number; symbol: '.' | '-'; node: string; stones: Vec3[] };
// Gem centres follow the GU1893-v6 stone stations; r2 only articulates the clasp.
// A long mark is one actual three-diamond bar, not three separate Morse dots.
export const CLOSURE_PARTS: ClosurePart[] = [
  { group: 0, symbol: '.', node: 'Round 01', stones: [[.011342515237629414, 0, .020719912834465504]] },
  { group: 0, symbol: '-', node: 'Triple bar 01', stones: [[.017546646296977997, 0, .015938391909003258], [.018512298353016376, 0, .014725951012223959], [.019477952271699905, 0, .013513511046767235]] },
  { group: 0, symbol: '-', node: 'Triple bar 02', stones: [[.022648821584880352, 0, .0068585858680307865], [.022999567911028862, 0, .005348790902644396], [.023350315168499947, 0, .003838998032733798]] },
  { group: 1, symbol: '.', node: 'Round 02', stones: [[.019335701130330563, 0, -.013570213224738836]] },
  { group: 1, symbol: '.', node: 'Round 03', stones: [[.013494296930730343, 0, -.01938891690224409]] },
  { group: 1, symbol: '-', node: 'Triple bar 03', stones: [[.006491561187431216, 0, -.02275402471423149], [.004976300289854407, 0, -.02308034524321556], [.0034610399743542075, 0, -.02340666577219963]] },
  { group: 1, symbol: '-', node: 'Triple bar 04', stones: [[-.003930778242647648, 0, -.023335687816143036], [-.005439182976260781, 0, -.0229790136218071], [-.006947587477043271, 0, -.02262233942747116]] },
  { group: 1, symbol: '-', node: 'Triple bar 05', stones: [[-.013589822221547365, 0, -.01942422427237034], [-.014798460062593222, 0, -.01845381408929825], [-.016007099766284227, 0, -.017483406700193882]] },
  { group: 2, symbol: '.', node: 'Round 04', stones: [[-.023221014067530632, 0, -.003874971764162183]] },
  { group: 2, symbol: '.', node: 'Round 05', stones: [[-.023147019557654858, 0, .004321173299103975]] },
  { group: 2, symbol: '.', node: 'Round 06', stones: [[-.020352850668132305, 0, .011995829641819]] },
  { group: 2, symbol: '.', node: 'Round 07', stones: [[-.014987555798143148, 0, .018254974856972694]] },
  { group: 2, symbol: '.', node: 'Round 08', stones: [[-.007848966401070356, 0, .022240767255425453]] },
];
export const CLOSURE_GEM: Vec3 = [.023025190457701683, 2.2717066942845587e-12, -.005053333472460508];
export const CLOSURE_CODES = ['.--', '..---', '.....'] as const;
export const CLOSURE_LETTERS = ['W', '2', '5'] as const;
export const CLOSURE_ORBIT = '0deg 12deg 0.12m';

export function closurePoint(point: Vec3, view?: CameraView | null) {
  return projectPoint(point, { theta: 0, phi: Math.PI / 15, radius: .12, target: [0, 0, 0],
    fov: 30, ...view, left: 0, top: 0, width: 100, height: 100 });
}
export function closureRingPosition(angle: number): Vec3 {
  const radians = angle * Math.PI / 180;
  return [Math.sin(radians) * .023, 0, Math.cos(radians) * .023];
}
export function closureRingPoint(angle: number, view?: CameraView | null) {
  return closurePoint(closureRingPosition(angle), view);
}
export const CLOSURE_START = closureRingPoint(345);
export const CLOSURE_TARGET = closureRingPoint(20);
// The camera catches up with the travelling star at the near side of the ring.
export function closureArrival(ms: number, reduced = false, anchor = CLOSURE_START) {
  const flight = reduced ? 1 : smooth(ms/1600);
  return { point: { x: anchor.x - 18*(1-flight), y: anchor.y + 24*(1-flight) },
    opacity: smooth(ms/(reduced ? 350 : 280)),
    copy: smooth((ms-(reduced ? 0 : 850))/(reduced ? 350 : 950)),
    ready: ms >= (reduced ? 400 : 2200) };
}
export function closureNear(point: { x: number; y: number }, width: number, height: number, target = CLOSURE_TARGET) {
  return Math.hypot((point.x - target.x) * width / 100,
    (point.y - target.y) * height / 100) <= Math.max(28, Math.min(44, width * .12));
}
export function closureTimeline(reduced = false) {
  let time = reduced ? 500 : 1500;
  const frames = CLOSURE_PARTS.map((part, i) => {
    if (i && part.group !== CLOSURE_PARTS[i - 1].group) time += reduced ? 500 : 1000;
    const start = time;
    time += reduced ? 180 : part.symbol === '-' ? 850 : 400;
    const end = time;
    time += reduced ? 0 : 180;
    return { start, end, group: part.group };
  });
  return { frames, settle: time + (reduced ? 200 : 600), duration: time + (reduced ? 1300 : 2800) };
}
export function closureFrame(ms: number, reduced = false) {
  const { frames, settle, duration } = closureTimeline(reduced);
  const lit = frames.map((frame) => ms >= frame.start);
  const active = frames.findIndex((frame) => ms >= frame.start && ms < frame.end);
  const group = frames.reduce((found, frame) => ms >= frame.start ? frame.group : found, -1);
  return { lit, active, group, ready: ms >= duration, settled: ms >= settle,
    join: smooth(ms / (reduced ? 200 : 1100)),
    solid: smooth((ms - (reduced ? 100 : 750)) / (reduced ? 300 : 1500)),
    gemstone: smooth((ms - settle) / (reduced ? 300 : 900)) };
}
