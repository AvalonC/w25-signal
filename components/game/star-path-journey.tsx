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
import { DateNebula } from './date-nebula';
import { DATE_NEBULA_TIMING, nebulaFrame, type NebulaPoint } from '@/lib/date-nebula';
import { visitPath, completePrismPath, completeDatePath, infusePath, type StarPathState } from '@/lib/star-path';
import { infusionFrame, prismEntranceFrame, prismReturnFrame, PRISM_RETURN_MS } from '@/lib/light-infusion';
import { inViewport, wishOrbit, type SkyHandoff, type SkyPoint } from '@/lib/path-arrival';
import type { WishField } from './particles';
import { DestinationDrawing } from './path-destinations';
import { lightRoad, onwardPoint, returnFlight, tracePoint } from '@/lib/return-flight';
import { isStoneEntry, STONE_LIGHT_ORIGIN, stoneEntry } from '@/lib/stone-entry';

type Props = {
  path: StarPathState; choices: number[]; month: number; day: number; rotation: number; paused: boolean;
  onPath: (path: StarPathState) => void; onDate: (month: number, day: number) => void;
  onRotation: (rotation: number) => void; onComplete: () => void; onTap: () => void;
  handoff?: SkyHandoff | null; onField?: (field: WishField | null) => void;
};

/** All three places share one saved journey. Discoveries change the sky itself. */
export function StarPathJourney(props: Props) {
  const { path, choices, paused, onPath, onTap, onField } = props;
  const [hidden, setHidden] = useState(false);
  const root=useRef<HTMLElement>(null),mapLayer=useRef<HTMLDivElement>(null),closeView=useRef<HTMLDivElement>(null),returned=useRef(false);
  const [skyEntry,setSkyEntry]=useState(props.handoff??null),[placeEntry,setPlaceEntry]=useState<SkyHandoff|null>(null);
  const [returning,setReturning]=useState<{from:SkyPoint;to:SkyPoint;place:Exclude<StarPathState['place'],'sky'>;geometry?:{x:number;y:number;scale:number;originX:number;originY:number}}|null>(null);
  const returnStarted=useRef(false);
  const meetingLayer=useRef<HTMLDivElement>(null),met=useRef(path.place==='sapphire'||path.infused),meetingDone=useRef(false);
  const [meeting,setMeeting]=useState<{from:SkyPoint;to:SkyPoint;measured:boolean;gem?:{x:number;y:number;scale:number;cx:number;cy:number}}|null>(null);
  const readyToMeet=path.color&&path.dateFound&&!path.infused&&!met.current&&path.place!=='sapphire'&&!returning;
  const autoClock=useVisibleClock(readyToMeet&&!paused&&!hidden,path.place);
  const meetClock=useVisibleClock(!!meeting&&!paused&&!hidden);
  const [returnId,setReturnId]=useState(0);
  const reduced=useReducedMotion(),returnTime=useVisibleClock(!!returning&&!paused&&!hidden,returnId);
  const meetQ=softStep(meetClock/(reduced?350:1500));
  const meetingPoint=meeting?tracePoint(meeting.from,meeting.to,meetQ):null;
  const locked=paused||!!returning||!!meeting;
  const back=returnFlight(returnTime,reduced);
  const returnPoint=returning?tracePoint(returning.from,returning.to,back.star):null;
  const beginReturn=(source?:HTMLElement)=>{
    if(paused||document.hidden||returning||meeting||readyToMeet||path.place==='sky')return;
    if(returnStarted.current)return;
    const section=root.current,rect=section?.getBoundingClientRect();if(!rect)return;
    const width=window.innerWidth||rect.width,height=window.innerHeight||rect.height;
    const star=(source??section?.querySelector?.<HTMLElement>('.prism-return-light .path-company')??section?.querySelector?.<HTMLElement>('.date-return-star')??section?.querySelector?.<HTMLElement>('.path-discovery-return .path-company')??section?.querySelector?.<HTMLElement>('.path-home .path-company'))?.getBoundingClientRect();
    const from=star?{x:(star.left+star.width/2)/width,y:(star.top+star.height/2)/height}:inViewport({x:23,y:72},rect,width,height);
    const to=inViewport(path.place==='date'?{x:76,y:46}:path.place==='sapphire'?{x:62,y:76}:{x:23,y:59},rect,width,height);
    returnStarted.current=true;returned.current=false;setReturnId(i=>i+1);onTap();props.onField?.(null);setSkyEntry(null);setReturning({from,to,place:path.place});
  };
  useLayoutEffect(()=>{
    if(!returning||returning.geometry)return;
    const sky=mapLayer.current,close=closeView.current,container=root.current?.getBoundingClientRect();if(!container)return;
    const carrier=sky?.querySelector?.<HTMLElement>('.path-carrier')?.getBoundingClientRect();
    const target=sky?.querySelector?.<HTMLElement>('.path-place-'+returning.place+' svg')?.getBoundingClientRect();
    const canvas=close?.querySelector?.<HTMLElement>('.prism-light canvas, .star-sapphire-canvas, .date-dial')?.getBoundingClientRect();
    const closeRect=close?.getBoundingClientRect()??container,width=window.innerWidth||container.width,height=window.innerHeight||container.height;
    const to=carrier?{x:(carrier.left+carrier.width/2)/width,y:(carrier.top+carrier.height/2)/height}:returning.to;
    const from=canvas?{x:canvas.left+canvas.width*(returning.place==='prism'?.44:.5),y:canvas.top+canvas.height*(returning.place==='prism'?.49:.47)}:{x:closeRect.left+closeRect.width*.5,y:closeRect.top+closeRect.height*.49};
    const icon=target?{x:target.left+target.width/2,y:target.top+target.height/2}:{x:from.x,y:from.y};
    const extent=canvas?Math.min(canvas.width*.46,canvas.height*.46):closeRect.width*.46;
    setReturning(previous=>previous?{...previous,to,geometry:{x:icon.x-from.x,y:icon.y-from.y,scale:target?Math.min(.8,target.width/extent):.3,originX:from.x-closeRect.left,originY:from.y-closeRect.top}}:null);
  },[returning]);
  useEffect(()=>{
    if(!returning||paused||document.hidden||!back.done||returned.current)return;
    returned.current=true;
    setSkyEntry(null);setReturning(null);returnStarted.current=false;onPath(visitPath(path,'sky'));
  },[back.done,returning,paused,path,onPath]);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed(); document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(()=>{
    if(!readyToMeet||paused||document.hidden||meeting)return;
    const delay=reduced?350:path.place==='date'?1600:path.place==='prism'?900:450;
    if(autoClock<delay)return;
    const rect=root.current?.getBoundingClientRect();if(!rect)return;
    const width=window.innerWidth||rect.width,height=window.innerHeight||rect.height;
    const current=(root.current?.querySelector?.<HTMLElement>('.date-return-star')??root.current?.querySelector?.<HTMLElement>('.prism-return-light .path-company')??root.current?.querySelector?.<HTMLElement>('.path-carrier'))?.getBoundingClientRect();
    const from=current?{x:(current.left+current.width/2)/width,y:(current.top+current.height/2)/height}:inViewport({x:50,y:70},rect,width,height);
    onField?.(null);setSkyEntry(null);setMeeting({from,to:inViewport(STONE_LIGHT_ORIGIN,rect,width,height),measured:false});
  },[readyToMeet,autoClock,paused,meeting,path.place,reduced,onField]);
  useLayoutEffect(()=>{
    if(!meeting||meeting.measured)return;
    const area=root.current?.getBoundingClientRect(),star=meetingLayer.current?.querySelector?.<HTMLElement>('.path-carried-light')?.getBoundingClientRect();
    const width=window.innerWidth||area?.width||1,height=window.innerHeight||area?.height||1;
    const from=closeView.current?.querySelector?.<HTMLElement>('.path-date-light .star-sapphire-canvas')?.getBoundingClientRect();
    const to=meetingLayer.current?.querySelector?.<HTMLElement>('.path-infusion-sky')?.getBoundingClientRect();
    const gem=from&&to?{x:to.left+to.width*.5-from.left-from.width*.5,y:to.top+to.height*.47-from.top-from.height*.47,
      scale:Math.min(to.width*.3,to.height*.29)/Math.max(1,Math.min(from.width*.3,from.height*.29)),cx:from.width*.5,cy:from.height*.47}:undefined;
    setMeeting(p=>p?{...p,to:star?{x:(star.left+star.width/2)/width,y:(star.top+star.height/2)/height}:p.to,measured:true,gem}:null);
  },[meeting]);
  useEffect(()=>{
    if(!meeting||!meeting.measured||paused||document.hidden||meetQ<1||meetingDone.current)return;
    meetingDone.current=true;met.current=true;setMeeting(null);setPlaceEntry(null);onPath(visitPath(path,'sapphire'));
  },[meeting,meetQ,paused,path,onPath]);
  const visit = (place: StarPathState['place'],entry?:SkyHandoff) => {
    if (paused || document.hidden || returning || meeting || readyToMeet) return;
    if(place==='sky'){beginReturn();return;}
    const next = visitPath(path, place);
    if (next.place === path.place) return;
    setPlaceEntry(entry??null);setSkyEntry(null);onTap(); onPath(next);
  };
  const geometry=returning?.geometry;
  return <section ref={root} className={'star-path-journey' + (paused ? ' path-paused' : '') + (hidden ? ' path-motion-paused' : '')+(returning?' journey-returning':'')+(meeting?' journey-meeting':'')+(meeting?.gem?' meeting-from-date':'')}
    style={{'--path-return':back.camera,'--return-copy':back.copyOpacity,'--return-opacity':back.closeOpacity,
      '--return-x':`${(geometry?.x??0)*back.camera}px`,'--return-y':`${(geometry?.y??0)*back.camera}px`,
      '--return-scale':1+((geometry?.scale??1)-1)*back.camera,'--return-origin-x':`${geometry?.originX??0}px`,'--return-origin-y':`${geometry?.originY??0}px`,'--meet':meetQ,
      '--meet-blend':softStep((meetQ-.62)/.38),'--meet-gem-x':`${(meeting?.gem?.x??0)*meetQ}px`,'--meet-gem-y':`${(meeting?.gem?.y??0)*meetQ}px`,
      '--meet-gem-scale':1+((meeting?.gem?.scale??1)-1)*meetQ,'--meet-gem-cx':`${meeting?.gem?.cx??0}px`,'--meet-gem-cy':`${meeting?.gem?.cy??0}px`} as CSSProperties} aria-label="陪星光接通归路">
    <div ref={mapLayer} className="path-map-layer" inert={locked||readyToMeet} aria-hidden={returning?true:undefined}>
      {(path.place==='sky'||returning)&&<PathSky choices={choices} color={path.color} dateFound={path.dateFound} anchor={returning?.place??path.anchor}
        paused={paused||readyToMeet||!!meeting} onVisit={visit} handoff={returning?null:skyEntry} onField={props.onField}
        presentation={returning?{progress:back.map,labels:back.labels,carrierHidden:true}:undefined}/>}
    </div>
    {(path.place !== 'sky'||meeting) && <nav className="path-home" aria-label="同行的光" inert={locked||readyToMeet}>
      <CompanionLight choices={choices} pink={path.color} compact
        onClick={() => beginReturn(root.current?.querySelector?.<HTMLElement>('.path-home .path-company')??undefined)} label="带着光回到星路" />
    </nav>}
    {path.place!=='sky'&&path.place!=='sapphire'&&<div ref={closeView} key={path.place} className={'path-view path-view-' + path.place} inert={locked||readyToMeet}>
      {path.place === 'prism' && <PrismPlace found={path.color} paused={locked} onTap={onTap} choices={choices}
        entryOrigin={placeEntry?.main} next={path.dateFound?'sapphire':'date'}
        onFound={() => onPath(completePrismPath(path))} onReturn={() => visit('sky')} />}
      {path.place === 'date' && <DatePlace month={props.month} day={props.day} found={path.dateFound}
        pink={path.color} paused={locked} choices={choices} onDate={props.onDate} onTap={onTap}
        onFound={() => onPath(completeDatePath(path))} onReturn={()=>visit('sky')}/>}
    </div>}
    {(meeting||path.place==='sapphire')&&<div ref={meetingLayer} className="path-meeting-layer" inert={locked} style={{opacity:meeting?(meeting.gem?1:softStep(meetQ/.8)):1}}>
      {path.infused?<SapphireScene fromPath rotation={props.rotation} paused={locked} onProgress={props.onRotation} onTap={onTap} onDone={props.onComplete}/>:
        <LightIntoStone choices={choices} paused={paused||!!returning} presentation={!!meeting} onInfuse={()=>{onTap();onPath(infusePath(path));}}/>}
    </div>}
    {returnPoint&&<span className="path-returning-carrier" aria-hidden="true" style={{left:`${returnPoint.x*100}vw`,top:`${returnPoint.y*100}dvh`}}>
      <CompanionLight choices={[]} pink={path.color}/>
      {choices.map((choice,i)=>{const offset=wishOrbit(reduced?0:returnTime*.0008,i,15);return <i className="return-companion" key={choice} style={{transform:`translate(${offset.x}px,${offset.y}px)`}}/>;})}
    </span>}
    {meetingPoint&&<span className="path-meeting-carrier" aria-hidden="true" style={{left:`${meetingPoint.x*100}vw`,top:`${meetingPoint.y*100}dvh`}}><CompanionLight choices={choices} pink/></span>}
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
  const roadTime=useVisibleClock(found&&!paused,'road');
  const road=lightRoad(roadTime,reduced);
  const nextPoint=next==='date'?{x:76,y:26}:{x:68,y:49};
  const roadTip=onwardPoint({x:.23,y:.72},{x:nextPoint.x/100,y:nextPoint.y/100},road.trace);
  const roadPath=Array.from({length:41},(_,i)=>{const p=onwardPoint({x:.23,y:.72},{x:nextPoint.x/100,y:nextPoint.y/100},road.trace*i/40);return`${i?'L':'M'}${p.x*100} ${p.y*100}`;}).join(' ');
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
    {found&&<>
      <svg className="prism-next-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="prism-road-aura" d={roadPath} data-progress={road.trace}/>
        <path className="prism-road-core" d={roadPath} data-progress={road.trace}/>
        <circle className="prism-road-front" cx={roadTip.x*100} cy={roadTip.y*100} r=".55" opacity={road.trace<1?1:.3}/>
      </svg>
      <button className="prism-next-place" style={{left:`${nextPoint.x}%`,top:`${nextPoint.y}%`}} disabled={paused||road.destination<1} aria-label={next==='date'?'循着粉光回到通往星盘的路':'循着粉光回到通往宝石的路'} onClick={()=>{if(!paused&&road.destination===1)onReturn();}}>
        <DestinationDrawing place={next} progress={road.destination}/>
      </button>
      <p className="prism-road-copy" style={{opacity:road.verse,transform:`translateY(${(1-road.verse)*4}px)`}}>
        {next==='date'?'你的颜色，照亮了通往那一天的路。':'你的颜色，照亮了那一天留下的星光。'}
      </p>
    </>}
    {(emerging || found) && <div className="prism-return-light" style={{left:`${found ? 23 : release.x}%`,top:`${found ? 72 : release.y}%`,opacity:found ? 1 : release.opacity}}>
      <CompanionLight choices={choices} pink onClick={found ? () => { if (!paused) onReturn(); } : undefined}
        label="带着粉光回到星路" />
    </div>}
    </div>
    <output className="sr-only">{found?'下一处的光路已经亮起。':arriving?'主星正靠近镜面，视角转向三棱镜。':'左右转动棱镜，让粉色的光停留。'}</output>
  </div>;
}

function DatePlace({ month, day, found, paused, pink, choices, onDate, onFound, onTap, onReturn }: {
  month: number; day: number; found: boolean; paused: boolean; pink: boolean;
  choices:number[];onDate: (month: number, day: number) => void; onFound: () => void; onTap: () => void; onReturn:()=>void;
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
  const sky = useRef<HTMLDivElement>(null), stage=useRef<HTMLDivElement>(null), done = useRef(false);
  const [sources,setSources]=useState<[NebulaPoint,NebulaPoint]>([{x:.28,y:.29},{x:.72,y:.74}]);
  const callbacks = useRef({ onFound, onTap }); callbacks.current = { onFound, onTap };
  const duration=reduced?DATE_NEBULA_TIMING.reduced:DATE_NEBULA_TIMING.total;
  const scene=nebulaFrame(found?duration:elapsed,reduced);
  const returnBirth=useVisibleClock(found&&!paused,'return-star');
  const returnLight=softStep(returnBirth/(reduced?300:1400));
  useEffect(() => {
    if (paused || found || document.hidden) return;
    if (!gathering && dwell >= 650) { setGathering(true); callbacks.current.onTap(); }
    if (gathering && scene.done && !done.current) {
      done.current = true; callbacks.current.onFound();
    }
  }, [dwell, gathering, found, paused, scene.done]);
  useLayoutEffect(() => {
    if(!gathering||!stage.current)return;
    const area=stage.current,rect=area.getBoundingClientRect();
    const dials=area.querySelectorAll?.<HTMLElement>('.date-dial');
    if(dials?.length===2&&rect.width&&rect.height){
      setSources(Array.from(dials).map(dial=>{const r=dial.getBoundingClientRect();return{x:(r.left+r.width/2-rect.left)/rect.width,y:(r.top+r.height/2-rect.top)/rect.height};}) as [NebulaPoint,NebulaPoint]);
    }
  }, [gathering]);
  return <div className={'path-date-view birth-chapter date-nebula-player' + (gathering || found ? ' is-unveiling' : '') + (pink ? ' date-pink' : '')}
    style={{ '--date-rgb': pink ? '255,179,222' : '229,237,255', '--date-enter':approach,
      '--dial-release-opacity':scene.dialOpacity,'--dial-release-scale':scene.dialScale,
      '--dial-release-angle':`${scene.release*16}deg` } as CSSProperties}>
    <p className="path-place-whisper">{found ? '那一天的星光，有了形状。' : gathering ? scene.formation>0?'星云里的光，慢慢有了形状。':scene.gather>=1?'两段时光，凝成一片星云。':'两段时光，正在相遇。' : '让时光，停在你来到世上的那天。'}</p>
    <div ref={stage} className="path-date-stage" data-nebula-phase={!gathering&&!found?'dial':scene.formation>0?'forming':scene.gather>=1?'nebula':'gathering'}>
    {!found && <div className="date-wheels" inert={gathering || paused || !entered} aria-hidden={gathering}>
      <DateDial label="月" value={month} max={12} kind="month" paused={paused || gathering || !entered} aligned={month === 10} onChange={(n) => { if (!paused && entered) { onDate(n, day); onTap(); } }} />
      <DateDial label="日" value={day} max={31} kind="day" paused={paused || gathering || !entered} aligned={day === 8} onChange={(n) => { if (!paused && entered) { onDate(month, n); onTap(); } }} />
    </div>}
    {(gathering||found)&&<DateNebula elapsed={found?duration:elapsed} paused={paused} pink={pink} reduced={reduced} sources={sources} settled={found}/>}
    <div ref={sky} className={'path-date-light' + (gathering || found ? ' is-visible' : '')} aria-hidden="true">
      <StarSapphire formation={scene.formation}
        release={0} angle={.32} paused={paused || (!gathering && !found)} demonstrate={false}
        origin="nebula" light={0} dust={scene.formation} tint={pink ? 1 : 0} libra={found} />
    </div>
    {found&&<div className="date-result-overlay">
      <button className="date-return-star" style={{left:`${50+Math.sin(returnLight*Math.PI)*7}%`,top:`${47+returnLight*39}%`,opacity:Math.min(1,returnLight*4+.2)}}
        disabled={paused||returnLight<1} aria-label="带着这一天的星光回到星路" onClick={()=>{if(!paused&&returnLight===1)onReturn();}}>
        <CompanionLight choices={choices} pink={pink}/>
      </button>
      {NOUNS[choices[1]]?.[2]&&<p className="date-result-verse" style={{opacity:softStep((returnLight-.6)/.4)}}>{NOUNS[choices[1]][2]}</p>}
    </div>}
    </div>
  </div>;
}

function LightIntoStone({ choices, paused, presentation = false, onInfuse }: { choices: number[]; paused: boolean; presentation?:boolean; onInfuse: () => void }) {
  const [point, setPoint] = useState<{x:number;y:number}>({...STONE_LIGHT_ORIGIN});
  const [near, setNear] = useState(false), [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [reduced, setReduced] = useState(false);
  const area = useRef<HTMLDivElement>(null), carriedRef=useRef<HTMLButtonElement>(null),pointer = useRef<number | null>(null);
  const [size,setSize]=useState({width:400,height:500});
  const entry=stoneEntry(size.width,size.height),blocked=paused||presentation;
  const begun = useRef(false), done = useRef(false);
  const lastPoint = useRef(point), callback = useRef(onInfuse); callback.current = onInfuse;
  const elapsed = useVisibleClock(!!source && !blocked);
  const guideTime=useVisibleClock(!source&&!blocked,'guide');
  const effect = infusionFrame(elapsed, reduced);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(()=>{
    const el=area.current;if(!el)return;
    const update=()=>{const rect=el.getBoundingClientRect();if(rect.width&&rect.height)setSize({width:rect.width,height:rect.height});};
    update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
  },[]);
  const releaseCapture=()=>{
    const id=pointer.current;pointer.current=null;
    if(id!==null&&carriedRef.current?.hasPointerCapture(id))carriedRef.current.releasePointerCapture(id);
  };
  const cancel = useCallback(() => {
    const id=pointer.current;pointer.current=null;
    if(id!==null&&carriedRef.current?.hasPointerCapture(id))carriedRef.current.releasePointerCapture(id);
    setDragging(false);
    if (begun.current) return;
    lastPoint.current = {...STONE_LIGHT_ORIGIN}; setPoint(lastPoint.current); setNear(false); setTrail([]);
  }, []);
  useEffect(() => { if (blocked) cancel(); }, [blocked, cancel]);
  useEffect(() => {
    const stop = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', stop); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('blur', cancel); };
  }, [cancel]);
  useEffect(() => {
    if (!source || blocked || document.hidden || !effect.done || done.current) return;
    done.current = true; callback.current();
  }, [source, blocked, effect.done]);
  const deliver = (from = lastPoint.current) => {
    if (blocked || begun.current || document.hidden) return;
    begun.current = true; releaseCapture(); setDragging(false);
    setNear(true); setSource({ x: from.x, y: from.y }); setTrail([]);
  };
  const position = (x: number, y: number) => {
    const r = area.current!.getBoundingClientRect();
    const p={x:Math.max(7,Math.min(93,(x-r.left)/r.width*100)),y:Math.max(8,Math.min(90,(y-r.top)/r.height*100))};
    return {...p,near:isStoneEntry(p,r.width,r.height)};
  };
  const attract = (t: number) => {
    const p=source??point;
    const cap=softStep(t/.7),inside=softStep((t-.7)/.3);
    return {x:p.x+(entry.x-p.x)*cap,y:p.y+(entry.y-p.y)*cap+(47-entry.y)*inside};
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
        radiance={source ? effect.glow : 0} guide={{active:!source&&!presentation,near}} libra />
      {!source&&<svg className="stone-entry-guide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{opacity:presentation?0:1}}>
        <path d={`M50 15 L50 ${entry.y}`} />
        {[0,1,2,3].map(i=>{const t=reduced?(i+.5)/4:(guideTime/2400+i/4)%1;return<circle key={i} cx="50" cy={15+t*(entry.y-15)} r=".36" opacity={reduced?.65:Math.sin(t*Math.PI)*.8}/>;})}
        <path className="stone-entry-tip" d={`M47.8 ${entry.y-3}L50 ${entry.y}L52.2 ${entry.y-3}`}/>
      </svg>}
      <svg className="path-light-thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {!reduced && ray.length > 1 && <path d={rayPath} style={{ opacity: source ? (1-effect.pull)*.75 : .35 }} />}
        {source && !reduced && effect.pull < 1 && ray.filter((_, i) => i % 3 === 0).map((p, i) =>
          <circle key={i} cx={p.x} cy={p.y} r={.16 + i*.05} style={{ opacity: .12+i*.16 }} />)}
      </svg>
      <button className="path-stone-target" style={{left:`${entry.x}%`,top:`${entry.y}%`}} disabled={blocked || !!source} onClick={() => deliver()} aria-label="把找到的粉光送入宝石">
        <span className="sr-only">{source ? '' : near ? '松开，让光留下来' : '让它们相遇'}</span>
      </button>
      <button ref={carriedRef} className="path-carried-light" disabled={blocked || !!source} aria-label="从上方向下拖动粉光进入宝石，也可轻触顶部切面送入"
        style={{ '--light-x': `${carried.x}%`, '--light-y': `${carried.y}%`,
          '--light-opacity': source ? 1-effect.pull : 1,
          '--light-scale': source ? 1-effect.pull*.78 : 1,visibility:presentation?'hidden':undefined } as CSSProperties}
        onPointerDown={(e) => {
          if (blocked || begun.current || document.hidden || pointer.current !== null || e.button > 0 || e.isPrimary===false) return;
          e.preventDefault(); pointer.current = e.pointerId; setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pointer.current !== e.pointerId || blocked || begun.current) return;
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
        onPointerCancel={e=>{if(pointer.current===e.pointerId)cancel();}} onLostPointerCapture={e=>{if(pointer.current===e.pointerId)cancel();}} onBlur={cancel}
        onContextMenu={e=>e.preventDefault()}
        onClick={(e) => { if (e.detail === 0) deliver(); }}>
        <CompanionLight choices={choices} pink />
      </button>
    </div>
    <div className="stone-infusion-footer"><output className="sr-only">{source
      ? effect.trace < .55 ? '粉光沿着切面，慢慢流过。' : '你的颜色，留在了星光里。'
      : '将上方的粉光沿星屑向下带入宝石顶部。'}</output>
    {NOUNS[choices[2]]?.[2]&&<p className="path-wish-verse">{NOUNS[choices[2]][2]}</p>}
    </div>
  </div>;
}
