import { MORSE_CODES } from './journey.ts';

// Wishes remain beside the player after delivery. Their effects combine,
// so the first wish changes how the later crossings play.
export const WISH_LIGHTS = [
  { kind: 'lead', line: '勇气照亮开头的光。' },
  { kind: 'lead', line: '幸运照亮开头的光。' },
  { kind: 'glimpse', line: '惊喜让下一束光留下轮廓。' },
  { kind: 'linger', line: '平静让远方的光慢一些。' },
  { kind: 'lead', line: '爱陪你看清开头的光。' },
  { kind: 'glimpse', line: '好奇让下一束光留下轮廓。' },
  { kind: 'linger', line: '归属让远方的光多等一会。' },
  { kind: 'lead', line: '明天在前方，照亮开头的光。' },
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
  phase: 'choose' | 'listen' | 'help' | 'answer' | 'echo' | 'cross';
  wish: number | null;
  draft: string;
  misses: number;
  replay: number;
  helper: number | null;
  listeningPaused: boolean;
  listenFrom: number;
};
export const freshRelay = (): Relay => ({ phase: 'choose', wish: null, draft: '', misses: 0, replay: 0, helper: null, listeningPaused: false, listenFrom: 0 });
export type RelayAction =
  | { type: 'choose'; wish: number }
  | { type: 'heard' }
  | { type: 'help'; wish: number }
  | { type: 'echoed' }
  | { type: 'send'; symbol: '.' | '-' }
  | { type: 'replay' }
  | { type: 'pause' };
export function relayStep(state: Relay, action: RelayAction, choices: number[], delivered: number[]): Relay {
  const target = MORSE_CODES[delivered.length];
  if (!target) return state;
  if (action.type === 'choose') {
    if (state.phase !== 'choose' || !choices.includes(action.wish) || delivered.includes(action.wish)) return state;
    return { ...freshRelay(), wish: action.wish, phase: delivered.length === 2 ? 'echo' : 'listen' };
  }
  if (state.wish === null) return state;
  if (action.type === 'heard' && state.phase === 'listen' && !state.listeningPaused) {
    if (delivered.length === 1 && state.helper === null) return { ...state, phase: 'help' };
    return { ...state, phase: delivered.length === 2 && state.draft.length % 2 === 0 ? 'echo' : 'answer' };
  }
  if (action.type === 'help' && state.phase === 'help' && choices.includes(action.wish)) {
    return { ...state, helper: action.wish, phase: 'listen', listenFrom: 2, replay: state.replay + 1 };
  }
  if (action.type === 'echoed' && state.phase === 'echo' && delivered.length === 2) {
    const draft = state.draft + '.';
    return { ...state, draft, phase: draft === target ? 'cross' : 'answer' };
  }
  if (action.type === 'send' && state.phase === 'answer') {
    const draft = state.draft + action.symbol;
    if (!target.startsWith(draft)) return { ...state, misses: state.misses + 1 };
    return { ...state, draft, misses: 0, phase: draft === target ? 'cross' : delivered.length === 2 ? 'echo' : 'answer' };
  }
  if (action.type === 'replay' && (state.phase === 'answer' || state.phase === 'listen' || state.phase === 'help'))
    return { ...state, phase: 'listen', replay: state.replay + 1, listenFrom: 0, listeningPaused: false };
  if (action.type === 'pause' && state.phase === 'listen') return { ...state, listeningPaused: !state.listeningPaused };
  return state;
}
export function deliveredWishes(choices: number[], decoded: number, saved?: number[]) {
  return saved && saved.length === decoded && new Set(saved).size === decoded && saved.every((i) => choices.includes(i))
    ? saved : choices.slice(0, decoded);
}
