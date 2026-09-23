'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ModelSurfaceHandle } from './model-surface';
import { BraceletStardust } from './bracelet-stardust';
import { QuickLookLink } from './quick-look-link';
import { BRACELET_ASSETS } from '@/lib/model-assets';
import { gift } from '@/lib/gift-config';
import { useVisibleClock } from './scene-clock';
import { braceletPhase, clickOrigin, type CameraView, type StarArrival, type Vec3, type ViewPoint } from '@/lib/bracelet-transition';
import metadata from '../../public/models/jewelry-metadata.json';
import constellation from '../../public/models/bracelet-stars.json';
const points=constellation.points as Vec3[];

/** Delivery uses the same model and actual camera that the player has rotated. */
export function useBraceletDelivery({onGem,onScatter,paused,enabled,reduced,viewer,surface}:{
  onGem:(arrival:StarArrival)=>void;onScatter:()=>void;paused:boolean;enabled:boolean;reduced:boolean;
  viewer:RefObject<ModelSurfaceHandle|null>;surface:RefObject<HTMLDivElement|null>;
}){
  const [departing,setDeparting]=useState(false),[view,setView]=useState<CameraView|null>(null);
  const positions=useRef<ViewPoint[]>([]),started=useRef(false),done=useRef(false);
  const origin=useRef<ViewPoint>({x:.5,y:.52}),viewport=useRef({width:1,height:1});
  const [blurred,setBlurred]=useState(false),unfocused=useRef(false);
  useEffect(()=>{
    const blur=()=>{unfocused.current=true;setBlurred(true);};
    const focus=()=>{unfocused.current=false;setBlurred(false);};
    if(document.hasFocus&&!document.hasFocus())blur();
    window.addEventListener('blur',blur);window.addEventListener('focus',focus);
    return()=>{window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);};
  },[]);
  const clock=useVisibleClock(departing&&!paused&&!blurred),phase=braceletPhase(clock,reduced);
  useEffect(()=>{
    if(!departing||paused||unfocused.current||document.hidden||!phase.done||done.current)return;
    done.current=true;onGem({id:Date.now(),points:positions.current,origin:origin.current,viewport:viewport.current});
  },[departing,paused,blurred,phase.done,onGem]);
  const depart=(from?:ViewPoint)=>{
    if(!enabled||started.current||paused||unfocused.current||document.hidden||!surface.current)return;
    started.current=true;
    const rect=surface.current.getBoundingClientRect(),square=Math.min(rect.width,rect.height);
    viewport.current={width:window.innerWidth,height:window.innerHeight};
    origin.current=from??{x:(rect.left+rect.width/2)/Math.max(1,window.innerWidth),y:(rect.top+rect.height/2)/Math.max(1,window.innerHeight)};
    setView(viewer.current?.camera()??{
      theta:metadata.poster.theta,phi:metadata.poster.phi,radius:.145,fov:30,orthographicSpan:metadata.poster.span,
      target:metadata.poster.target as Vec3,left:rect.left+(rect.width-square)/2,top:rect.top+(rect.height-square)/2,width:square,height:square,
    });
    setDeparting(true);onScatter();
  };
  return {departing,view,positions,origin,viewport,clock,phase,depart};
}
export function BraceletDissolve({delivery,reduced}:{delivery:ReturnType<typeof useBraceletDelivery>;reduced:boolean}){
  return <>{delivery.departing&&delivery.view&&<BraceletStardust elapsed={delivery.clock} reduced={reduced} points={points} view={delivery.view}
    onPositions={(value,viewport)=>{delivery.positions.current=value;delivery.viewport.current=viewport;}}/>}
    {delivery.departing&&createPortal(<div className="bracelet-origin-star" aria-hidden="true" style={{left:delivery.origin.current.x*100+'vw',top:delivery.origin.current.y*100+'dvh'}}><svg viewBox="0 0 100 100"><path d="M50 6 58 40 91 50 58 60 50 94 42 60 9 50 42 40Z"/><circle cx="50" cy="50" r="5"/></svg></div>,document.body)}
    {delivery.departing&&<output className="sr-only">手链正化作星光，请稍候。</output>}</>;
}
export function BraceletActions({loaded,paused,departing,enabled,onDeliver}:{loaded:boolean;paused:boolean;departing:boolean;enabled:boolean;onDeliver:(origin:ViewPoint)=>void}){
  const [arSupport,setArSupport]=useState<boolean|null>(null),[arRequested,setArRequested]=useState(false);
  useEffect(()=>{
    const link=document.createElement('a');setArSupport(!!link.relList.supports?.('ar'));
    const returned=()=>{if(!document.hidden)setArRequested(false);};
    document.addEventListener('visibilitychange',returned);window.addEventListener('focus',returned);
    return()=>{document.removeEventListener('visibilitychange',returned);window.removeEventListener('focus',returned);};
  },[]);
  return <div className="bracelet-actions" inert={!enabled||departing||paused} aria-hidden={!enabled||departing}>
    <p className="bracelet-caption bracelet-name" title={loaded?'拖动看一看，让光经过每一面。':'星光在这里，慢慢靠近。'}>{gift.name}</p>
    <p className="bracelet-delivery">把目光从屏幕移开。<br/>最后一束光，正等着来到你手里。</p>
    <button className="bracelet-send" disabled={!enabled||paused||departing} onClick={event=>onDeliver(clickOrigin(event,event.currentTarget.getBoundingClientRect(),window.innerWidth,window.innerHeight))}>礼物已在身边，读完这封信</button>
    <QuickLookLink onOpen={()=>setArRequested(true)}/>
    <output className="bracelet-ar-note">{arRequested?'正在打开现实中的预览，请稍候。':arSupport===false?'在 iPhone Safari 中打开，可以把它放到眼前。':'让这束光，在你眼前停一会。'}</output>
    {arRequested&&<a className="bracelet-file-link" href={BRACELET_ASSETS.file}>未打开？查看模型文件</a>}
  </div>;
}
