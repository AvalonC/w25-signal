'use client';
import { useEffect, useRef, useState } from 'react';
import { StarSapphire } from './star-sapphire';
import { useVisibleClock } from './scene-clock';
import { SAPPHIRE_QUOTES, sapphireCanAdvance } from '@/lib/journey';
import { MOTION } from '@/lib/motion';

type Phase = 'gather' | 'reveal' | 'explore' | 'depart';
export function SapphireScene({ rotation, paused, onProgress, onDone, onTap }: {
  rotation: number; paused: boolean; onProgress: (n: number) => void;
  onDone: () => void; onTap: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('gather');
  const [quote, setQuote] = useState(Math.min(2, Math.floor(rotation / 50)));
  const [turned, setTurned] = useState(false);
  const [angle, setAngle] = useState(0);
  const drag = useRef<{x: number; distance: number} | null>(null);
  const accepted = useRef(false), fired = useRef(false);
  useEffect(() => { if (paused) drag.current = null; }, [paused]);
  // Reading starts on the actual turn, so a long idle cannot skip a blessing.
  const clock = useVisibleClock(!paused, phase + ':' + quote + ':' + turned);
  useEffect(() => {
    if (paused) return;
    if (phase === 'gather' && clock >= MOTION.gather) setPhase('reveal');
    if (phase === 'reveal' && clock >= MOTION.reveal) setPhase('explore');
    if (phase === 'explore' && sapphireCanAdvance(clock, turned)) {
      onProgress((quote + 1) * 50);
      if (quote < 2) {
        setQuote((q) => q + 1); setTurned(false); accepted.current = false; drag.current = null;
      } else setPhase('depart');
    }
    if (phase === 'depart' && clock >= MOTION.release && !fired.current) {
      fired.current = true; onDone();
    }
  }, [phase, clock, turned, quote, paused, onDone, onProgress]);
  const reveal = () => {
    if (phase !== 'explore' || paused || accepted.current) return;
    accepted.current = true; setTurned(true); onTap();
  };
  const nudge = () => { if (paused || phase !== 'explore') return; setAngle((a) => a + Math.PI / 3); reveal(); };
  const active = phase === 'explore' && !paused;
  return <div className={'sapphire-constellation sapphire-' + phase + (paused ? ' is-paused' : '')}>
    <div className="sapphire-sky" role="group" aria-label="由星光构成的粉色蓝宝石"
      onPointerDown={(e) => {
        if (!active) return; drag.current = { x: e.clientX, distance: 0 }; e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d || !active) return;
        const delta = e.clientX - d.x; d.x = e.clientX; d.distance += Math.abs(delta);
        setAngle((a) => a + delta * .009);
        if (d.distance >= 55) reveal();
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
      <StarSapphire angle={angle} paused={paused} demonstrate={phase === 'reveal' || (active && !turned)}
        formation={phase === 'gather' ? clock / MOTION.gather : 1}
        release={phase === 'depart' ? clock / MOTION.release : 0} />
      {(phase === 'reveal' || phase === 'explore') && <div className={'rotation-guide ' + (turned ? 'is-reading' : '')} aria-hidden="true">
        <span>↔</span>
      </div>}
    </div>
    <div className="sapphire-words" aria-live="polite">
      {phase === 'gather' && <p className="motion-verse">十月八日的光，慢慢聚成一颗星。</p>}
      {phase === 'reveal' && <p className="motion-verse">左右转动它，点亮三个切面。</p>}
      {phase === 'explore' && <p key={quote + ':' + turned} className="motion-verse">
        {turned ? SAPPHIRE_QUOTES[quote] : quote === 0 ? '左右拖动星光，第一道祝福藏在切面里。' : '再转一点，点亮下一道祝福。'}
      </p>}
      {phase === 'depart' && <p className="motion-verse">让这颗星，继续替你传递祝福。</p>}
    </div>
    <div className={'sapphire-navigation ' + (phase === 'explore' ? 'visible' : '')} inert={!active}>
      <p className="sapphire-label">粉色蓝宝石 <span>{Math.min(3, quote + (turned ? 1 : 0))} / 3 道祝福</span></p>
      <button className="sapphire-rotate" onClick={nudge} disabled={!active || turned}>
        {turned ? quote === 2 ? '读完这道祝福，星光会继续前行' : '让这道祝福停留片刻' : '也可以轻触，转动一个切面'}
      </button>
      <div className="sapphire-steps" aria-hidden="true">
        {[0,1,2].map((i) => <i key={i} className={i < quote || (i === quote && turned) ? 'lit' : ''} />)}
      </div>
    </div>
  </div>;
}
