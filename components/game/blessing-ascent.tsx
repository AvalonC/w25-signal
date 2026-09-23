'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BLESSING_ASCENT, blessingDuration, blessingFrame, blessingLines, type BlessingOrigin } from '@/lib/blessing-ascent';
import { useVisibleClock } from './scene-clock';

export function BlessingAscent({ choices, paused, origin, onExit, onFeedback }: {
  choices: number[]; paused: boolean; origin?: BlessingOrigin | null;
  onExit: () => void; onFeedback?: () => void;
}) {
  const [hidden, setHidden] = useState(false), [blurred, setBlurred] = useState(false), [reduced, setReduced] = useState(()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [hold, setHold] = useState(0), [exited, setExited] = useState(false), [settled, setSettled] = useState(false);
  const held = useRef<{ at: number; pointer: number | null; key: string | null; node?: HTMLButtonElement } | null>(null);
  const raf = useRef(0), completed = useRef(false), keyboardClickUntil = useRef(-1);
  const callbacks = useRef({ onExit, onFeedback });
  callbacks.current = { onExit, onFeedback };
  const lines = useMemo(() => blessingLines(choices), [choices]);
  const elapsed = useVisibleClock(!paused && !hidden && !blurred && !exited && !settled);
  const frame = blessingFrame(settled ? Math.max(elapsed, blessingDuration(lines.length, reduced)) : elapsed, lines.length, origin, reduced);
  const blocked = paused || hidden || blurred || exited || !frame.ready;
  const allowed = useRef(false);
  allowed.current = !blocked;
  const cancel = () => {
    const previous = held.current;
    held.current = null;
    cancelAnimationFrame(raf.current);
    setHold(0);
    if (previous?.pointer !== null && previous?.pointer !== undefined && previous.node?.hasPointerCapture?.(previous.pointer)) {
      previous.node.releasePointerCapture(previous.pointer);
    }
  };
  const finish = () => {
    if (!allowed.current || document.hidden || completed.current) return;
    completed.current = true;
    cancel(); setExited(true);
    callbacks.current.onFeedback?.();
    callbacks.current.onExit();
  };
  const begin = (pointer: number | null, key: string | null, node?: HTMLButtonElement) => {
    if (!allowed.current || document.hidden || held.current) return;
    held.current = { at: performance.now(), pointer, key, node };
    callbacks.current.onFeedback?.();
    const tick = (now: number) => {
      if (!held.current || !allowed.current || document.hidden) { cancel(); return; }
      const progress = Math.min(1, (now - held.current.at) / BLESSING_ASCENT.hold);
      setHold(progress);
      if (progress >= 1) finish();
      else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(!!media?.matches);
    changed(); media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const visibility = () => { setHidden(document.hidden); if (document.hidden) { allowed.current = false; cancel(); } };
    const blur = () => { allowed.current = false; setBlurred(true); cancel(); };
    const focus = () => setBlurred(false);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      cancelAnimationFrame(raf.current);
    };
  }, []);
  useEffect(() => { if (blocked) cancel(); }, [blocked]);
  useEffect(() => { if (frame.ready) setSettled(true); }, [frame.ready]);

  return <section className={'blessing-ascent' + (paused || hidden || blurred ? ' is-paused' : '') + (reduced ? ' is-reduced' : '') + (frame.ready ? ' is-ready' : '')}
    data-phase={frame.phase} aria-label="写给你的生日祝福" style={{ '--blessing-hold': hold, '--blessing-focus': frame.focus } as CSSProperties}>
    <div className="blessing-sky-glow" aria-hidden="true" />
    <div className="blessing-dust" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${6 + ((i * 37) % 88)}%`, top: `${12 + ((i * 23) % 80)}%`, '--dust-delay': `${i * -.43}s`, '--dust-size': `${i % 4 === 0 ? 3 : 1.5}px` } as CSSProperties} />)}
    </div>
    <div className="blessing-starthread" aria-hidden="true" style={{ top: `${frame.point.y * 100}%`, height: `${Math.max(0, .55 - frame.point.y) * 100}%`, opacity: frame.trail }} />
    <button className="blessing-main-star" type="button" disabled={blocked}
      aria-label={frame.ready ? '长按星光三秒，回到星空。辅助技术可激活直接返回星空。' : '星光正在带来祝福'}
      aria-describedby={frame.ready ? 'blessing-exit-hint' : undefined}
      style={{ left: `${frame.point.x * 100}%`, top: `${frame.point.y * 100}%`, opacity: frame.starOpacity }}
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0 || !allowed.current || document.hidden || held.current) return;
        e.preventDefault(); keyboardClickUntil.current = -1;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin(e.pointerId, null, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (held.current?.pointer !== e.pointerId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2)) > Math.max(64, rect.width * .9)) cancel();
      }}
      onPointerUp={(e) => { if (held.current?.pointer === e.pointerId) cancel(); }}
      onPointerCancel={(e) => { if (held.current?.pointer === e.pointerId) cancel(); }}
      onLostPointerCapture={(e) => { if (held.current?.pointer === e.pointerId) cancel(); }}
      onKeyDown={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault(); keyboardClickUntil.current = performance.now() + 300;
        if (!e.repeat) begin(null, e.key);
      }}
      onKeyUp={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault(); keyboardClickUntil.current = performance.now() + 300;
        if (held.current?.pointer === null && held.current.key === e.key) cancel();
      }}
      onClick={(e) => {
        if (e.detail !== 0 || performance.now() <= keyboardClickUntil.current || held.current) return;
        finish();
      }}
      onContextMenu={(e) => e.preventDefault()} onBlur={cancel}>
      <span className="blessing-hold-ripple blessing-ripple-one" aria-hidden="true" />
      <span className="blessing-hold-ripple blessing-ripple-two" aria-hidden="true" />
      <svg className="blessing-hold-track" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" pathLength="1" style={{ strokeDasharray: `${hold} 1` }} /></svg>
      <svg className="blessing-star-shape" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 58 40 91 50 58 60 50 94 42 60 9 50 42 40Z" /><circle cx="50" cy="50" r="5" /></svg>
    </button>
    <div className="blessing-verses" aria-live="polite" aria-atomic="false" style={{ top: `${frame.verseTop * 100}%` }}>
      {lines.map((line, i) => <div key={`${i}-${line}`} className={'blessing-verse' + (i === 0 ? ' blessing-heading' : i === lines.length - 1 ? ' blessing-last' : '')}
        aria-hidden={frame.lines[i] === 0} style={{ opacity: frame.lines[i], transform: `translateY(${reduced ? 0 : (1 - frame.lines[i]) * 9}px)` }}>
        {frame.lines[i] > 0 ? line : null}
      </div>)}
    </div>
    <p className="blessing-exit-hint" id="blessing-exit-hint" aria-hidden={!frame.ready} style={{ opacity: frame.ready ? 1 : 0 }}>长按星光，回到星空</p>
  </section>;
}
