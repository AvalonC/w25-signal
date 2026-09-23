'use client';
// Pointer capture keeps the carried light attached to one finger across the sky.
/* oxlint-disable react/react-compiler */
// The composed light is several live SVG stars, so it has no single img source.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { NOUNS } from '@/lib/journey';
import { PATH_ANCHORS, type StarPathState } from '@/lib/star-path';
import { softStep } from '@/lib/motion';
import { useVisibleClock } from './scene-clock';
import { DestinationDrawing } from './path-destinations';
import { inSky, pathArrival, pathReturn, wishOrbit, PATH_PLACES, type SkyBox, type SkyHandoff } from '@/lib/path-arrival';
import type { WishField } from './particles';

export type PathPlace = 'sky' | 'prism' | 'date' | 'sapphire';
type Destination = Exclude<PathPlace, 'sky'>;
type Point = { x: number; y: number };
const PLACES: Record<Destination, Point> = PATH_PLACES;
const STAR = 'M20 1 24 15 39 20 24 25 20 39 15 25 1 20 15 15Z';

export function CompanionLight({
  choices,
  pink,
  compact = false,
  onClick,
  label,
}: {
  choices: number[];
  pink: boolean;
  compact?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const names = choices.map((choice) => NOUNS[choice]?.[0]).filter(Boolean).join('、');
  const className = `path-company${pink ? ' path-company-pink' : ''}${compact ? ' path-company-compact' : ''}`;
  const content = <>
    <svg className="path-company-star" viewBox="0 0 40 40" aria-hidden="true"><path d={STAR} /></svg>
    {choices.slice(0, 3).map((choice, index) => (
      <span key={choice} className="path-companion-orbit" style={{ '--companion-angle': `${index * 120 + 16}deg`, '--companion-delay': `${index * -1.6}s` } as CSSProperties} aria-hidden="true">
        <svg className="path-companion-trail" viewBox="0 0 60 60"><path d="M30 3A27 27 0 0 0 11 11" /></svg>
        <svg className="path-companion" viewBox="0 0 40 40"><path d={STAR} /></svg>
      </span>
    ))}
  </>;
  const description = label || `同行的光${names ? `，带着${names}` : ''}`;
  return onClick ? (
    <button type="button" className={className} onClick={onClick} aria-label={description}>{content}</button>
  ) : (
    <span className={className} role="img" aria-label={description}>{content}</span>
  );
}

export function PathSky({ color, dateFound, choices, paused, onVisit, anchor = 'origin', handoff, onField }: {
  color: boolean;
  dateFound: boolean;
  choices: number[];
  paused: boolean;
  onVisit: (place: Destination, handoff?: SkyHandoff) => void;
  anchor?: StarPathState['anchor'];
  handoff?: SkyHandoff | null;
  onField?: (field: WishField | null) => void;
}) {
  const maskId=useId().replaceAll(':','');
  const skyRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const positionRef = useRef<Point>({ ...PATH_ANCHORS[anchor ?? 'origin'] });
  const [position, setPosition] = useState<Point>(positionRef.current);
  const [dragging, setDragging] = useState(false);
  const [near, setNear] = useState<Destination | null>(null);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(() => typeof window!=='undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [entryHandoff] = useState(handoff??null);
  const [layout,setLayout] = useState<{box:SkyBox;width:number;height:number}|null>(null);
  const elapsed=useVisibleClock(!paused);
  const fieldCallback=useRef(onField);fieldCallback.current=onField;
  const lastField=useRef<WishField|null>(null);
  const box=layout?.box??{left:0,top:0,width:1,height:1};
  const start=entryHandoff&&layout?inSky(entryHandoff.main,box,layout.width,layout.height):position;
  const companionStarts=entryHandoff&&layout?entryHandoff.companions.map(p=>inSky(p,box,layout.width,layout.height)):[];
  const entry=(entryHandoff?.kind==='return'?pathReturn:pathArrival)(elapsed,reduced,start,companionStarts,entryHandoff?.orbit??0,box.width,box.height,PATH_ANCHORS[anchor]);
  const entering=!!entryHandoff&&(!layout||!entry.done);
  const [flight, setFlight] = useState<{ place: Destination; from: Point } | null>(null);
  const flightTime = useVisibleClock(!!flight && !paused);
  const committed = useRef(false), visit = useRef(onVisit); visit.current = onVisit;
  const ready = color && dateFound;
  const blocked = paused || !!flight || entering;

  useLayoutEffect(()=>{
    if(!skyRef.current)return;
    const update=()=>{
      const rect=skyRef.current!.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      setLayout({box:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},width:window.innerWidth||rect.width,height:window.innerHeight||rect.height});
    };
    update();
    const observer=new ResizeObserver(update);observer.observe(skyRef.current);
    window.addEventListener('resize',update);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[]);
  useEffect(()=>()=>{if(!committed.current)fieldCallback.current?.(null);},[]);

  const clearGesture = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current && lightRef.current?.hasPointerCapture(current.id)) lightRef.current.releasePointerCapture(current.id);
    setDragging(false);
    setNear(null);
  }, []);

  useEffect(() => {
    if (paused) clearGesture();
  }, [paused, clearGesture]);

  useEffect(() => {
    const onVisibility = () => { setHidden(document.hidden); if (document.hidden) clearGesture(); };
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    motion(); media?.addEventListener('change', motion);
    onVisibility();
    window.addEventListener('blur', clearGesture);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', clearGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      media?.removeEventListener('change', motion);
      gesture.current = null;
    };
  }, [clearGesture]);
  useEffect(() => {
    if (!flight || paused || document.hidden || flightTime < (reduced ? 240 : 900) || committed.current) return;
    const rect=lightRef.current?.getBoundingClientRect();
    const width=window.innerWidth||box.width,height=window.innerHeight||box.height;
    const source=rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:lastField.current?.carrier;
    const transfer=source?{main:{x:source.x/width,y:source.y/height},companions:(lastField.current?.companions??[]).map(p=>({x:p.x/width,y:p.y/height})),orbit:lastField.current?.orbit??0}:undefined;
    committed.current = true; visit.current(flight.place,transfer);
  }, [flight, flightTime, paused, reduced, box.width, box.height]);
  const travel = (place: Destination) => {
    if (blocked || document.hidden || (place === 'sapphire' && !ready)) return;
    clearGesture(); setFlight({ place, from: { ...positionRef.current } });
  };

  function nearest(point: Point) {
    const box = skyRef.current?.getBoundingClientRect();
    if (!box) return null;
    let found: Destination | null = null;
    let distance = Math.min(70, box.width * .2);
    for (const place of Object.keys(PLACES) as Destination[]) {
      if (place === 'sapphire' && !ready) continue;
      const target = PLACES[place];
      const next = Math.hypot((target.x - point.x) * box.width / 100, (target.y - point.y) * box.height / 100);
      if (next < distance) { found = place; distance = next; }
    }
    return found;
  }
  function moveTo(point: Point) {
    const next = { x: Math.max(7, Math.min(93, point.x)), y: Math.max(10, Math.min(91, point.y)) };
    positionRef.current = next;
    setPosition(next);
    setNear(nearest(next));
  }
  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (blocked || document.hidden || gesture.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const box = skyRef.current?.getBoundingClientRect();
    if (!box) return;
    gesture.current = { id: event.pointerId, dx: (event.clientX - box.left) / box.width * 100 - positionRef.current.x, dy: (event.clientY - box.top) / box.height * 100 - positionRef.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    const box = skyRef.current?.getBoundingClientRect();
    if (blocked || !current || current.id !== event.pointerId || !box) return;
    moveTo({ x: (event.clientX - box.left) / box.width * 100 - current.dx, y: (event.clientY - box.top) / box.height * 100 - current.dy });
  }
  function cancel(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    clearGesture();
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    const destination = blocked ? null : nearest(positionRef.current);
    cancel(event);
    if (destination) travel(destination);
  }
  const fly = softStep(flightTime / (reduced ? 240 : 900));
  const destination = flight ? { ...PLACES[flight.place], y: PLACES[flight.place].y - (flight.place === 'prism' ? 16 : 0) } : position;
  const shown = flight ? { x: flight.from.x + (destination.x-flight.from.x)*fly,
    y: flight.from.y + (destination.y-flight.from.y)*fly - (reduced ? 0 : Math.sin(fly*Math.PI)*10) } : entering?entry.main:position;
  const approach = flight && !reduced ? softStep((flightTime-230)/670) : 0;
  const phase=(entryHandoff?.orbit??0)+(reduced?0:elapsed*.0008);
  const companions=entering?entry.companions:choices.slice(0,3).map((_,i)=>{
    const offset=wishOrbit(phase,i,15);return{x:shown.x+offset.x/box.width*100,y:shown.y+offset.y/box.height*100};
  });
  const companionFrame=useRef(companions);companionFrame.current=companions;
  useLayoutEffect(()=>{
    if(!layout||!fieldCallback.current)return;
    const screen=(p:Point)=>({x:box.left+box.width*(destination.x+(p.x-destination.x)*(1+approach*1.6)+(50-destination.x)*approach)/100,
      y:box.top+box.height*(destination.y+(p.y-destination.y)*(1+approach*1.6)+(47-destination.y)*approach)/100});
    const main=screen({x:shown.x,y:shown.y});
    const field:WishField={nodes:NOUNS.map(([word],i)=>({word,x:main.x,y:main.y,selected:choices.includes(i),order:choices.indexOf(i)})),
      carrier:main,departing:true,orbit:phase,companions:companionFrame.current.map(screen)};
    lastField.current=field;fieldCallback.current(field);
  },[layout,choices,shown.x,shown.y,phase,entering,entry.main.x,entry.main.y,entry.phase,approach,destination.x,destination.y,box.left,box.top,box.width,box.height]);
  const reveal=entering?entry:{prism:1,date:1,route:1,labels:1};
  const words = ready ? '光与日子都在了。让它们在那颗星里相遇。' : color ? '你喜欢的光，正等着属于你的那一天。' : dateFound ? '那一天已经醒来。还缺一束你喜欢的光。' : '路还没有连起来。两处微光，在远方等你。';
  const labels: Record<Destination, string> = {
    prism: color ? '粉光，已在同行' : '光分开的地方',
    date: dateFound ? '十月八日，已点亮' : '日子藏在星里',
    sapphire: ready ? '让两束光相遇' : '等光，也等那一天',
  };
  return <section className={`path-exploration${entering?' path-arriving':''}${paused || hidden ? ' path-paused' : ''}${color ? ' path-has-color' : ''}${dateFound ? ' path-has-date' : ''}`} aria-label="带着愿望，探索尚未连接的星路">
    <p className="sr-only" aria-live="polite">{words}</p>
    <div ref={skyRef} className={`path-sky${dragging ? ' path-dragging' : ''}${flight ? ' path-flying' : ''}`}>
      <div className="path-map-world" style={{transformOrigin:`${destination.x}% ${destination.y}%`,
        transform:`translate(${(50-destination.x)*approach}%,${(47-destination.y)*approach}%) scale(${1+approach*1.6})`,
        opacity:1-approach*.38}}>
      <svg className="path-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path className="path-entry-route-mask" d="M26 78C9 66 11 49 23 36M23 36C35 44 42 53 62 69" pathLength="1" strokeDasharray="1" strokeDashoffset={1-reveal.route}/>
          <path className="path-entry-route-mask" d="M26 78C48 82 78 78 81 61L83 51C90 42 85 32 76 24M76 24C58 36 50 48 62 69" pathLength="1" strokeDasharray="1" strokeDashoffset={1-reveal.route}/>
        </mask></defs>
        <g mask={`url(#${maskId})`}>
          <path className={`path-route${color ? ' path-route-found' : ''}`} d="M26 78C9 66 11 49 23 36M23 36C35 44 42 53 62 69" />
          <path className={`path-route${dateFound ? ' path-route-found' : ''}`} d="M26 78C48 82 78 78 81 61M83 51C90 42 85 32 76 24M76 24C58 36 50 48 62 69" />
          <path className="path-missing" d="M81 61 83 51" />
        </g>
        <circle className="path-origin" cx="26" cy="78" r=".6" />
      </svg>
      {(Object.keys(PLACES) as Destination[]).map((place) => {
        if (place === 'sapphire' && !dateFound) return null;
        const available = place !== 'sapphire' || ready;
        const found = place === 'prism' ? color : place === 'date' ? dateFound : ready;
        return <button type="button" key={place} className={`path-place path-place-${place}${found ? ' path-place-found' : ''}${near === place || flight?.place === place ? ' path-place-near' : ''}`} style={{ left: `${PLACES[place].x}%`, top: `${PLACES[place].y}%` }} disabled={blocked || !available} aria-label={`${labels[place]}${available ? '，轻触前往，也可以把同行的光拖到这里' : '，先找到颜色与日子'}`} onClick={() => { if (available) travel(place); }}>
          <DestinationDrawing place={place} progress={place==='prism'?reveal.prism:place==='date'?reveal.date:reveal.route}/><span className="path-place-label" style={{'--path-label':reveal.labels} as CSSProperties}>{labels[place]}</span>
        </button>;
      })}
      <button ref={lightRef} type="button" className={`path-carrier${near ? ' path-carrier-near' : ''}`} style={{ left: `${shown.x}%`, top: `${shown.y}%` }} disabled={blocked} aria-label="同行的光。拖到一处微光再松手；也可直接轻触目的地，键盘方向键移动，回车前往。" onPointerDown={begin} onPointerMove={move} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={clearGesture} onKeyDown={(event) => {
        if (blocked) return;
        const shifts: Record<string, Point> = { ArrowLeft: { x: -6, y: 0 }, ArrowRight: { x: 6, y: 0 }, ArrowUp: { x: 0, y: -6 }, ArrowDown: { x: 0, y: 6 } };
        const shift = shifts[event.key];
        if (shift) { event.preventDefault(); moveTo({ x: positionRef.current.x + shift.x, y: positionRef.current.y + shift.y }); }
        else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const destination = nearest(positionRef.current); if (destination) travel(destination); }
      }}>
        <CompanionLight choices={onField?[]:choices} pink={color} />
      </button>
      </div>
    </div>
    <p className="sr-only">{flight ? '带着光，慢慢靠近。' : near ? `松开，让光去往${near === 'prism' ? '棱镜' : near === 'date' ? '星盘' : '宝石'}。` : '带着光走一走。也可以轻触远方。'}</p>
  </section>;
}
