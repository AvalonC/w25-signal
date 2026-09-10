// A continuous turn reveals three meanings. Fast gestures may earn the next
// reveal, but cannot make its predecessor disappear before it can be read.
export const SAPPHIRE_DISCOVERIES = [
  { name: '蓝宝石', english: 'SAPPHIRE', line: '一点星光，凝成温柔而坚韧的宝石。', distance: .42 },
  { name: '献给天秤座的你', english: 'LIBRA · OCTOBER 8', line: '为十月八日的你，选一颗专属的诞生石。', distance: 1.45 },
  { name: '原来，它也可以是粉色', english: 'PINK SAPPHIRE', line: '蓝宝石也有粉色。你刚才找到的光，就留在这里。', distance: 2.65 },
] as const;
export const DISCOVERY_READ_MS = 4800;
export const SAPPHIRE_INTRO = { orbits: 3800, light: 1800, weave: 3000 } as const;
export function nextSapphireDiscovery(current: number, travel: number, sinceReveal: number) {
  if (current >= 2 || (current >= 0 && sinceReveal < DISCOVERY_READ_MS)) return current;
  return travel >= SAPPHIRE_DISCOVERIES[current + 1].distance ? current + 1 : current;
}
