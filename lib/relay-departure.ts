import { softStep } from './motion.ts';
import { RELAY_SHORES, RELAY_WISHES } from './relay-motion.ts';

export const RELAY_DEPARTURE = {
  duration: 2400,
  reduced: 400,
  gatherMs: 1150,
  launchMs: 0,
  start: RELAY_SHORES[3],
  end: [358, -44],
} as const;

const COMPANION_DOCKS = [[246, 73], [260, 60], [272, 69]] as const;
const COMPANION_ENDS = [[336, -55], [347, -49], [358, -43]] as const;
const mix = (a: readonly number[], b: readonly number[], q: number) => a.map((value, axis) => value + (b[axis] - value) * q);

/** Fade the completed map while the star and its companions travel onward. */
export function relayDeparture(elapsed: number, reduced = false) {
  const t = Math.max(0, elapsed);
  if (reduced) {
    const fade = 1 - softStep(t / RELAY_DEPARTURE.reduced);
    return {
      progress: 0,
      ready: t >= RELAY_DEPARTURE.reduced,
      routeOpacity: fade,
      main: [...RELAY_DEPARTURE.start],
      mainOpacity: fade,
      companions: RELAY_WISHES.map((point) => [...point]),
      companionOpacity: fade,
    };
  }

  const progress = softStep((t - RELAY_DEPARTURE.launchMs) / (RELAY_DEPARTURE.duration - RELAY_DEPARTURE.launchMs));
  const main = mix(RELAY_DEPARTURE.start, RELAY_DEPARTURE.end, progress);
  const gather = RELAY_WISHES.map((wish, i) => {
    const q = softStep(t / (RELAY_DEPARTURE.gatherMs - i * 90));
    return mix(wish, COMPANION_DOCKS[i], q);
  });
  const companions = gather.map((point, i) => {
    const dock = COMPANION_DOCKS[i];
    const end = COMPANION_ENDS[i];
    const along = mix(dock, end, progress);
    // Keep each wish's own position through the gathering phase, then let it
    // join the main star's upward-right departure without snapping.
    const join = softStep((t - 760) / 440);
    return mix(point, along, join);
  });
  const routeOpacity = 1 - softStep(t / 1080);
  const starOpacity = 1 - softStep((t - 2050) / 350);
  return {
    progress,
    ready: t >= RELAY_DEPARTURE.duration,
    routeOpacity,
    main,
    mainOpacity: starOpacity,
    companions,
    companionOpacity: starOpacity,
  };
}
