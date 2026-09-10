import { MORSE_CODES } from './journey.ts';

// Wishes remain beside the player after delivery. Their effects combine,
// so the first wish changes how the later crossings play.
export const WISH_LIGHTS = [
  { kind: 'lead', line: '勇气先点亮一束光。' },
  { kind: 'lead', line: '幸运替你捎去一束光。' },
  { kind: 'glimpse', line: '惊喜让下一束光留下轮廓。' },
  { kind: 'linger', line: '平静让远方的光慢一些。' },
  { kind: 'lead', line: '爱陪你送出第一束光。' },
  { kind: 'glimpse', line: '好奇让下一束光留下轮廓。' },
  { kind: 'linger', line: '归属让远方的光多等一会。' },
  { kind: 'lead', line: '明天在前方，先亮起一束光。' },
] as const;
export function wishLight(wishes: number[]) {
  const kinds = wishes.map((i) => WISH_LIGHTS[i]?.kind);
  return {
    lead: kinds.filter((k) => k === 'lead').length,
    unit: 333 + kinds.filter((k) => k === 'linger').length * 100,
    glimpse: kinds.includes('glimpse'),
  };
}
export type Relay = {
  phase: 'choose' | 'listen' | 'answer' | 'cross';
  wish: number | null;
  draft: string;
  misses: number;
  replay: number;
};
export const freshRelay = (): Relay => ({ phase: 'choose', wish: null, draft: '', misses: 0, replay: 0 });
export type RelayAction =
  | { type: 'choose'; wish: number }
  | { type: 'heard' }
  | { type: 'send'; symbol: '.' | '-' }
  | { type: 'replay' }
  | { type: 'pause' };
export function relayStep(state: Relay, action: RelayAction, choices: number[], delivered: number[]): Relay {
  const target = MORSE_CODES[delivered.length];
  if (!target) return state;
  if (action.type === 'choose') {
    if (state.phase !== 'choose' || !choices.includes(action.wish) || delivered.includes(action.wish)) return state;
    return { ...freshRelay(), wish: action.wish, phase: 'listen' };
  }
  if (state.wish === null) return state;
  if (action.type === 'heard' && state.phase === 'listen') {
    const light = wishLight([...delivered, state.wish]);
    // Every crossing still needs the player's reply, even with three lead wishes.
    const seed = target.slice(0, Math.min(light.lead, target.length - 1));
    return { ...state, phase: 'answer', draft: state.draft || seed };
  }
  if (action.type === 'send' && state.phase === 'answer') {
    const draft = state.draft + action.symbol;
    if (!target.startsWith(draft)) return { ...state, misses: state.misses + 1 };
    return { ...state, draft, misses: 0, phase: draft === target ? 'cross' : 'answer' };
  }
  if (action.type === 'replay' && (state.phase === 'answer' || state.phase === 'listen'))
    return { ...state, phase: 'listen', replay: state.replay + 1 };
  if (action.type === 'pause' && state.phase === 'listen') return { ...state, phase: 'answer' };
  return state;
}
export function deliveredWishes(choices: number[], decoded: number, saved?: number[]) {
  return saved && saved.length === decoded && new Set(saved).size === decoded && saved.every((i) => choices.includes(i))
    ? saved : choices.slice(0, decoded);
}
