'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CompanionLight } from './path-sky';
import { useVisibleClock } from './scene-clock';

export const OPENING_HOLD_MS = 1000;
type Phase = 'launch' | 'tap' | 'tap-reply' | 'hold' | 'held' | 'depart';
type Press = { pointer: number | null; key: string | null; x: number; y: number; at: number; phase: 'tap' | 'hold' };

/** Learn the two star cues by answering each one, then carry the same light on. */
export function GuidingLight({ paused = false, onArrive, onFeedback }: {
  paused?: boolean; onArrive: () => void; onFeedback?: (symbol: '.' | '-') => void;
}) {
  const [phase, setPhase] = useState<Phase>('launch');
  const [progress, setProgress] = useState(0), [pressing, setPressing] = useState(false);
  const [retry, setRetry] = useState(false), [hidden, setHidden] = useState(false), [blurred, setBlurred] = useState(false);
  const [reduced, setReduced] = useState(false);
  const light = useRef<HTMLButtonElement>(null), gesture = useRef<Press | null>(null);
  const phaseRef = useRef<Phase>('launch'), frame = useRef(0), finished = useRef(false);
  const callbacks = useRef({ onArrive, onFeedback }); callbacks.current = { onArrive, onFeedback };
  const blocked = paused || hidden || blurred;
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const clock = useVisibleClock(!blocked, phase);
  const transition = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  const release = useCallback(() => {
    const press = gesture.current; gesture.current = null;
    cancelAnimationFrame(frame.current);
    if (press?.pointer !== null && press?.pointer !== undefined && light.current?.hasPointerCapture(press.pointer)) {
      light.current.releasePointerCapture(press.pointer);
    }
    setPressing(false);
  }, []);
  const cancel = useCallback(() => {
    const wasHolding = gesture.current?.phase === 'hold';
    release();
    if (phaseRef.current === 'held' || phaseRef.current === 'depart') return;
    setProgress(0);
    if (wasHolding) setRetry(true);
  }, [release]);
  useEffect(() => { if (paused) cancel(); }, [paused, cancel]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(!!media?.matches);
    const visibility = () => { setHidden(document.hidden); if (document.hidden) { blockedRef.current = true; cancel(); } };
    const blur = () => { blockedRef.current = true; setBlurred(true); cancel(); };
    const focus = () => setBlurred(false);
    motion(); visibility(); media?.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    return () => {
      media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      cancelAnimationFrame(frame.current); gesture.current = null;
    };
  }, [cancel]);
  useEffect(() => {
    if (blocked || document.hidden) return;
    if (phase === 'launch' && clock >= (reduced ? 200 : 1800)) transition('tap');
    if (phase === 'tap-reply' && clock >= 1000) transition('hold');
    if (phase === 'held' && clock >= 1000) transition('depart');
    if (phase === 'depart' && clock >= (reduced ? 300 : 1400) && !finished.current) {
      finished.current = true; callbacks.current.onArrive();
    }
  }, [clock, phase, blocked, reduced]);

  const canPress = () => !blockedRef.current && !document.hidden && (phaseRef.current === 'tap' || phaseRef.current === 'hold');
  const tap = () => {
    if (!canPress() || phaseRef.current !== 'tap') return;
    release(); transition('tap-reply'); callbacks.current.onFeedback?.('.');
  };
  const holdComplete = () => {
    if (!canPress() || phaseRef.current !== 'hold' || !gesture.current) return;
    transition('held'); release(); setProgress(1); callbacks.current.onFeedback?.('-');
  };
  const begin = (pointer: number | null, key: string | null, x = 0, y = 0) => {
    if (!canPress() || gesture.current) return;
    gesture.current = { pointer, key, x, y, at: performance.now(), phase: phaseRef.current as 'tap' | 'hold' };
    setPressing(true); setRetry(false); setProgress(0);
    if (phaseRef.current !== 'hold') return;
    const tick = () => {
      const press = gesture.current;
      if (!press || press.phase !== 'hold' || !canPress()) { cancel(); return; }
      const ratio = Math.min(1, (performance.now() - press.at) / OPENING_HOLD_MS);
      setProgress(ratio);
      if (ratio >= 1) holdComplete();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const end = (pointer: number | null, key: string | null) => {
    const press = gesture.current;
    if (!press || press.pointer !== pointer || press.key !== key) return;
    if (!canPress()) { cancel(); return; }
    const duration = performance.now() - press.at;
    if (press.phase === 'tap') {
      if (duration < OPENING_HOLD_MS) tap();
      else { cancel(); setRetry(true); }
    } else if (duration >= OPENING_HOLD_MS) holdComplete();
    else cancel();
  };

  const flight = phase === 'depart' ? Math.min(1, clock / (reduced ? 300 : 1400)) : 0;
  const ease = flight * flight * (3 - 2 * flight);
  const left = 27 + 23 * ease, top = 74 + 3 * ease - (reduced ? 0 : Math.sin(flight * Math.PI) * 25);
  const caption = phase === 'launch' ? '' : phase === 'tap' ? '星星闪烁时，轻点一下。'
    : phase === 'tap-reply' ? '它听见你了。' : phase === 'hold'
      ? retry ? '再试一次，按住直到光圈亮满。' : '光圈散开时，按住星星。'
      : '接住了。一起出发。';
  const interactive = phase === 'tap' || phase === 'hold';
  return <section className={'guiding-light opening-lesson' + (blocked ? ' path-paused' : '') + (pressing ? ' is-pressing' : '')}
    data-phase={phase} aria-label="学会与星光回应：闪烁时轻触，光圈散开时长按">
    <div className="guiding-sky">
      <svg className="guiding-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M27 74C39 60 65 74 72 43M72 43C70 60 59 66 50 77" />
      </svg>
      <span className="lesson-echo" aria-hidden="true"><span>✧</span></span>
      <button ref={light} className="guiding-carrier" disabled={blocked || !interactive}
        style={{ left: `${left}%`, top: `${top}%`, '--launch': reduced || phase !== 'launch' ? 1 : Math.min(1, clock / 1800), '--lesson-charge': progress } as CSSProperties}
        aria-label={phase === 'hold' ? '长按星星一秒，让光圈蓄满；键盘可按住空格或回车' : '轻点闪烁的星星'}
        aria-describedby="opening-lesson-caption" aria-pressed={pressing}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => {
          if (e.isPrimary === false || e.button > 0 || !canPress() || gesture.current) return;
          e.preventDefault(); begin(e.pointerId, null, e.clientX, e.clientY); e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const press = gesture.current;
          if (press?.pointer === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 32) cancel();
        }}
        onPointerUp={e => end(e.pointerId, null)} onPointerCancel={e => { if (gesture.current?.pointer === e.pointerId) cancel(); }}
        onLostPointerCapture={e => { if (gesture.current?.pointer === e.pointerId) cancel(); }} onBlur={cancel}
        onKeyDown={e => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault(); if (!e.repeat) begin(null, e.key);
        }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(null, e.key); } }}
        onClick={e => { if (e.detail === 0 && !gesture.current && phaseRef.current === 'tap') tap(); }}>
        <span className="lesson-ripples" aria-hidden="true"><i /><i /><i /></span>
        <svg className="lesson-charge" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="lesson-charge-track" cx="50" cy="50" r="43" />
          <circle className="lesson-charge-fill" cx="50" cy="50" r="43" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} />
        </svg>
        <span className="lesson-success" aria-hidden="true" />
        <CompanionLight choices={[]} pink={phase === 'held' || phase === 'depart'} />
      </button>
      <output id="opening-lesson-caption" className="lesson-caption" aria-live="polite">{caption}</output>
    </div>
  </section>;
}
