// The three sights belong to real orientations, never accumulated movement.
export const SAPPHIRE_DISCOVERIES = [
  { name: '蓝宝石', english: 'SAPPHIRE', line: '一点星光，凝成温柔而坚韧的宝石。', angle: .92, hint: '转一转，让切面映出星光。' },
  { name: '献给天秤座的你', english: 'LIBRA · OCTOBER 8', line: '为十月八日的你，选一颗专属的诞生石。', angle: 2.18, hint: '再转一转，让两幅星图相遇。' },
  { name: '原来，它也可以是粉色', english: 'PINK SAPPHIRE', line: '你带来的粉光，也为愿望照亮了归路。', angle: 3.64, hint: '让喜欢的颜色，穿过另一面。' },
] as const;
export const DISCOVERY_READ_MS = 1800;
export const DISCOVERY_DWELL_MS = 880;
export const DISCOVERY_WINDOW = .24;
export const SAPPHIRE_INTRO = { orbits: 3800, light: 1800, weave: 3000 } as const;

export function sapphireAngleDistance(angle: number, target: number) {
  if (!Number.isFinite(angle) || !Number.isFinite(target)) return Infinity;
  return Math.abs(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)));
}

export function sapphireAlignment(angle: number, index: number) {
  const target = SAPPHIRE_DISCOVERIES[index];
  const distance = target ? sapphireAngleDistance(angle, target.angle) : Infinity;
  return { aligned: distance <= DISCOVERY_WINDOW, strength: Math.max(0, 1 - distance / .88) };
}

export function restoredSapphireDiscovery(progress: number) {
  return Number.isFinite(progress) ? Math.max(-1, Math.min(2, Math.floor(progress / 50) - 1)) : -1;
}

export function nextSapphireDiscovery(current: number, angle: number, dwell: number, sinceReveal = Infinity) {
  if (!Number.isInteger(current) || current < -1 || current >= 2 ||
    (current >= 0 && sinceReveal < DISCOVERY_READ_MS)) return current;
  return sapphireAlignment(angle, current + 1).aligned && dwell >= DISCOVERY_DWELL_MS ? current + 1 : current;
}
