'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StarSapphire } from './star-sapphire';
import { useVisibleClock } from './scene-clock';
import { MOTION } from '@/lib/motion';
import { DISCOVERY_READ_MS, SAPPHIRE_DISCOVERIES, SAPPHIRE_INTRO, nextSapphireDiscovery } from '@/lib/sapphire-discovery';

type Phase = 'orbits' | 'light' | 'weave' | 'explore' | 'resolve' | 'depart';
export function SapphireScene({ rotation, paused, onProgress, onDone, onTap }: {
  rotation: number; paused: boolean; onProgress: (n: number) => void;
  onDone: () => void; onTap: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('orbits');
  const [hidden, setHidden] = useState(false);
  const sky = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useLayoutEffect(() => {
    const el = sky.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    // The real dials keep their responsive layout. Measure their start centres
    // once so both collapse into the exact light source used by the canvas.
    el.closest('.birth-chapter')?.querySelectorAll<HTMLElement>('.date-wheels .dial-block').forEach((dial, i) => {
      const start = dial.getBoundingClientRect();
      dial.style.setProperty('--orbit-to-x', `${rect.left + rect.width * .5 - (start.left + start.width / 2)}px`);
      dial.style.setProperty('--orbit-to-y', `${(i === 0 ? -25 : 55) + rect.top + rect.height * .47 - (start.top + start.height / 2)}px`);
    });
  }, []);
  // New visits begin with an unnamed, uncoloured stone. Resume completed
  // discoveries without letting saved progress skip their introduction.
  const restored = Math.min(2, Math.floor(rotation / 50) - 1);
  const [discovery, setDiscovery] = useState(restored);
  const [angle, setAngle] = useState(0), [travel, setTravel] = useState(
    restored >= 0 ? SAPPHIRE_DISCOVERIES[restored].distance : 0);
  const drag = useRef<{x: number} | null>(null);
  const fired = useRef(false), lastReveal = useRef(0);
  const sceneTime = useVisibleClock(!paused, phase);
  const readingTime = useVisibleClock(!paused && phase === 'explore', discovery);
  useEffect(() => { if (paused) drag.current = null; }, [paused]);
  useEffect(() => {
    if (paused) return;
    if (phase === 'orbits' && sceneTime >= SAPPHIRE_INTRO.orbits) setPhase('light');
    if (phase === 'light' && sceneTime >= SAPPHIRE_INTRO.light) setPhase('weave');
    if (phase === 'weave' && sceneTime >= SAPPHIRE_INTRO.weave) setPhase('explore');
    if (phase === 'explore') {
      const next = nextSapphireDiscovery(discovery, travel, readingTime);
      if (next !== discovery) {
        setDiscovery(next); lastReveal.current = sceneTime; onProgress((next + 1) * 50); onTap();
      }
      if (discovery === 2 && readingTime >= DISCOVERY_READ_MS + 1400) setPhase('resolve');
    }
    if (phase === 'resolve' && sceneTime >= 5000) setPhase('depart');
    if (phase === 'depart' && sceneTime >= MOTION.release && !fired.current) {
      fired.current = true; onDone();
    }
  }, [phase, sceneTime, readingTime, discovery, travel, paused, onProgress, onDone, onTap]);
  const active = phase === 'explore' && !paused;
  const rotate = (delta: number) => {
    if (!active) return;
    setAngle((a) => a + delta); setTravel((v) => v + Math.abs(delta));
  };
  const entry = discovery >= 0 ? SAPPHIRE_DISCOVERIES[discovery] : null;
  const formation = phase === 'orbits' || phase === 'light' ? 0 : phase === 'weave' ? sceneTime / SAPPHIRE_INTRO.weave : 1;
  const tint = discovery >= 2 ? 1 : discovery === 1 ? Math.min(.7, Math.max(0, (travel - 1.45) / 1.2)) : 0;
  const idle = active && (sceneTime - lastReveal.current > 8000);
  return <div className={'sapphire-constellation sapphire-' + phase + (paused || hidden ? ' is-paused' : '')}>
    <div ref={sky} className="sapphire-sky" role="group" aria-label="转动星光，发现宝石、天秤与粉色之间的联系"
      onPointerDown={(e) => {
        if (!active) return; drag.current = { x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d || !active) return;
        const delta = Math.max(-.2, Math.min(.2, (e.clientX - d.x) * .008));
        d.x = e.clientX; rotate(delta);
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <StarSapphire angle={angle} paused={paused} demonstrate={active && travel < .1}
        formation={formation} release={phase === 'depart' ? sceneTime / MOTION.release : 0}
        origin={phase === 'orbits' || phase === 'light' || phase === 'weave' ? 'light' : 'stars'}
        light={phase === 'orbits' ? sceneTime / SAPPHIRE_INTRO.orbits : phase === 'light' ? 1 : 0}
        dust={phase === 'light' ? sceneTime / SAPPHIRE_INTRO.light : phase === 'orbits' ? 0 : 1}
        tint={tint} libra={discovery >= 1 && phase !== 'orbits' && phase !== 'light' && phase !== 'weave'} />
      {active && discovery < 0 && <div className="rotation-guide" aria-hidden="true"><span>↔</span></div>}
    </div>
    <div className="sapphire-discovery-copy" aria-live="polite">
      {phase === 'orbits' && <p className="motion-verse">这一天的星光，正在相遇。</p>}
      {(phase === 'light' || phase === 'weave') && <p className="motion-verse">你来时的光，还在。</p>}
      {phase === 'explore' && (entry ? <div key={discovery} className="sapphire-identity motion-verse">
        <span className="identity-overline">{entry.english}</span>
        <h2>{entry.name}</h2><p>{entry.line}</p>
      </div> : <p className="motion-verse">轻轻转动，看看光里藏着什么。</p>)}
      {phase === 'resolve' && <div className="sapphire-identity motion-verse">
        <span className="identity-overline">SAPPHIRE · LIBRA · YOUR PINK</span>
        <h2>你的日子，你的颜色。</h2>
        <p>愿你珍爱的，都能陪你走过新的岁月。</p>
      </div>}
      {phase === 'depart' && <p className="motion-verse">还有三个愿望，等着一起出发。</p>}
    </div>
    <div className="sapphire-discovery-controls" inert={!active}>
      <button className="sapphire-rotate" onClick={() => rotate(.7)} disabled={!active}
        aria-label="转动宝石，继续发现它的含义">
        {idle ? '轻触这里，也能让星光转动' : discovery < 0 ? '转动星光' : discovery < 2 ? '继续转动，看看另一面' : '让喜欢的颜色，在光里停留'}
      </button>
      {active && discovery >= 0 && <div className="sapphire-keepsakes" aria-label="已经发现的含义">
        <span>蓝宝石</span>{discovery >= 1 && <span>♎ 天秤</span>}{discovery >= 2 && <span className="pink-keepsake">你的粉色</span>}
      </div>}
    </div>
  </div>;
}
