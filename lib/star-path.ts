/** The shared sky keeps discoveries when the player explores in either order. */
export type StarPathPlace = 'sky' | 'prism' | 'date' | 'sapphire';

export interface StarPathState {
  place: StarPathPlace;
  color: boolean;
  dateFound: boolean;
  infused: boolean;
  anchor?: 'origin' | 'prism' | 'date' | 'sapphire';
}

export const PATH_ANCHORS = {
  origin: { x: 26, y: 78 }, prism: { x: 23, y: 59 },
  date: { x: 76, y: 46 }, sapphire: { x: 62, y: 76 },
} as const;

interface LegacyPathProgress {
  color: boolean;
  stone: boolean;
  month: number;
  day: number;
  rotation: number;
}

export function freshPath(): StarPathState {
  return { place: 'sky', color: false, dateFound: false, infused: false };
}

/** Read optional version-2 progress without allowing a missing discovery to be skipped. */
export function readPath(value: unknown, legacy?: LegacyPathProgress): StarPathState {
  if (value === undefined && legacy) {
    const color = legacy.color === true;
    const dateFound = legacy.stone === true && legacy.month === 10 && legacy.day === 8;
    return {
      place: 'sky',
      color,
      dateFound,
      // Preserve an old visit that already began turning the revealed stone.
      infused: color && dateFound && Number.isFinite(legacy.rotation) && legacy.rotation > 0,
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return freshPath();
  const saved = value as Record<string, unknown>;
  const color = saved.color === true;
  const dateFound = saved.dateFound === true;
  const place = saved.place === 'prism' || saved.place === 'date' ||
    (saved.place === 'sapphire' && color && dateFound) ? saved.place : 'sky';
  const anchor = saved.anchor === 'origin' || saved.anchor === 'prism' ||
    saved.anchor === 'date' || saved.anchor === 'sapphire' ? saved.anchor : undefined;
  return { place, color, dateFound, infused: saved.infused === true && color && dateFound,
    ...(anchor ? { anchor } : {}) };
}

/** A discovery stays available on return; the stone needs light and a birthday. */
export function visitPath(path: StarPathState, place: StarPathPlace): StarPathState {
  const safe = readPath(path);
  if (place === 'sapphire' && !(safe.color && safe.dateFound)) return safe;
  return readPath({ ...safe, place,
    ...(place === 'sky' && safe.place !== 'sky' ? { anchor: safe.place } : {}) });
}

/** Let the player remain with the dispersed light until they choose the way back. */
export function completePrismPath(path: StarPathState): StarPathState {
  const safe = readPath(path);
  return safe.place === 'prism' ? { ...safe, color: true } : safe;
}

/** The dial view can finish its gathering animation before returning to the sky. */
export function completeDatePath(path: StarPathState): StarPathState {
  const safe = readPath(path);
  return safe.place === 'date' ? { ...safe, dateFound: true } : safe;
}

/** Carrying pink light into the stone is separate from merely opening that view. */
export function infusePath(path: StarPathState): StarPathState {
  const safe = readPath(path);
  return safe.place === 'sapphire' && safe.color && safe.dateFound
    ? { ...safe, infused: true }
    : safe;
}
