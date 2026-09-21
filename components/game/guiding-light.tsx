'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompanionLight } from './path-sky';
import { useVisibleClock } from './scene-clock';

export function GuidingLight({ choices = [], compact = false, paused = false, onArrive }: {
  choices?: number[]; compact?: boolean; paused?: boolean; onArrive: () => void;
}) {
  const origin = compact ? { x: 20, y: 64 } : { x: 27, y: 74 };
  const target = compact ? { x: 80, y: 30 } : { x: 72, y: 27 };
  const [point, setPoint] = useState(origin);
  const [near, setNear] = useState(false), [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false), [reduced, setReduced] = useState(false);
  const area = useRef<HTMLDivElement>(null), light = useRef<HTMLButtonElement>(null);
  const gesture = useRef<number | null>(null), started = useRef(false), done = useRef(false);
  const callback = useRef(onArrive); callback.current = onArrive;
  const time = useVisibleClock(leaving && !paused);
  const cancel = useCallback(() => {
    const id = gesture.current; gesture.current = null;
    if (id !== null && light.current?.hasPointerCapture(id)) light.current.releasePointerCapture(id);
    setNear(false);
  }, []);
  useEffect(() => { if (paused) cancel(); }, [paused, cancel]);
  useEffect(() => {
    const update = () => { setHidden(document.hidden); if (document.hidden) cancel(); };
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    update(); motion(); media?.addEventListener('change', motion);
    document.addEventListener('visibilitychange', update); window.addEventListener('blur', cancel);
    return () => {
      media?.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', update); window.removeEventListener('blur', cancel);
    };
  }, [cancel]);
  useEffect(() => {
    if (leaving && !paused && !document.hidden && time >= (reduced ? 300 : 1400) && !done.current) {
      done.current = true; callback.current();
    }
  }, [time, leaving, paused, reduced]);
  const arrive = () => {
    if (paused || document.hidden || started.current) return;
    started.current = true; cancel(); setPoint(target); setLeaving(true);
  };
  const locate = (x: number, y: number) => {
    const box = area.current!.getBoundingClientRect();
    const p = { x: Math.max(8, Math.min(92, (x - box.left) / box.width * 100)),
      y: Math.max(12, Math.min(88, (y - box.top) / box.height * 100)) };
    return { p, near: Math.hypot((p.x-target.x)*box.width/100, (p.y-target.y)*box.height/100) < 58 };
  };
  return <section className={'guiding-light' + (compact ? ' guiding-compact' : '') +
    (leaving ? ' guiding-arriving' : '') + (paused || hidden ? ' path-paused' : '')} aria-label={compact ? '带着三个愿望出发' : '接住一束光，走向远方的回应'}>
    {!compact && <h1 className="guiding-verse">那边，似乎有人在等。</h1>}
    <div ref={area} className="guiding-sky">
      <svg className="guiding-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={compact ? 'M20 64C37 74 45 55 51 51M58 44C65 41 72 34 80 30' : 'M27 74C54 79 42 53 49 49M57 40C72 40 63 23 72 27'} />
        <path className="guiding-joined" d={compact ? 'M51 51 58 44' : 'M49 49 57 40'} />
      </svg>
      <button className={'guiding-target' + (near ? ' is-near' : '')} style={{left: `${target.x}%`, top: `${target.y}%`}}
        disabled={paused || leaving} onClick={arrive} aria-label={compact ? '带着三个愿望，前往星路' : '把这束光带向远方，开始旅程'}>
        <span aria-hidden="true">✧</span>
      </button>
      <button ref={light} className="guiding-carrier" style={{left: `${point.x}%`, top: `${point.y}%`}}
        disabled={paused || leaving} aria-label="接住这束光，拖到远方的星；也可轻触远方或按回车"
        onPointerDown={(e) => {
          if (paused || started.current || document.hidden || gesture.current !== null || e.button > 0) return;
          e.preventDefault(); gesture.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (gesture.current !== e.pointerId || paused) return;
          const next = locate(e.clientX, e.clientY); setPoint(next.p); setNear(next.near);
        }}
        onPointerUp={(e) => {
          if (gesture.current !== e.pointerId) return;
          const next = locate(e.clientX, e.clientY); cancel(); if (next.near) arrive();
        }}
        onPointerCancel={cancel} onLostPointerCapture={cancel}
        onClick={(e) => { if (e.detail === 0) arrive(); }}>
        <CompanionLight choices={choices} pink={false} />
      </button>
      {!compact && <span className="guiding-far-whisper" aria-hidden="true">一瞬。停留。光在回应。</span>}
    </div>
    <output className="guiding-cue">{leaving ? '光记住了你，也记住了来时的路。' : near ? '松开，让两束光相遇。' : compact ? '带着三个愿望，走向那束光。' : '接住近处的光，带它走向远方。'}</output>
  </section>;
}
