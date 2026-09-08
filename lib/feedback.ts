// Safari provides native switch haptics, not arbitrary vibration patterns.
// Keep native switch activation in a user gesture. Never pretend timers are haptics.
let context: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
let musicTimers: number[] = [];

function getAudioContext() {
  const ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!ctor) return null;
  context ??= new ctor();
  void context.resume().catch(() => {});
  return context;
}
export function feedback(duration = 30, sound = false) {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
    navigator.vibrate(duration);
  if (sound) tone(duration === 30 ? 90 : duration);
}
export function switchTap(input: HTMLInputElement | null, sound = false) {
  if (typeof navigator.vibrate === 'function') feedback(24, sound);
  else {
    input?.click();
    if (sound) tone(85);
  }
}
export function tone(duration = 140) {
  try {
    const audio = getAudioContext();
    if (!audio) return;
    const o = audio.createOscillator(),
      g = audio.createGain(),
      now = audio.currentTime;
    o.type = 'sine';
    o.frequency.value = 659.25;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(now + duration / 1000 + 0.01);
    oscillators.push(o);
    o.onended = () => {
      oscillators = oscillators.filter((x) => x !== o);
      o.disconnect();
      g.disconnect();
    };
  } catch {}
}
const BIRTHDAY = [
  ['G4', 0.3],
  ['G4', 0.3],
  ['A4', 0.55],
  ['G4', 0.55],
  ['C5', 0.55],
  ['B4', 0.9],
  ['G4', 0.3],
  ['G4', 0.3],
  ['A4', 0.55],
  ['G4', 0.55],
  ['D5', 0.55],
  ['C5', 0.9],
  ['G4', 0.3],
  ['G4', 0.3],
  ['G5', 0.55],
  ['E5', 0.55],
  ['C5', 0.55],
  ['B4', 0.55],
  ['A4', 0.9],
  ['F5', 0.3],
  ['F5', 0.3],
  ['E5', 0.55],
  ['C5', 0.55],
  ['D5', 0.55],
  ['C5', 1.1],
] as const;
const FREQ: Record<string, number> = {
  A4: 440,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G4: 392,
  G5: 783.99,
};
export function playBirthday() {
  try {
    const audio = getAudioContext();
    if (!audio) return;
    musicTimers.forEach((id) => window.clearTimeout(id));
    musicTimers = [];
    const phraseLength = BIRTHDAY.reduce((sum, [, duration]) => sum + duration + 0.08, 0) + 0.65;
    const start = audio.currentTime + 0.08;
    for (let repeat = 0; repeat < 2; repeat += 1) {
      let at = start + repeat * phraseLength;
      for (const [note, duration] of BIRTHDAY) {
        const frequency = FREQ[note];
        const main = audio.createOscillator();
        const harmonic = audio.createOscillator();
        const gain = audio.createGain();
        main.type = 'triangle';
        harmonic.type = 'sine';
        main.frequency.value = frequency;
        harmonic.frequency.value = frequency * 2;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.052, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
        main.connect(gain);
        harmonic.connect(gain);
        gain.connect(audio.destination);
        main.start(at);
        harmonic.start(at);
        main.stop(at + duration + 0.03);
        harmonic.stop(at + duration + 0.03);
        oscillators.push(main, harmonic);
        main.onended = () => main.disconnect();
        harmonic.onended = () => harmonic.disconnect();
        at += duration + 0.08;
      }
    }
  } catch {}
}
export function silence() {
  oscillators.forEach((o) => {
    try {
      o.stop();
    } catch {}
  });
  oscillators = [];
  musicTimers.forEach((id) => window.clearTimeout(id));
  musicTimers = [];
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
    navigator.vibrate(0);
}
