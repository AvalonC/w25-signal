// A continuous turn reveals three meanings. Fast gestures may earn the next
// reveal, but cannot make its predecessor disappear before it can be read.
export const SAPPHIRE_DISCOVERIES = [
  { name: '蓝宝石', english: 'SAPPHIRE', line: '星光有了名字，也有了温柔而坚定的形状。', distance: .42 },
  { name: '献给天秤座的你', english: 'LIBRA · OCTOBER 8', line: '为十月八日的你，选一颗专属的诞生石。', distance: 1.45 },
  { name: '原来，它也可以是粉色', english: 'PINK SAPPHIRE', line: '蓝宝石不只有蓝色。这一颗，是你最爱的粉色。', distance: 2.65 },
] as const;
export const DISCOVERY_READ_MS = 4800;
export const SAPPHIRE_INTRO = { orbits: 3800, light: 1800, weave: 3000 } as const;
export function nextSapphireDiscovery(current: number, travel: number, sinceReveal: number) {
  if (current >= 2 || (current >= 0 && sinceReveal < DISCOVERY_READ_MS)) return current;
  return travel >= SAPPHIRE_DISCOVERIES[current + 1].distance ? current + 1 : current;
}
