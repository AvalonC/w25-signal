import { softStep } from './motion.ts';

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
