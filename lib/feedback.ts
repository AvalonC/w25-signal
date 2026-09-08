// Safari provides native switch haptics, not arbitrary vibration patterns.
// Keep native switch activation in a user gesture. Never pretend timers are haptics.
let context: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
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
    const ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!ctor) return;
    context ??= new ctor();
    void context.resume().catch(() => {});
    const o = context.createOscillator(),
      g = context.createGain(),
      now = context.currentTime;
    o.type = 'sine';
    o.frequency.value = 659.25;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
    o.connect(g);
    g.connect(context.destination);
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
export function silence() {
  oscillators.forEach((o) => {
    try {
      o.stop();
    } catch {}
  });
  oscillators = [];
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
    navigator.vibrate(0);
}
