export const MOTION = { reveal: 1800, release: 1800, gather: 3200, prismBloom: 3200, blessing: 4600 } as const;
export const MOTION_STYLE = { '--motion-reveal': `${MOTION.reveal}ms`, '--motion-release': `${MOTION.release}ms`, '--motion-ease': 'cubic-bezier(.22,.61,.36,1)' };
export const softStep = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
export function meteorFlight(random: () => number = Math.random) {
  const angle = (.12 + random() * .28) * Math.PI, direction = random() > .5 ? 1 : -1;
  return { x: .12 + random() * .76, y: .14 + random() * .52,
    dx: Math.cos(angle) * direction, dy: Math.sin(angle),
    duration: 850 + random() * 1100, delay: 1600 + random() * 4200,
    length: 24 + random() * 40, radius: .45 + random() * .45, opacity: .12 + random() * .14 };
}
