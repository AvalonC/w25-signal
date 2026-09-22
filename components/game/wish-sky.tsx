'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CompanionLight } from './path-sky';
import { useVisibleClock } from './scene-clock';
import { NOUNS } from '@/lib/journey';
import type { WishField } from './particles';

const LOCATIONS = [[23,16],[72,12],[47,34],[16,47],[80,43],[29,66],[74,66],[50,85]];
export function WishSky({choices,paused,onChoose,onField,onDone}: {
  choices:number[]; paused:boolean; onChoose:(i:number)=>void; onField:(field:WishField|null)=>void; onDone:()=>void;
}) {
  const sky = useRef<HTMLDivElement>(null), buttons = useRef<(HTMLButtonElement|null)[]>([]);
  const drag = useRef<{id:number;i:number;x:number;y:number}|null>(null);
  const [departure,setDeparture] = useState(false), [reduced,setReduced]=useState(false);
  const finished=useRef(false), sent=useRef(false), callbacks=useRef({onField,onDone});
  callbacks.current={onField,onDone};
  const gathered=choices.length===3;
  const clock=useVisibleClock(gathered&&!paused, 'gather');
  const flight=useVisibleClock(departure&&!paused,'flight');
  const q=Math.min(1,flight/(reduced?250:1600));
  const ease=q*q*(3-2*q);
  const carrier={x:50-24*ease,y:77+1*ease-Math.sin(q*Math.PI)*22};
  useEffect(()=>{setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);},[]);
  useEffect(()=>{
    if(paused||document.hidden)return;
    if(gathered&&clock>=(reduced?350:2100))setDeparture(true);
    if(departure&&q>=1&&!finished.current){finished.current=true;callbacks.current.onDone();}
  },[clock,gathered,departure,q,paused,reduced]);
  useLayoutEffect(()=>{
    const area=sky.current;if(!area)return;
    const update=()=>{
      const r=area.getBoundingClientRect();
      callbacks.current.onField({nodes:LOCATIONS.map(([x,y],i)=>({word:NOUNS[i][0],x:r.left+r.width*x/100,y:r.top+r.height*y/100,selected:choices.includes(i),order:choices.indexOf(i)})),
        carrier:{x:r.left+r.width*carrier.x/100,y:r.top+r.height*carrier.y/100},departing:departure});
    };
    update();const observer=new ResizeObserver(update);observer.observe(area);
    return()=>observer.disconnect();
  },[choices,departure,carrier.x,carrier.y]);
  useEffect(()=>()=>callbacks.current.onField(null),[]);
  useEffect(()=>{
    const cancel=()=>{drag.current=null;};
    if(paused)cancel();
    window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);
    return()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',cancel);};
  },[paused]);
  const choose=(i:number)=>{if(paused||document.hidden||gathered||choices.includes(i)||sent.current)return;onChoose(i);};
  return <section className={'wish-sky'+(departure?' is-departing':'')+(paused?' is-paused':'')} aria-label="留下三个愿望，让它们陪星光出发">
    <div ref={sky} className="wish-world">
      {LOCATIONS.map(([x,y],i)=><button key={i} ref={el=>{buttons.current[i]=el;}} className={'wish-star'+(choices.includes(i)?' is-gathered':'')}
        style={{left:x+'%',top:y+'%'} as CSSProperties} aria-label={NOUNS[i][0]+(choices.includes(i)?'，已经同行':'，轻触或拖动选择')}
        aria-pressed={choices.includes(i)} disabled={paused||gathered||choices.includes(i)}
        onPointerDown={e=>{if(paused||gathered||e.button>0)return;drag.current={id:e.pointerId,i,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerUp={e=>{if(drag.current?.id!==e.pointerId||drag.current.i!==i)return;drag.current=null;choose(i);}}
        onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
        onClick={e=>{if(e.detail===0)choose(i);}}>
        <span className="sr-only">{NOUNS[i][0]}</span><i aria-hidden="true" />
      </button>)}
      <span className="wish-carrier" style={{left:carrier.x+'%',top:carrier.y+'%'}} aria-hidden="true"><CompanionLight choices={[]} pink={false}/></span>
      <output className="sr-only">{choices.map(i=>NOUNS[i][0]).join('、')}{gathered?'。三个愿望已同行。':''}</output>
    </div>
  </section>;
}
