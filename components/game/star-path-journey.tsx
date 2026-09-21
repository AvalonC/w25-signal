'use client';
// Scene clocks feed an imperative transition controller, outside React Compiler.
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PathSky, CompanionLight } from './path-sky';
import { DateDial } from './date-dial';
import { PrismLight } from './prism-light';
import { StarSapphire } from './star-sapphire';
import { SapphireScene } from './sapphire-scene';
import { useVisibleClock } from './scene-clock';
import { MOTION } from '@/lib/motion';
import { NOUNS } from '@/lib/journey';
import { SAPPHIRE_INTRO } from '@/lib/sapphire-discovery';
import { visitPath, completePrismPath, completeDatePath, infusePath, type StarPathState } from '@/lib/star-path';
import { infusionFrame } from '@/lib/light-infusion';

type Props = {
  path: StarPathState; choices: number[]; month: number; day: number; rotation: number; paused: boolean;
  onPath: (path: StarPathState) => void; onDate: (month: number, day: number) => void;
  onRotation: (rotation: number) => void; onComplete: () => void; onTap: () => void;
};

/** All three places share one saved journey. Discoveries change the sky itself. */
export function StarPathJourney(props: Props) {
  const { path, choices, paused, onPath, onTap } = props;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const visit = (place: StarPathState['place']) => {
    if (paused) return;
    const next = visitPath(path, place);
    if (next.place === path.place) return;
    onTap(); onPath(next);
  };
  return <section className={'star-path-journey' + (paused ? ' path-paused' : '') + (hidden ? ' path-motion-paused' : '')} aria-label="陪星光接通归路">
    {path.place !== 'sky' && <nav className="path-home" aria-label="同行的光">
      <CompanionLight choices={choices} pink={path.color} compact
        onClick={() => visit('sky')} label="带着光回到星路" />
      <span aria-hidden="true">回到星路</span>
    </nav>}
    <div key={path.place} className={'path-view path-view-' + path.place} inert={paused}>
      {path.place === 'sky' && <PathSky choices={choices} color={path.color} dateFound={path.dateFound}
        paused={paused} onVisit={visit} />}
      {path.place === 'prism' && <PrismPlace found={path.color} paused={paused} onTap={onTap}
        onFound={() => onPath(completePrismPath(path))}>
        {path.color && <div className="path-discovery-return">
          <p>看不见的路，被你喜欢的颜色照亮了。</p>
          <CompanionLight choices={choices} pink onClick={() => visit('sky')} label="带着粉光回到星路" />
          <small>轻触同行的光，带它回去。</small>
          <p className="path-wish-verse">{NOUNS[choices[0]]?.[2]}</p>
        </div>}
      </PrismPlace>}
      {path.place === 'date' && <DatePlace month={props.month} day={props.day} found={path.dateFound}
        paused={paused} onDate={props.onDate} onTap={onTap} onFound={() => onPath(completeDatePath(path))}>
        {path.dateFound && <div className="path-discovery-return">
          <p>十月八日的星光，在这里留下了形状。</p>
          <CompanionLight choices={choices} pink={path.color} onClick={() => visit('sky')} label="带着这一天的星光回到星路" />
          <small>轻触同行的光，记住它的位置。</small>
          <p className="path-wish-verse">{NOUNS[choices[1]]?.[2]}</p>
        </div>}
      </DatePlace>}
      {path.place === 'sapphire' && (path.infused
        ? <SapphireScene fromPath rotation={props.rotation} paused={paused} onProgress={props.onRotation}
            onTap={onTap} onDone={props.onComplete} />
        : <LightIntoStone choices={choices} paused={paused} onInfuse={() => {
            onTap(); onPath(infusePath(path));
          }} />)}
    </div>
  </section>;
}

function PrismPlace({ found, paused, onFound, onTap, children }: {
  found: boolean; paused: boolean; onFound: () => void; onTap: () => void; children: React.ReactNode;
}) {
  const [value, setValue] = useState(found ? 68 : 16);
  const [bloom, setBloom] = useState(false);
  const aligned = Math.abs(value - 68) <= 3;
  const dwell = useVisibleClock(aligned && !paused && !found && !bloom, aligned ? 'aligned' : 'search');
  const elapsed = useVisibleClock(bloom && !paused && !found);
  const sent = useRef(false);
  const callbacks = useRef({ onFound, onTap }); callbacks.current = { onFound, onTap };
  useEffect(() => {
    if (paused || found) return;
    if (!bloom && dwell >= 600) { setValue(68); setBloom(true); callbacks.current.onTap(); }
    if (bloom && elapsed >= MOTION.prismBloom && !sent.current) {
      sent.current = true; callbacks.current.onFound();
    }
  }, [dwell, elapsed, bloom, found, paused]);
  return <div className={'path-prism-view' + (found ? ' path-found' : '')}>
    <PrismLight value={value} bloom={found ? MOTION.prismBloom : elapsed} paused={paused} locked={bloom || found}
      onChange={(n) => {
        // A quick sweep must not jump over the small colour window completely.
        setValue((previous) => previous < 65 && n > 71 || previous > 71 && n < 65
          ? 68 : Math.min(100, Math.max(0, n)));
      }} />
    {children}
  </div>;
}

function DatePlace({ month, day, found, paused, onDate, onFound, onTap, children }: {
  month: number; day: number; found: boolean; paused: boolean;
  onDate: (month: number, day: number) => void; onFound: () => void; onTap: () => void; children: React.ReactNode;
}) {
  const [gathering, setGathering] = useState(false);
  const aligned = month === 10 && day === 8;
  const dwell = useVisibleClock(aligned && !paused && !found && !gathering, aligned ? 'aligned' : 'search');
  const elapsed = useVisibleClock(gathering && !paused && !found);
  const sky = useRef<HTMLDivElement>(null), done = useRef(false);
  const callbacks = useRef({ onFound, onTap }); callbacks.current = { onFound, onTap };
  const { orbits, light, weave } = SAPPHIRE_INTRO;
  useEffect(() => {
    if (paused || found) return;
    if (!gathering && dwell >= 650) { setGathering(true); callbacks.current.onTap(); }
    if (gathering && elapsed >= orbits + light + weave && !done.current) {
      done.current = true; callbacks.current.onFound();
    }
  }, [dwell, elapsed, gathering, found, paused, orbits, light, weave]);
  useLayoutEffect(() => {
    if (!gathering || !sky.current) return;
    const rect = sky.current.getBoundingClientRect();
    sky.current.closest('.birth-chapter')?.querySelectorAll<HTMLElement>('.dial-block').forEach((dial, i) => {
      const start = dial.getBoundingClientRect();
      dial.style.setProperty('--orbit-to-x', `${rect.left + rect.width * .5 - (start.left + start.width / 2)}px`);
      dial.style.setProperty('--orbit-to-y', `${(i === 0 ? -25 : 55) + rect.top + rect.height * .47 - (start.top + start.height / 2)}px`);
    });
  }, [gathering]);
  const forming = found || elapsed >= orbits + light;
  return <div className={'path-date-view birth-chapter' + (gathering || found ? ' is-unveiling' : '')}>
    <p className="path-place-whisper">{found ? '这一天的光，还在。' : gathering ? '两段时光，正在相遇。' : '让时光，停在你来到世上的那天。'}</p>
    {!found && <div className="date-wheels" inert={gathering || paused} aria-hidden={gathering}>
      <DateDial label="月" value={month} max={12} kind="month" paused={paused || gathering} aligned={month === 10} onChange={(n) => { if (!paused) { onDate(n, day); onTap(); } }} />
      <DateDial label="日" value={day} max={31} kind="day" paused={paused || gathering} aligned={day === 8} onChange={(n) => { if (!paused) { onDate(month, n); onTap(); } }} />
    </div>}
    <div ref={sky} className={'path-date-light' + (gathering || found ? ' is-visible' : '')} aria-hidden="true">
      <StarSapphire formation={found ? 1 : forming ? Math.min(1, (elapsed - orbits - light) / weave) : 0}
        release={0} angle={.32} paused={paused || (!gathering && !found)} demonstrate={false}
        origin="light" light={Math.min(1, elapsed / orbits)}
        dust={found ? 1 : Math.max(0, Math.min(1, (elapsed - orbits) / light))} tint={0} libra={found} />
    </div>
    {!found && !gathering && <p className="path-date-memory">十月 · 八日</p>}
    {children}
  </div>;
}

function LightIntoStone({ choices, paused, onInfuse }: { choices: number[]; paused: boolean; onInfuse: () => void }) {
  const [point, setPoint] = useState({ x: 24, y: 79 });
  const [near, setNear] = useState(false), [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [reduced, setReduced] = useState(false);
  const area = useRef<HTMLDivElement>(null), pointer = useRef<number | null>(null);
  const begun = useRef(false), done = useRef(false);
  const lastPoint = useRef(point), callback = useRef(onInfuse); callback.current = onInfuse;
  const elapsed = useVisibleClock(!!source && !paused);
  const effect = infusionFrame(elapsed, reduced);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const cancel = useCallback(() => {
    pointer.current = null; setDragging(false);
    if (begun.current) return;
    lastPoint.current = { x: 24, y: 79 }; setPoint(lastPoint.current); setNear(false); setTrail([]);
  }, []);
  useEffect(() => { if (paused) cancel(); }, [paused, cancel]);
  useEffect(() => {
    const stop = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', stop); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('blur', cancel); };
  }, [cancel]);
  useEffect(() => {
    if (!source || paused || !effect.done || done.current) return;
    done.current = true; callback.current();
  }, [source, paused, effect.done]);
  const deliver = (from = lastPoint.current) => {
    if (paused || begun.current || document.hidden) return;
    begun.current = true; pointer.current = null; setDragging(false);
    setNear(true); setSource({ x: from.x, y: from.y }); setTrail([]);
  };
  const position = (x: number, y: number) => {
    const r = area.current!.getBoundingClientRect();
    return { x: Math.max(7, Math.min(93, (x - r.left) / r.width * 100)),
      y: Math.max(8, Math.min(90, (y - r.top) / r.height * 100)),
      near: Math.hypot(x - (r.left + r.width * .5), y - (r.top + r.height * .47)) < Math.min(90, r.width * .23) };
  };
  const attract = (t: number) => {
    const p = source ?? point, u = 1 - t;
    const bend = Math.min(10, Math.hypot(50 - p.x, 47 - p.y) * .26);
    const control = { x: (p.x + 50) / 2 - bend, y: (p.y + 47) / 2 - bend };
    return { x: u*u*p.x + 2*u*t*control.x + t*t*50, y: u*u*p.y + 2*u*t*control.y + t*t*47 };
  };
  const carried = source && !reduced ? attract(effect.pull) : point;
  const ray = source && !reduced
    ? Array.from({ length: 12 }, (_, i) => attract(Math.max(0, effect.pull - .36 + i / 11 * .36)))
    : trail;
  const rayPath = ray.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  return <div className={'path-infusion-view' + (dragging ? ' is-carrying' : '') + (source ? ' is-infusing' : '')}
    aria-busy={!!source}>
    <p className="path-place-whisper">{source ? '你带来的光，正在找到它的形状。' : '你的日子，正等着你的颜色。'}</p>
    <div ref={area} className={'path-infusion-sky' + (near ? ' light-near' : '')}>
      <StarSapphire formation={1} release={0} angle={.32} paused={paused} demonstrate={false}
        tint={source ? effect.trace : near ? .15 : 0} infusion={source ? effect.trace : 0}
        radiance={source ? effect.glow : 0} libra />
      <svg className="path-light-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {!reduced && ray.length > 1 && <path d={rayPath} style={{ opacity: source ? (1-effect.pull)*.75 : .35 }} />}
        {source && !reduced && effect.pull < 1 && ray.filter((_, i) => i % 3 === 0).map((p, i) =>
          <circle key={i} cx={p.x} cy={p.y} r={.16 + i*.05} style={{ opacity: .12+i*.16 }} />)}
      </svg>
      <button className="path-stone-target" disabled={paused || !!source} onClick={() => deliver()} aria-label="把找到的粉光送入宝石">
        <span aria-hidden="true">{source ? '' : near ? '松开，让光留下来' : '让它们相遇'}</span>
      </button>
      <button className="path-carried-light" disabled={paused || !!source} aria-label="拖动粉光到宝石，也可轻触宝石送入"
        style={{ '--light-x': `${carried.x}%`, '--light-y': `${carried.y}%`,
          '--light-opacity': source ? 1-effect.pull : 1,
          '--light-scale': source ? 1-effect.pull*.78 : 1 } as CSSProperties}
        onPointerDown={(e) => {
          if (paused || begun.current || document.hidden || pointer.current !== null || e.button > 0) return;
          e.preventDefault(); pointer.current = e.pointerId; setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pointer.current !== e.pointerId || paused || begun.current) return;
          const p = position(e.clientX, e.clientY);
          const previous = lastPoint.current;
          setTrail((old) => [...old.slice(-9), previous]); lastPoint.current = { x: p.x, y: p.y };
          setPoint(lastPoint.current); setNear(p.near);
        }}
        onPointerUp={(e) => {
          if (pointer.current !== e.pointerId) return;
          const p = position(e.clientX, e.clientY);
          if (p.near) deliver(p); else cancel();
        }}
        onPointerCancel={cancel} onLostPointerCapture={cancel}
        onClick={(e) => { if (e.detail === 0) deliver(); }}>
        <CompanionLight choices={choices} pink />
      </button>
    </div>
    <output className="path-gesture-whisper">{source
      ? effect.trace < .55 ? '粉光沿着切面，慢慢流过。' : '你的颜色，留在了星光里。'
      : '把同行的粉光，轻轻带到星点之间。'}</output>
    <p className="path-wish-verse">{NOUNS[choices[2]]?.[2]}</p>
  </div>;
}
