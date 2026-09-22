import { softStep } from './motion.ts';

export const PRISM_ENTRANCE_MS = 1800;
export const PRISM_RETURN_MS = 1600;
export function prismEntranceFrame(elapsed: number, reduced = false) {
  const duration = reduced ? 280 : PRISM_ENTRANCE_MS;
  const at = softStep(elapsed / duration);
  return { x: 18 + 26 * at, y: 22 + 27 * at,
    scale: reduced ? 1 : .3 + at * .7, opacity: 1 - softStep((at - .7) / .3),
    light: softStep((at - .52) / .48), done: elapsed >= duration };
}
export function prismReturnFrame(elapsed: number, reduced = false) {
  const duration = reduced ? 240 : PRISM_RETURN_MS;
  const at = softStep(elapsed / duration), u = 1 - at;
  return { x: u*u*64 + 2*u*at*91 + at*at*23,
    y: u*u*47 + 2*u*at*82 + at*at*72,
    opacity: softStep(elapsed / (reduced ? 120 : 360)), done: elapsed >= duration };
}

// Arrival, light travelling over the facets, then a quiet hold before control returns.
export const INFUSION_MS = 3000;
export const INFUSION_REDUCED_MS = 1000;
export function infusionFrame(elapsed: number, reduced = false) {
  const duration = reduced ? INFUSION_REDUCED_MS : INFUSION_MS;
  return {
    pull: softStep(elapsed / (reduced ? 400 : 900)),
    trace: softStep((elapsed - (reduced ? 100 : 600)) / (reduced ? 650 : 1500)),
    glow: reduced ? 0 : Math.sin(Math.PI * softStep((elapsed - 1000) / 1700)),
    settled: softStep((elapsed - (reduced ? 650 : 2200)) / (reduced ? 350 : 800)),
    done: elapsed >= duration,
  };
}
