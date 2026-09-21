'use client';
// Visible scene clocks coordinate an imperative canvas and pointer surface.
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
// This keyboard canvas group also contains an independently focusable exit.
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StarSapphire } from './star-sapphire';
import { useVisibleClock } from './scene-clock';
import { MOTION } from '@/lib/motion';
import { DISCOVERY_DWELL_MS, SAPPHIRE_DISCOVERIES, SAPPHIRE_INTRO,
  nextSapphireDiscovery, restoredSapphireDiscovery, sapphireAlignment } from '@/lib/sapphire-discovery';

type Phase = 'orbits' | 'light' | 'weave' | 'explore' | 'depart';
export function SapphireScene({ rotation, paused, onProgress, onDone, onTap, fromPath = false }: {
  rotation: number; paused: boolean; onProgress: (n: number) => void;
  onDone: () => void; onTap: () => void; fromPath?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(fromPath ? 'explore' : 'orbits');
  const [hidden, setHidden] = useState(false), [blurred, setBlurred] = useState(false);
  const [discovery, setDiscovery] = useState(() => restoredSapphireDiscovery(rotation));
  const [angle, setAngle] = useState(fromPath ? .32 : 0);
  const [engaged, setEngaged] = useState(false), [dragging, setDragging] = useState(false);
  const [gesture, setGesture] = useState(0);
  const sky = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; start: number; engaged: boolean } | null>(null);
  const callbacks = useRef({ onProgress, onDone, onTap }); callbacks.current = { onProgress, onDone, onTap };
  const fired = useRef(false), departing = useRef(false), announced = useRef(discovery);
  const visible = !paused && !hidden && !blurred;
  const active = phase === 'explore' && visible;
  const target = Math.min(2, discovery + 1);
  const alignment = sapphireAlignment(angle, target);
  const sceneTime = useVisibleClock(visible, phase);
  const readingTime = useVisibleClock(visible && phase === 'explore', discovery);
  const dwell = useVisibleClock(active && engaged && !dragging && alignment.aligned && discovery < 2,
    `${target}:${angle}:${gesture}`);

  const cancel = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setAngle(current.start); setEngaged(current.engaged); setDragging(false);
    setGesture((n) => n + 1);
  }, []);
  useEffect(() => {
    const changed = () => { setHidden(document.hidden); if (document.hidden) cancel(); };
    const blur = () => { setBlurred(true); cancel(); };
    const focus = () => setBlurred(false);
    changed(); document.addEventListener('visibilitychange', changed);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    return () => { document.removeEventListener('visibilitychange', changed);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); };
  }, [cancel]);
  useEffect(() => { if (paused) cancel(); }, [paused, cancel]);
  useLayoutEffect(() => {
    const el = sky.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    el.closest('.birth-chapter')?.querySelectorAll<HTMLElement>('.date-wheels .dial-block').forEach((dial, i) => {
      const start = dial.getBoundingClientRect();
      dial.style.setProperty('--orbit-to-x', `${rect.left + rect.width * .5 - (start.left + start.width / 2)}px`);
      dial.style.setProperty('--orbit-to-y', `${(i === 0 ? -25 : 55) + rect.top + rect.height * .47 - (start.top + start.height / 2)}px`);
    });
  }, []);
  useEffect(() => {
    if (!visible) return;
    if (phase === 'orbits' && sceneTime >= SAPPHIRE_INTRO.orbits) setPhase('light');
    if (phase === 'light' && sceneTime >= SAPPHIRE_INTRO.light) setPhase('weave');
    if (phase === 'weave' && sceneTime >= SAPPHIRE_INTRO.weave) setPhase('explore');
    if (phase === 'explore' && engaged && !dragging) {
      const next = nextSapphireDiscovery(discovery, angle, dwell, readingTime);
      if (next > discovery && next > announced.current) {
        announced.current = next; setDiscovery(next); setEngaged(false);
        callbacks.current.onProgress((next + 1) * 50); callbacks.current.onTap();
      }
    }
    if (phase === 'depart' && sceneTime >= MOTION.release && !fired.current) {
      fired.current = true; callbacks.current.onDone();
    }
  }, [phase, sceneTime, readingTime, discovery, angle, dwell, engaged, dragging, visible]);

  const rotate = (delta: number) => {
    if (!active || document.hidden || departing.current) return;
    setAngle((value) => value + delta); setEngaged(true);
  };
  const leave = () => {
    if (!active || document.hidden || discovery !== 2 || departing.current) return;
    departing.current = true; drag.current = null; setDragging(false);
    callbacks.current.onTap(); setPhase('depart');
  };
  const entry = discovery >= 0 ? SAPPHIRE_DISCOVERIES[discovery] : null;
  const formation = phase === 'orbits' || phase === 'light' ? 0 : phase === 'weave' ? sceneTime / SAPPHIRE_INTRO.weave : 1;
  const hint = discovery === 2 ? '轻触那束粉光，把愿望带向远方。'
    : engaged && alignment.aligned ? '就在这里，让光停一会儿。' : SAPPHIRE_DISCOVERIES[target].hint;
  return <div className={'sapphire-constellation sapphire-angle-discovery sapphire-' + phase + (!visible ? ' is-paused' : '')}
    data-discovery={discovery}>
    {fromPath && <p className="path-place-whisper">你的颜色，留在了星光里。</p>}
    <div ref={sky} className="sapphire-sky" role="group" tabIndex={active ? 0 : -1}
      aria-label="转动宝石，让切面、天秤星图与粉光依次对齐" aria-disabled={!active}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); rotate(e.key === 'ArrowLeft' ? -.18 : .18);
      }}
      onPointerDown={(e) => {
        if (!active || document.hidden || drag.current || e.button > 0 || discovery === 2) return;
        e.preventDefault(); drag.current = { id: e.pointerId, x: e.clientX, start: angle, engaged };
        setDragging(true); e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const current = drag.current; if (!current || current.id !== e.pointerId || !active) return;
        const delta = Math.max(-.28, Math.min(.28, (e.clientX - current.x) * .008));
        current.x = e.clientX; rotate(delta);
      }}
      onPointerUp={(e) => {
        if (drag.current?.id !== e.pointerId) return;
        drag.current = null; setDragging(false);
      }}
      onPointerCancel={cancel} onLostPointerCapture={cancel}>
      <StarSapphire angle={angle} paused={!visible} demonstrate={false}
        formation={formation} release={phase === 'depart' ? sceneTime / MOTION.release : 0}
        origin={phase === 'orbits' || phase === 'light' || phase === 'weave' ? 'light' : 'stars'}
        light={phase === 'orbits' ? sceneTime / SAPPHIRE_INTRO.orbits : phase === 'light' ? 1 : 0}
        dust={phase === 'light' ? sceneTime / SAPPHIRE_INTRO.light : phase === 'orbits' ? 0 : 1}
        tint={fromPath || discovery >= 2 ? 1 : discovery === 1 ? alignment.strength : 0}
        infusion={fromPath ? 1 : 0} libra={fromPath || discovery >= 1}
        discovery={phase === 'explore' || phase === 'depart' ? {
          target, found: discovery, strength: alignment.strength,
          dwell: Math.min(1, dwell / DISCOVERY_DWELL_MS), exit: discovery === 2,
        } : undefined} />
      {discovery === 2 && <button className="sapphire-exit-light" disabled={!active}
        aria-label="触碰出口的粉光，带着愿望继续" title="带着愿望继续"
        onPointerDown={(e) => e.stopPropagation()} onClick={leave}>
        <span aria-hidden="true" className="sapphire-exit-star" />
      </button>}
    </div>
    <div className="sapphire-discovery-copy" aria-live="polite">
      {phase === 'orbits' && <p className="motion-verse">这一天的星光，正在相遇。</p>}
      {(phase === 'light' || phase === 'weave') && <p className="motion-verse">你来时的光，还在。</p>}
      {phase === 'explore' && (entry ? <div key={discovery} className="sapphire-identity motion-verse">
        <span className="identity-overline">{entry.english}</span><h2>{entry.name}</h2><p>{entry.line}</p>
      </div> : <p className="motion-verse">轻轻转动，看看光里藏着什么。</p>)}
      {phase === 'depart' && <p className="motion-verse">还有三个愿望，等着一起出发。</p>}
    </div>
    <div className="sapphire-discovery-controls" inert={!active}>
      <div className="sapphire-turn-controls">
        <button type="button" disabled={!active || discovery === 2} onClick={() => rotate(-.18)}
          aria-label="向左转动宝石" title="向左转动宝石"><ChevronLeft size={21} strokeWidth={1.35} /></button>
        <p className="sapphire-angle-hint" aria-live="polite">{hint}</p>
        <button type="button" disabled={!active || discovery === 2} onClick={() => rotate(.18)}
          aria-label="向右转动宝石" title="向右转动宝石"><ChevronRight size={21} strokeWidth={1.35} /></button>
      </div>
      {discovery >= 0 && <div className="sapphire-keepsakes" aria-label="已经发现的含义">
        <span>蓝宝石</span>{discovery >= 1 && <span>♎ 天秤</span>}{discovery >= 2 && <span className="pink-keepsake">你的粉色</span>}
      </div>}
    </div>
  </div>;
}
