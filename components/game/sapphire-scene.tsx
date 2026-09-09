'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ModelSurface } from './model-surface';
import { useVisibleClock } from './scene-clock';
import { sapphireCanAdvance, SAPPHIRE_QUOTES } from '@/lib/journey';

type Phase = 'gather' | 'reveal' | 'explore' | 'depart';
export function SapphireScene({ rotation, paused, onProgress, onDone, onTap }: {
  rotation: number; paused: boolean; onProgress: (n: number) => void;
  onDone: () => void; onTap: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('gather');
  const [quote, setQuote] = useState(Math.min(2, Math.floor(rotation / 50)));
  const [turned, setTurned] = useState(false);
  const [angle, setAngle] = useState(0);
  const drag = useRef<{x: number; y: number; distance: number} | null>(null);
  const clock = useVisibleClock(!paused, phase + ':' + quote);
  const fired = useRef(false);
  useEffect(() => {
    if (paused) return;
    if (phase === 'gather' && clock >= 3200) setPhase('reveal');
    if (phase === 'reveal' && clock >= 2000) setPhase('explore');
    if (phase === 'explore' && sapphireCanAdvance(clock, turned)) {
      onProgress((quote + 1) * 50);
      if (quote < 2) { setQuote((q) => q + 1); setTurned(false); }
      else setPhase('depart');
    }
    if (phase === 'depart' && clock >= 1900 && !fired.current) {
      fired.current = true; onDone();
    }
  }, [phase, clock, turned, quote, paused, onDone, onProgress]);
  const turn = () => {
    if (phase !== 'explore' || paused || turned) return;
    setTurned(true); setAngle((a) => a + 45); onTap();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || phase !== 'explore' || paused) return;
    d.distance += Math.hypot(e.clientX - d.x, e.clientY - d.y);
    d.x = e.clientX; d.y = e.clientY;
    if (d.distance >= 55) turn();
  };
  return <div className={'sapphire-story sapphire-' + phase + (paused ? ' is-paused' : '')}
    style={{ '--facet-turn': angle + 'deg' } as CSSProperties}>
    <div className="gathering-orbits" aria-hidden="true">
      <span className="orbit-month">♎<small>X</small></span>
      <span className="orbit-day">VIII<small>08</small></span>
      <i className="incoming-light first-light" /><i className="incoming-light second-light" />
    </div>
    <div className="star-seed" aria-hidden="true">✦</div>
    <div className="sapphire-object" inert={phase !== 'explore' || paused}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, distance: 0 }; }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}>
      <ModelSurface src="models/sapphire-star.glb" poster="sapphire-preview.png"
        label="四角星银镶座中的粉色蓝宝石，转动可观察切面反光"
        orbit={angle + 'deg 25deg 110%'} />
      <span key={angle} className={'facet-sweep ' + (turned ? 'sweeping' : '')} aria-hidden="true" />
    </div>
    <div className="sapphire-prose" aria-live="polite">
      {phase === 'gather' && <p>十月八日，光有了停留的理由。</p>}
      {phase === 'reveal' && <p>有一颗星，把这一天收进了心里。</p>}
      {phase === 'explore' && <p key={quote} className="facet-verse">{SAPPHIRE_QUOTES[quote]}</p>}
      {phase === 'depart' && <p>让这束光，替你把祝福带向远方。</p>}
    </div>
    {phase === 'explore' && <>
      <p className="sapphire-caption">粉色蓝宝石 <span>PINK SAPPHIRE</span></p>
      <button className="soft-button sapphire-turn-button" onClick={turn} disabled={turned || paused}>
        {turned ? '让这道光，再停留一会' : '转动，让另一道光经过'}
      </button>
      <div className="facet-dots" aria-label={'第 ' + (quote + 1) + ' 道祝福'}>
        {[0, 1, 2].map((i) => <i key={i} className={i <= quote ? 'lit' : ''} />)}
      </div>
    </>}
    <i className="outgoing-light" aria-hidden="true" />
  </div>;
}
