'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { CompanionLight } from './path-sky';
import { ModelSurface, type ModelSurfaceHandle } from './model-surface';
import { BraceletActions, BraceletDissolve, useBraceletDelivery } from './model';
import { handoffFrame, HANDOFF_DURATION, HANDOFF_REDUCED_DURATION } from '@/lib/bracelet-handoff';
import { useVisibleClock } from './scene-clock';
import { BRACELET_ASSETS } from '@/lib/model-assets';
import { gift } from '@/lib/gift-config';
import { smooth, clickOrigin, type CameraView, type StarArrival, type Vec3 } from '@/lib/bracelet-transition';
import { CLOSURE_CODES, CLOSURE_GEM, CLOSURE_LETTERS, CLOSURE_ORBIT, CLOSURE_PARTS,
  closureArrival, closureFrame, closureNear, closurePoint, closureRingPosition } from '@/lib/path-closure';
import { closureSweep, closureSweepPath } from '@/lib/closure-sweep';
import metadata from '../../public/models/jewelry-metadata.json';

type Point = { x: number; y: number };
const pathOf = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
const ringPositions = (from: number, to: number, count: number) => Array.from({length:count+1}, (_,i) => closureRingPosition(from+(to-from)*i/count));
const route = ringPositions(20,345,130);
const words = ['一瞬的光，和两次长长的停留。', '两点、三划，接成第二段回应。', '五点星光，接住了最后一个愿望。'];
const posterView: CameraView = { ...metadata.poster, target:metadata.poster.target as Vec3,
  orthographicSpan:metadata.poster.span, radius:.145, fov:30, left:0, top:0, width:100, height:100 };

export function PathClosure({ choices, paused = false, fromRelay = false, showcase = false, onComplete, onScatter = () => {}, onGem = () => {} }: {
  choices: number[]; paused?: boolean; fromRelay?: boolean; showcase?:boolean; onComplete: () => void;
  onScatter?:()=>void; onGem?:(arrival:StarArrival)=>void;
}) {
  const [closed, setClosed] = useState(false), [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false), [hidden, setHidden] = useState(false);
  const [point, setPoint] = useState<Point | null>(null), [near, setNear] = useState(false);
  const [dragging, setDragging] = useState(false), [selected, setSelected] = useState<number | null>(null);
  const [size,setSize] = useState(300), [view,setView] = useState<CameraView | null>(null);
  const [joinAngle,setJoinAngle] = useState(345);
  const [presenting,setPresenting]=useState(false),[arrived,setArrived]=useState(showcase);
  const [footerHeight,setFooterHeight]=useState(240);
  const reading=useRef<HTMLDivElement>(null),actions=useRef<HTMLDivElement>(null),viewer=useRef<ModelSurfaceHandle>(null);
  const presentation=presenting||arrived||showcase;
  const world = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null), light = useRef<HTMLButtonElement>(null);
  const pointer = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const begun = useRef(false), sent = useRef(false), handed=useRef(false);
  const callback = useRef(onComplete); callback.current = onComplete;
  const opening = useVisibleClock(!closed && !presentation && !paused && !hidden);
  const elapsed = useVisibleClock(closed && !presentation && !paused && !hidden);
  const handoffTime=useVisibleClock(presenting&&!arrived&&!paused&&!hidden);
  const handoff=handoffFrame(arrived||showcase?reduced?HANDOFF_REDUCED_DURATION:HANDOFF_DURATION:handoffTime,reduced);
  const delivery=useBraceletDelivery({onGem,onScatter,paused:paused||hidden,enabled:arrived||showcase,reduced,viewer,surface:area});
  useEffect(()=>{
    if(!presenting||arrived||paused||hidden||document.hidden||!handoff.ready||handed.current)return;
    handed.current=true;setArrived(true);callback.current();
  },[presenting,arrived,paused,hidden,handoff.ready]);
  const phase = closureFrame(elapsed, reduced), sweep = closureSweep(elapsed, reduced);
  const overview = reduced ? 1 : smooth(opening / 2200);
  // A single square stage and one projection serve the route, star, hit targets,
  // mapped light, and model. If the model is unavailable, blend onto its poster.
  const project = (position: Vec3): Point => {
    const routePoint=closurePoint(position,view);
    if(loaded || !closed) return routePoint;
    const posterPoint=closurePoint(position,posterView);
    return {x:routePoint.x+(posterPoint.x-routePoint.x)*phase.solid,y:routePoint.y+(posterPoint.y-routePoint.y)*phase.solid};
  };
  const anchor=project(closureRingPosition(345)), target=project(closureRingPosition(380));
  const arrival = closureArrival(opening, reduced, anchor);
  const entryReady = fromRelay ? arrival.ready : reduced || opening >= 2200;
  const group = selected ?? phase.group;
  useLayoutEffect(()=>{
    const measure=()=>{const a=reading.current?.getBoundingClientRect().height??0,b=actions.current?.getBoundingClientRect().height??0;if(a||b)setFooterHeight(Math.ceil(Math.max(a,b)));};
    measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    if(reading.current)observer?.observe(reading.current);if(actions.current)observer?.observe(actions.current);
    return()=>observer?.disconnect();
  },[]);
  const clear = useCallback(() => {
    const previous = pointer.current;
    pointer.current = null;
    if (previous && light.current?.hasPointerCapture(previous.id)) light.current.releasePointerCapture(previous.id);
    setDragging(false); setNear(false);
    if (!begun.current) setPoint(null);
  }, []);
  useLayoutEffect(()=>{
    if(!world.current)return;
    const measure=()=>{const rect=world.current!.getBoundingClientRect();if(rect.width>0&&rect.height>0)setSize(Math.min(rect.width,rect.height));};
    measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    observer?.observe(world.current);
    return()=>observer?.disconnect();
  },[]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(!!media?.matches);
    changed(); media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const changed = () => { setHidden(document.hidden); if (document.hidden) clear(); };
    changed(); document.addEventListener('visibilitychange', changed); window.addEventListener('blur', clear);
    return () => { document.removeEventListener('visibilitychange', changed); window.removeEventListener('blur', clear); };
  }, [clear]);
  useEffect(() => { if (paused) clear(); }, [paused, clear]);
  const gapNearest=(value:Point)=>{
    let best={point:anchor,angle:345,distance:Infinity};
    for(let i=0;i<=140;i++){
      const angle=345+i*.25,p=project(closureRingPosition(angle)),distance=Math.hypot(value.x-p.x,value.y-p.y);
      if(distance<best.distance)best={point:p,angle,distance};
    }
    return best;
  };
  const join = (angle = point ? gapNearest(point).angle : 345) => {
    if (paused || document.hidden || begun.current || !entryReady) return;
    setJoinAngle(angle);
    begun.current = true; clear(); setClosed(true);
  };
  const finish = () => {
    if (paused || document.hidden || !closed || !phase.ready || sent.current) return;
    sent.current = true; setPresenting(true);
  };
  const position = (event: PointerEvent<HTMLButtonElement>, offset = pointer.current) => {
    const rect = area.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 100 - (offset?.dx ?? 0),
      y: (event.clientY - rect.top) / rect.height * 100 - (offset?.dy ?? 0) };
  };
  const isNear = (value: Point) => closureNear(value,size,size,target);
  const showPart = (index: number) => closed && (selected === null ? phase.lit[index] : CLOSURE_PARTS[index].group === selected);
  const strength = (index:number,stone:number) => !closed ? 0 : selected === null ? sweep.stoneStrengths[index][stone] : CLOSURE_PARTS[index].group === selected ? .8 : 0;
  const stoneStyle=(index:number,stone:number)=>({ '--mapped-light':strength(index,stone)*(presentation?handoff.closureOpacity:1) } as CSSProperties);
  const showGem = closed && selected === null ? phase.gemstone : 0;
  const joinProgress=(joinAngle-345+(380-joinAngle)*phase.join)/35;
  const start = closed ? project(closureRingPosition(345+35*joinProgress)) : fromRelay && !entryReady ? arrival.point : point ?? anchor;
  const markClass = (index: number) => 'closure-stone' + (showPart(index) ? ' is-lit' : '') +
    (phase.active === index && !phase.ready || selected !== null && CLOSURE_PARTS[index].group === selected ? ' is-speaking' : '') +
    (CLOSURE_PARTS[index].symbol === '-' ? ' is-bar' : '');
  const sweepPoint=project(sweep.position);
  const travelled=closed ? [...ringPositions(345,380,20),...closureSweepPath(elapsed,reduced).slice(1)].map(project) : [];
  const trail=pathOf(travelled);
  const tail=pathOf(travelled.slice(-12));
  const select=(index:number)=>{if(!paused&&!document.hidden&&phase.ready)setSelected(selected===index?null:index);};
  return <section className={'path-closure bracelet-experience' + (closed ? ' is-closed' : '') + (dragging ? ' is-carrying' : '') +
    (paused || hidden ? ' is-paused' : '') + (reduced ? ' is-reduced' : '') + (fromRelay ? ' from-relay' : '') + (presentation ? ' is-presenting' : '') + (arrived||showcase ? ' is-showcase' : '') + (delivery.departing ? ' is-departing' : '')} aria-label={presentation?gift.name+' 手链':'让星路在手链上闭合'}
    data-presentation={arrived||showcase?'interactive':presenting?'moving':'closure'}
    style={{ '--closure-arrival-copy': fromRelay&&!presentation ? arrival.copy : 1, '--closure-footer-height':footerHeight+'px', '--bracelet-ar-reveal':presentation?handoff.arOpacity:0 } as CSSProperties}>
    <output className="closure-whisper" style={{opacity:presentation?handoff.closureOpacity:undefined}} aria-hidden={presentation}>{!closed ? '走过的光，原来围成了一圈。'
      : phase.settled ? '那些长短的回应，一直藏在它身上。' : group >= 0 ? words[group] : '最后一段星路，被你接通了。'}</output>
    <div className="closure-world" ref={world}>
    <div className="closure-stage" ref={area} style={{width:size,height:size,'--closure-overview':overview,
      '--closure-solid':(presentation?1:closed?phase.solid:0)*delivery.phase.solid,'--closure-trace':closed?1-phase.solid*.92:1} as CSSProperties}>
      <div className="closure-object" aria-hidden={!closed&&!presentation}>
        <ModelSurface src={BRACELET_ASSETS.model} poster={BRACELET_ASSETS.poster} orbit={presentation?handoff.orbit:CLOSURE_ORBIT}
          target={presentation?metadata.poster.target.map(value=>value*handoff.cameraProgress+'m').join(' '):'0m 0m 0m'}
          label={presentation?gift.name+'，可旋转的完整手链：四角星镶座、粉色宝石、长短银链和自然垂落的尾饰':'长短钻石链节组成 W25 的真实手链'}
          onReady={setLoaded} onViewChange={setView} viewerRef={viewer} frozen={delivery.departing}
          interactive={(arrived||showcase)&&!paused&&!hidden&&!delivery.departing} interpolationDecay={presenting&&!arrived?0:undefined}>
          {CLOSURE_PARTS.flatMap((part, index) => part.stones.map((stone, j) => <span key={part.node+'-'+j}
            slot={'hotspot-morse-'+index+'-'+j} data-position={stone.map((n) => n+'m').join(' ')}
            className={markClass(index)} style={stoneStyle(index,j)} aria-hidden="true" />))}
          <span slot="hotspot-closure-gem" data-position={CLOSURE_GEM.map((n) => n+'m').join(' ')}
            className="closure-gem" style={{ opacity: showGem*(presentation?handoff.closureOpacity:1) }} aria-hidden="true" />
          {(arrived||showcase)&&!delivery.departing&&<button slot="hotspot-gem" className="bracelet-gem-target"
            data-position={metadata.hotspot.map(value=>value+'m').join(' ')} data-normal={metadata.normal.join(' ')}
            data-visibility-attribute="visible" aria-label="触碰粉色蓝宝石，让手链化作星光"
            disabled={paused||hidden} onClick={event=>{event.stopPropagation();delivery.depart(clickOrigin(event,event.currentTarget.getBoundingClientRect(),window.innerWidth,window.innerHeight));}}><span aria-hidden="true">✧</span></button>}
        </ModelSurface>
        {!loaded&&!presentation && <svg className="closure-poster-lights" viewBox="0 0 100 100" aria-hidden="true">
          {CLOSURE_PARTS.flatMap((part,index)=>part.stones.map((stone,j)=>{
            const p=closurePoint(stone,posterView);
            return <circle key={part.node+'-'+j} cx={p.x} cy={p.y} r={.8} className={markClass(index)} style={stoneStyle(index,j)} />;
          }))}
          {(()=>{const p=closurePoint(CLOSURE_GEM,posterView);return <circle cx={p.x} cy={p.y} r={2.4} className="closure-gem" style={{opacity:showGem}} />;})()}
        </svg>}
      </div>
      <div className="closure-plane" inert={presentation} aria-hidden={presentation} style={{opacity:presentation?handoff.closureOpacity:1}}>
      <div className="closure-sky" aria-hidden="true">
        <svg className="closure-ring" viewBox="0 0 100 100">
          <path className="closure-route-soft" d={pathOf(route.map(project))} />
          <path className="closure-route" d={pathOf(route.map(project))} />
          <path className="closure-gap-guide" d={pathOf(ringPositions(345,380,20).map(project))} />
          {closed && <path className="closure-join" d={pathOf(ringPositions(345,345+35*joinProgress,20).map(project))} />}
          {CLOSURE_PARTS.map((part,index)=>{
            const dots=part.stones.map(project),p=dots[0];
            return part.symbol==='.'?<circle className="closure-route-mark" key={part.node} cx={p.x} cy={p.y} r={.6} data-part={index} />
              :<path key={part.node} className="closure-route-mark" d={pathOf(dots)} data-part={index} />;
          })}
        </svg>
      </div>
      {closed&&phase.join>=1&&<>
        <svg className="closure-reflections" viewBox="0 0 100 100" aria-hidden="true">
          <g style={{opacity:selected===null?sweep.trailOpacity:0}}>
            <path className="closure-sweep-memory" d={trail} />
            <path className="closure-sweep-halo" d={tail} />
            <path className="closure-sweep-thread" d={tail} />
          </g>
          {CLOSURE_PARTS.flatMap((part,index)=>part.stones.map((stone,j)=>{
            const p=project(stone);
            return <circle key={part.node+'-'+j} className="closure-reflection" data-part={index} data-diamond={j} cx={p.x} cy={p.y} r={.85}
              style={{...stoneStyle(index,j),opacity:strength(index,j)*(loaded?.5:1-phase.solid)}} />;
          }))}
        </svg>
        <div className="closure-sweep-star" aria-hidden="true" data-part={sweep.index}
          style={{left:sweepPoint.x+'%',top:sweepPoint.y+'%',opacity:sweep.starOpacity}}><CompanionLight choices={choices} pink /></div>
      </>}
      {!closed && <button type="button" className={'closure-target' + (near ? ' is-near' : '')}
          style={{ left:target.x+'%',top:target.y+'%' }} disabled={paused||hidden||!entryReady}
          onClick={()=>join()} aria-label="接通最后一段星路"><span aria-hidden="true">✦</span></button>}
      {(!closed || phase.join < 1) && <button ref={light} type="button" className="closure-carried" disabled={closed||paused||hidden||!entryReady}
          style={{left:start.x+'%',top:start.y+'%',opacity:closed?1:fromRelay?arrival.opacity:overview} as CSSProperties}
          aria-label="把同行的星光拖到对端，也可按回车接通星路"
          onPointerDown={(event) => {
            if (paused || document.hidden || begun.current || pointer.current || !entryReady || event.button > 0 || event.isPrimary === false) return;
            event.preventDefault(); const p=position(event,null),home=point??anchor;
            pointer.current={id:event.pointerId,dx:p.x-home.x,dy:p.y-home.y};
            event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
          }}
          onPointerMove={(event)=>{
            if(paused||!pointer.current||pointer.current.id!==event.pointerId)return;
            const p=position(event),snapped=gapNearest(p);
            setPoint(snapped.distance*size/100<=28?snapped.point:p);setNear(isNear(p));
          }}
          onPointerUp={(event)=>{
            if(pointer.current?.id!==event.pointerId)return;
            const p=position(event);
            if(isNear(p))join(gapNearest(p).angle);else clear();
          }} onPointerCancel={clear} onLostPointerCapture={clear}
          onClick={(event)=>{if(event.detail===0)join();}}>
          <CompanionLight choices={choices} pink />
        </button>}
      </div>
    </div>
    </div>
    <div className="closure-footer">
    <div className="closure-reading" ref={reading} inert={presentation} aria-hidden={presentation} style={{opacity:presentation?handoff.closureOpacity:1}}>
      {!closed ? <p className="closure-invitation">把同行的光，带到最后一个星点。</p> : <>
        <div className="closure-code" aria-label="W25 与手链上的三组长短链节">
          {CLOSURE_CODES.map((code,i)=><button type="button" key={code} disabled={paused||!phase.ready}
            className={group===i||phase.ready&&selected===null?'is-current':''} aria-pressed={selected===i}
            aria-label={'查看手链上的 '+CLOSURE_LETTERS[i]+'，'+code} onClick={()=>select(i)}>
            <span className="closure-symbols" aria-hidden="true">{code.split('').map((symbol,j)=><i key={j} className={symbol==='-'?'long':''} />)}</span>
            <strong>{phase.group>=i?CLOSURE_LETTERS[i]:'\u00a0'}</strong>
          </button>)}
        </div>
        <p className="closure-meaning">{phase.settled?'你的愿望、你的日子、你的颜色。都在这里。':'短的是一点，长的是一划。'}</p>
        <button type="button" className="closure-continue" disabled={paused||!phase.ready} onClick={finish}>
          {phase.ready?'让它来到眼前':'光还在慢慢经过'}<ArrowRight size={16} aria-hidden="true" />
        </button>
      </>}
    </div>
    <div className="closure-showcase-controls" ref={actions} inert={!(arrived||showcase)||paused||hidden||delivery.departing} aria-hidden={!(arrived||showcase)}
      style={{opacity:presentation?handoff.actionsOpacity:0,pointerEvents:arrived||showcase?'auto':'none'}}>
      <BraceletActions loaded={loaded} paused={paused||hidden} departing={delivery.departing} enabled={arrived||showcase} onDeliver={delivery.depart}/>
    </div>
    </div>
    <BraceletDissolve delivery={delivery} reduced={reduced}/>
  </section>;
}
