import { smooth } from './bracelet-transition.ts';

export const HANDOFF_DURATION = 2600;
export const HANDOFF_REDUCED_DURATION = 400;
export const HANDOFF_CAMERA_START = 300;
export const HANDOFF_CAMERA_END = 2100;

/** All presentation changes share the visible scene clock, including the HUD.
 * The camera target uses cameraProgress to interpolate the model's metadata.
 * Percent radius remains relative to model-viewer's framing at every size. */
export function handoffFrame(ms: number, reduced = false) {
  const duration = reduced ? HANDOFF_REDUCED_DURATION : HANDOFF_DURATION;
  const elapsed = Math.max(0, Math.min(duration, Number.isNaN(ms) ? 0 : ms));
  const cameraProgress = reduced ? 1 : smooth((elapsed - HANDOFF_CAMERA_START) / (HANDOFF_CAMERA_END - HANDOFF_CAMERA_START));
  const theta = 52 * cameraProgress;
  const phi = 12 + 48 * cameraProgress;
  const orbit = `${theta}deg ${phi}deg calc(${.12 * (1 - cameraProgress)}m + ${115 * cameraProgress}%)`;
  return {
    duration,
    cameraProgress,
    orbit,
    closureOpacity: 1 - smooth(elapsed / (reduced ? 180 : 300)),
    actionsOpacity: smooth((elapsed - (reduced ? 180 : 1900)) / (reduced ? 160 : 600)),
    arOpacity: smooth((elapsed - (reduced ? 240 : 2200)) / (reduced ? 160 : 400)),
    ready: elapsed >= duration,
  };
}
