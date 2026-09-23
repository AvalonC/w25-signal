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
import { MOTION, softStep } from '@/lib/motion';
import { NOUNS } from '@/lib/journey';
import { SAPPHIRE_INTRO } from '@/lib/sapphire-discovery';
import { visitPath, completePrismPath, completeDatePath, infusePath, type StarPathState } from '@/lib/star-path';
import { infusionFrame, prismEntranceFrame, prismReturnFrame, PRISM_RETURN_MS } from '@/lib/light-infusion';
import { inViewport, wishOrbit, type SkyHandoff, type SkyPoint } from '@/lib/path-arrival';
import type { WishField } from './particles';

type Props = {
  path: StarPathState; choices: number[]; month: number; day: number; rotation: number; paused: boolean;
  onPath: (path: StarPathState) => void; onDate: (month: number, day: number) => void;
  onRotation: (rotation: number) => void; onComplete: () => void; onTap: () => void;
  handoff?: SkyHandoff | null; onField?: (field: WishField | null) => void;
};

/** All three places share one saved journey. Discoveries change the sky itself. */
export function StarPathJourney(props: Props) {
  const { path, choices, paused, onPath, onTap } = props;
  const [hidden, setHidden] = useState(false);
  const root=useRef<HTMLElement>(null),returned=useRef(false);
  const [skyEntry,setSkyEntry]=useState(props.handoff??null),[placeEntry,setPlaceEntry]=useState<SkyHandoff|null>(null);
  const [returning,setReturning]=useState<{from:SkyPoint;to:SkyPoint;place:StarPathState['place']}|null>(null);
  const reduced=useReducedMotion(),returnTime=useVisibleClock(!!returning&&!paused&&!hidden);
  const returnQ=softStep(returnTime/(reduced?300:1300));
  const returnPoint=returning?{x:returning.from.x+(returning.to.x-returning.from.x)*returnQ,y:returning.from.y+(returning.to.y-returning.from.y)*returnQ}:null;
  const beginReturn=()=>{
    if(paused||document.hidden||returning||path.place==='sky')return;
    const section=root.current,rect=section?.getBoundingClientRect();if(!rect)return;
    const width=window.innerWidth||rect.width,height=window.innerHeight||rect.height;
    const star=(section?.querySelector?.<HTMLElement>('.prism-return-light .path-company')??section?.querySelector?.<HTMLElement>('.path-discovery-return .path-company')??section?.querySelector?.<HTMLElement>('.path-home .path-company'))?.getBoundingClientRect();
    const from=star?{x:(star.left+star.width/2)/width,y:(star.top+star.height/2)/height}:inViewport({x:23,y:72},rect,width,height);
    const to=inViewport(path.place==='date'?{x:76,y:46}:path.place==='sapphire'?{x:62,y:76}:{x:23,y:59},rect,width,height);
    returned.current=false;onTap();props.onField?.(null);setReturning({from,to,place:path.place});
  };
  useEffect(()=>{
    if(!returning||paused||document.hidden||returnQ<1||returned.current)return;
    returned.current=true;
    const box=root.current?.getBoundingClientRect(),width=window.innerWidth||box?.width||1,height=window.innerHeight||box?.height||1;
    const main=returning.to,orbit=0,companions=[0,1,2].map(i=>{const p=wishOrbit(orbit,i,15);return{x:main.x+p.x/width,y:main.y+p.y/height};});
    setSkyEntry({main,companions,orbit,kind:'return'});setReturning(null);onPath(visitPath(path,'sky'));
  },[returnQ,returning,paused,path,onPath]);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const visit = (place: StarPathState['place'],entry?:SkyHandoff) => {
    if (paused || document.hidden || returning) return;
    if(place==='sky'){beginReturn();return;}
    const next = visitPath(path, place);
    if (next.place === path.place) return;
    setPlaceEntry(entry??null);setSkyEntry(null);onTap(); onPath(next);
  };
  return <section ref={root} className={'star-path-journey' + (paused ? ' path-paused' : '') + (hidden ? ' path-motion-paused' : '')+(returning?' journey-returning':'')}
    style={{'--path-return':returnQ} as CSSProperties} aria-label="陪星光接通归路">
    {path.place !== 'sky' && <nav className="path-home" aria-label="同行的光">
      <CompanionLight choices={choices} pink={path.color} compact
        onClick={() => visit('sky')} label="带着光回到星路" />
    </nav>}
    <div key={path.place} className={'path-view path-view-' + path.place} inert={paused||!!returning}>
      {path.place === 'sky' && <PathSky choices={choices} color={path.color} dateFound={path.dateFound} anchor={path.anchor}
        paused={paused} onVisit={visit} handoff={skyEntry} onField={props.onField} />}
      {path.place === 'prism' && <PrismPlace found={path.color} paused={paused||!!returning} onTap={onTap} choices={choices}
        entryOrigin={placeEntry?.main} next={path.dateFound?'sapphire':'date'}
        onFound={() => onPath(completePrismPath(path))} onReturn={() => visit('sky')} />}
      {path.place === 'date' && <DatePlace month={props.month} day={props.day} found={path.dateFound}
        pink={path.color} paused={paused||!!returning} onDate={props.onDate} onTap={onTap} onFound={() => onPath(completeDatePath(path))}>
        {path.dateFound && <div className="path-discovery-return">
          <CompanionLight choices={choices} pink={path.color} onClick={() => visit('sky')} label="带着这一天的星光回到星路" />
          {NOUNS[choices[1]]?.[2]&&<p className="path-wish-verse">{NOUNS[choices[1]][2]}</p>}
        </div>}
      </DatePlace>}
      {path.place === 'sapphire' && (path.infused
        ? <SapphireScene fromPath rotation={props.rotation} paused={paused||!!returning} onProgress={props.onRotation}
            onTap={onTap} onDone={props.onComplete} />
        : <LightIntoStone choices={choices} paused={paused||!!returning} onInfuse={() => {
            onTap(); onPath(infusePath(path));
          }} />)}
    </div>
    {returnPoint&&<span className="path-returning-carrier" aria-hidden="true" style={{left:`${returnPoint.x*100}vw`,top:`${returnPoint.y*100}dvh`}}><CompanionLight choices={choices} pink={path.color}/></span>}
  </section>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches); update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function PrismPlace({ found, paused, onFound, onTap, choices, onReturn,entryOrigin,next }: {
  found: boolean; paused: boolean; onFound: () => void; onTap: () => void; choices: number[]; onReturn: () => void;
  entryOrigin?:SkyPoint;next:'date'|'sapphire';
}) {
  const [value, setValue] = useState(found ? 68 : 16);
  const [bloom, setBloom] = useState(false);
  const reduced = useReducedMotion();
  const [entered,setEntered] = useState(found);
  const entryTime = useVisibleClock(!paused && !entered);
  const entry = prismEntranceFrame(entryTime, reduced);
  const arriving = !entered;
  useEffect(() => { if (entry.done) setEntered(true); }, [entry.done]);
  const aligned = Math.abs(value - 68) <= 3;
  const dwell = useVisibleClock(aligned && !paused && !found && !bloom && !arriving, aligned ? 'aligned' : 'search');
  const elapsed = useVisibleClock(bloom && !paused && !found);
  const release = prismReturnFrame(Math.max(0, elapsed - MOTION.prismBloom), reduced);
  const emerging = bloom && elapsed >= MOTION.prismBloom;
  const sent = useRef(false);
  const callbacks = useRef({ onFound, onTap }); callbacks.current = { onFound, onTap };
  useEffect(() => {
    if (paused || found || document.hidden) return;
    if (!bloom && dwell >= 600) { setValue(68); setBloom(true); callbacks.current.onTap(); }
    if (bloom && elapsed >= MOTION.prismBloom + (reduced ? 240 : PRISM_RETURN_MS) && !sent.current) {
      sent.current = true; callbacks.current.onFound();
    }
  }, [dwell, elapsed, bloom, found, paused, reduced]);
  return <div className={'path-prism-view' + (found ? ' path-found' : '') + (arriving ? ' prism-arriving' : '')}>
    <div className="path-prism-stage" data-shot={arriving?(entry.turn<=0?'approach':entry.beam<=0?'orbit':entry.spectrum<=0?'enter':'disperse'):'interactive'}>
    <PrismLight value={value} bloom={found ? MOTION.prismBloom : Math.min(MOTION.prismBloom, elapsed)}
      entryTime={entered?(reduced?650:4400):entryTime} entryOrigin={entryOrigin} paused={paused} locked={bloom || found || arriving}
      onChange={(n) => {
        // A quick sweep must not jump over the small colour window completely.
        setValue((previous) => previous < 65 && n > 71 || previous > 71 && n < 65
          ? 68 : Math.min(100, Math.max(0, n)));
      }} />
    {found&&<svg className="prism-next-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={next==='date'?'M23 72C36 63 47 48 76 26':'M23 72C38 73 50 67 68 49'}/>
      <circle cx={next==='date'?76:68} cy={next==='date'?26:49} r=".7"/>
    </svg>}
    {(emerging || found) && <div className="prism-return-light" style={{left:`${found ? 23 : release.x}%`,top:`${found ? 72 : release.y}%`,opacity:found ? 1 : release.opacity}}>
      <CompanionLight choices={choices} pink onClick={found ? () => { if (!paused) onReturn(); } : undefined}
        label="带着粉光回到星路" />
    </div>}
    </div>
    <div className="path-prism-message" aria-live="polite">
      {found ? <><p>看不见的路，被你喜欢的颜色照亮了。</p>{NOUNS[choices[0]]?.[2]&&<p className="path-wish-verse">{NOUNS[choices[0]][2]}</p>}</>
        : <p className="sr-only">{arriving?'主星正靠近镜面，视角转向三棱镜。':'左右转动棱镜，让粉色的光停留。'}</p>}
    </div>
  </div>;
}

function DatePlace({ month, day, found, paused, pink, onDate, onFound, onTap, children }: {
  month: number; day: number; found: boolean; paused: boolean; pink: boolean;
  onDate: (month: number, day: number) => void; onFound: () => void; onTap: () => void; children: React.ReactNode;
}) {
  const [gathering, setGathering] = useState(false);
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(found);
  const entryTime = useVisibleClock(!entered && !paused);
  const approach = found ? 1 : softStep(entryTime/(reduced ? 280 : 1100));
  useEffect(() => { if (approach >= 1) setEntered(true); }, [approach]);
  const aligned = month === 10 && day === 8;
  const dwell = useVisibleClock(aligned && !paused && !found && !gathering && entered, aligned ? 'aligned' : 'search');
  const elapsed = useVisibleClock(gathering && !paused && !found);
  const sky = useRef<HTMLDivElement>(null), done = useRef(false);
  const callbacks = useRef({ onFound, onTap }); callbacks.current = { onFound, onTap };
  const { orbits, light, weave } = reduced ? { orbits: 500, light: 400, weave: 800 } : SAPPHIRE_INTRO;
  useEffect(() => {
    if (paused || found || document.hidden) return;
    if (!gathering && dwell >= 650) { setGathering(true); callbacks.current.onTap(); }
    if (gathering && elapsed >= orbits + light + weave && !done.current) {
      done.current = true; callbacks.current.onFound();
    }
  }, [dwell, elapsed, gathering, found, paused, orbits, light, weave]);
  useLayoutEffect(() => {
    if (!gathering || !sky.current) return;
    const rect = sky.current.getBoundingClientRect();
    sky.current.closest('.birth-chapter')?.querySelectorAll<HTMLElement>('.dial-block').forEach((dial) => {
      const start = (dial.querySelector<HTMLElement>('.date-dial') ?? dial).getBoundingClientRect();
      dial.style.setProperty('--orbit-to-x', `${rect.left + rect.width * .5 - (start.left + start.width / 2)}px`);
      dial.style.setProperty('--orbit-to-y', `${rect.top + rect.height * .47 - (start.top + start.height / 2)}px`);
    });
  }, [gathering]);
  const forming = found || elapsed >= orbits + light;
  const gather = softStep(elapsed / orbits);
  const energy = Math.max(0, Math.sin(Math.PI * Math.min(1, elapsed / (orbits + light))));
  return <div className={'path-date-view birth-chapter' + (gathering || found ? ' is-unveiling' : '') + (pink ? ' date-pink' : '')}
    style={{ '--date-rgb': pink ? '255,179,222' : '229,237,255', '--date-enter':approach,
      '--gather-clock': `${-elapsed}ms`, '--gather-duration': `${orbits}ms` } as CSSProperties}>
    <p className="path-place-whisper">{found ? '这一天的光，还在。' : gathering ? '两段时光，正在相遇。' : '让时光，停在你来到世上的那天。'}</p>
    <div className="path-date-stage">
    {!found && <div className="date-wheels" inert={gathering || paused || !entered} aria-hidden={gathering}>
      <DateDial label="月" value={month} max={12} kind="month" paused={paused || gathering || !entered} aligned={month === 10} onChange={(n) => { if (!paused && entered) { onDate(n, day); onTap(); } }} />
      <DateDial label="日" value={day} max={31} kind="day" paused={paused || gathering || !entered} aligned={day === 8} onChange={(n) => { if (!paused && entered) { onDate(month, n); onTap(); } }} />
    </div>}
    <div ref={sky} className={'path-date-light' + (gathering || found ? ' is-visible' : '')} aria-hidden="true">
      <StarSapphire formation={found ? 1 : forming ? Math.min(1, (elapsed - orbits - light) / weave) : 0}
        release={0} angle={.32} paused={paused || (!gathering && !found)} demonstrate={false}
        origin="light" light={Math.min(1, elapsed / orbits)}
        dust={found ? 1 : Math.max(0, Math.min(1, (elapsed - orbits) / light))} tint={pink ? 1 : 0} libra={found} />
    </div>
    {gathering && !found && <svg className="date-confluence" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
      style={{ opacity: energy, '--gather-glow': reduced ? .3 : energy } as CSSProperties}>
      {[-1,1].map((side) => <g key={side}>
        <path d={`M${50+side*24} ${47+side*10}C${50+side*38*(1-gather)} ${47-side*28} ${50-side*22} ${47+side*24} 50 47`} />
        {!reduced && Array.from({length:7},(_,i) => {
          const t=((elapsed*.00038+i/7)%1), bend=Math.sin(t*Math.PI)*(1-gather)*side*18;
          return <circle key={i} cx={50+side*24*(1-t)+bend} cy={47+side*10*(1-t)-Math.sin(t*Math.PI)*side*20}
            r={.15+(i%3)*.07} opacity={Math.sin(t*Math.PI)*.85} />;
        })}
      </g>)}
      <circle className="date-confluence-heart" cx="50" cy="47" r={1+gather*2.8} />
      <circle className="date-confluence-ring" cx="50" cy="47" r={4+gather*16} />
    </svg>}
    </div>
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
        <span className="sr-only">{source ? '' : near ? '松开，让光留下来' : '让它们相遇'}</span>
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
    <output className="path-gesture-whisper sr-only">{source
      ? effect.trace < .55 ? '粉光沿着切面，慢慢流过。' : '你的颜色，留在了星光里。'
      : '把同行的粉光，轻轻带到星点之间。'}</output>
    {NOUNS[choices[2]]?.[2]&&<p className="path-wish-verse">{NOUNS[choices[2]][2]}</p>}
  </div>;
}
