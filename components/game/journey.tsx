'use client';
/* oxlint-disable react/react-compiler */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Volume2,VolumeX,HelpCircle,ArrowRight} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {Starfield,type WishField} from './particles';
import {GuidingLight} from './guiding-light';
import {WishSky} from './wish-sky';
import {StarPathJourney} from './star-path-journey';
import {EchoRelay} from './echo-relay';
import {RelayDeparture} from './relay-departure';
import {PathClosure} from './path-closure';
import {BlessingAscent} from './blessing-ascent';
import {freshPath} from '@/lib/star-path';
import {gift} from '@/lib/gift-config';
import {deliveredWishes} from '@/lib/echo-relay';
import {fresh,readSave,restart,revisitJourney,finish,PINK,type Journey} from '@/lib/journey';
import {MOTION_STYLE} from '@/lib/motion';
import {switchTap,tone,feedback,silence,playBirthday} from '@/lib/feedback';
import type {StarArrival} from '@/lib/bracelet-transition';
import type {SkyHandoff} from '@/lib/path-arrival';

export default function JourneyGame(){
  const [s,setS]=useState<Journey>(fresh),[ready,setReady]=useState(false),[boot,setBoot]=useState(true);
  const [sound,setSound]=useState(false),[help,setHelp]=useState(false),[revisit,setRevisit]=useState(false),[saveOK,setSaveOK]=useState(true);
  const [lessonReplay,setLessonReplay]=useState<boolean|null>(null);
  const [skyHandoff,setSkyHandoff]=useState<SkyHandoff|null>(null);
  const [relayFlight,setRelayFlight]=useState(false);
  const [wishField,setWishField]=useState<WishField|null>(null),[arrival,setArrival]=useState<StarArrival|null>(null);
  const [letterVisit,setLetterVisit]=useState(0);
  const [modelBurst,setModelBurst]=useState(false),[returning,setReturning]=useState(false);
  const haptic=useRef<HTMLInputElement>(null),returnTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const soundRef=useRef(sound);soundRef.current=sound;
  const patch=(value:Partial<Journey>)=>setS(p=>({...p,...value}));
  const tap=()=>switchTap(haptic.current,soundRef.current);
  useEffect(()=>{
    haptic.current?.setAttribute('switch','');
    try{
      const saved=readSave(localStorage.getItem('w25-journey-v2'),localStorage.getItem('w25-signal-v1'));
      setS(saved.completed&&saved.stage===7?{...saved,stage:0}:saved);
      setSound(localStorage.getItem('w25-sound')==='on');
    }catch{setSaveOK(false);}
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!ready)return;
    try{localStorage.setItem('w25-journey-v2',JSON.stringify(s));localStorage.setItem('w25-sound',sound?'on':'off');}catch{setSaveOK(false);}
  },[s,sound,ready]);
  useEffect(()=>{
    if(!ready||!boot)return;
    const timer=setTimeout(()=>setBoot(false),700);return()=>clearTimeout(timer);
  },[ready,boot]);
  useEffect(()=>{
    const stop=()=>{silence();};
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
    return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);if(returnTimer.current)clearTimeout(returnTimer.current);silence();};
  },[]);
  useEffect(()=>{
    if(s.stage===7&&!boot&&sound&&!returning)playBirthday();
    return()=>{silence();};
  },[s.stage,letterVisit,boot,sound,returning]);
  useEffect(()=>{setModelBurst(false);},[s.stage]);
  const start=(replay=false)=>{setRelayFlight(false);setSkyHandoff(null);setWishField(null);setLessonReplay(null);setArrival(null);setRevisit(false);setS(p=>restart(p,replay));};
  const beginLesson=(replay:boolean)=>{tap();setRevisit(false);setArrival(null);setLessonReplay(replay);};
  const showLetter=()=>{tap();setArrival(null);setLetterVisit(n=>n+1);setRevisit(false);setS(p=>finish(p));};
  const revisitAt=(stage:6|7)=>{
    tap();setArrival(null);setLetterVisit(n=>n+1);setRevisit(false);setS(p=>revisitJourney(p,stage));
  };
  const home=()=>{
    if(returning)return;setReturning(true);setArrival(null);
    returnTimer.current=setTimeout(()=>{patch({stage:0});setReturning(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?200:1000);
  };
  const hint=s.stage===1?'轻触你想留下的三个愿望。它们会化成伴星，陪你继续。':s.stage===2?
    s.path?.place==='sapphire'?'左右转动宝石，寻找光停留的角度。光变亮时松手等一会。三处发现之后，触碰右上方的粉光。':
    s.path?.place==='date'?'转动两枚星盘，停在你的生日。两束光相遇后，轻触同行的星返回星路。':
    s.path?.place==='prism'?'慢慢转动棱镜，观察光谱。粉色留下时，等待同行的星从光里飞出。':'把主星带到棱镜或星盘，也可以直接轻触它们。两份发现会在宝石里相遇。':
    s.stage===5&&s.decoded===3?'愿望已经送达。星光会带你继续向前。':
    s.stage===5?'先轻触愿望伴星。远方示范时看它闪动，轮到你时轻按主星送出短光，按住一秒送出长光。也可用下方的短光、长光按钮。第二段光暗下时请伴星帮忙，第三段轮流回应。':
    '把主星带到缺口另一端，或轻触终点。看长短光在手链上亮起，然后把礼物带到眼前。';
  const fieldText=s.stage===0?(s.completed&&lessonReplay===null?gift.name.replace(' & ','\n& '):'Project\nN7A-3914'):'';
  return <div className={'cosmos free-flow immersive-journey stage-'+s.stage+(boot?' booting':'')+(modelBurst?' bracelet-leaving':'')+(help||revisit?' journey-paused':'')+(returning?' ending-returning':'')}
    style={{'--pink':PINK,...MOTION_STYLE} as CSSProperties}>
    <Starfield text={fieldText} wishes={s.stage===1||s.stage===2&&s.path?.place==='sky'?wishField:null} paused={help||revisit} arrival={arrival} burst={returning}/>
    <input ref={haptic} type="checkbox" className="haptic-switch" tabIndex={-1} aria-hidden="true"/>
    <header className="sky-header">
      <span className="sky-brand" aria-label="星间来信">✧<span>星 间 来 信</span></span>
      <div>
        <button title={sound?'关闭声音':'开启声音'} aria-label={sound?'关闭声音':'开启声音'} aria-pressed={sound} onClick={()=>{setSound(v=>!v);if(!sound)tone(140);else silence();}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>
        {s.stage>1&&s.stage<7&&<button title="查看提示" aria-label="查看提示" onClick={()=>{setHelp(true);}}><HelpCircle size={18}/></button>}
      </div>
    </header>
    {boot?<main className="journey-boot" aria-label="星光正在汇聚"><button aria-label="进入星海" onClick={()=>setBoot(false)}><span aria-hidden="true">✧</span></button></main>:
      s.stage===0?!s.completed||lessonReplay!==null?<GuidingLight onArrive={()=>start(lessonReplay??false)} paused={help||revisit}
        onFeedback={symbol=>{if(symbol==='.')tap();else feedback(140,soundRef.current);}}/>:
        <button className="start-sky known" aria-label={gift.name+'，点击选择重新开始或重温'} onClick={()=>setRevisit(true)}><span className="start-cue">旧的星光，也可以有新的相遇。</span></button>:
      <main className={'scene scene-'+s.stage+(s.stage===2?' scene-path':'')}>
        {s.stage===1&&<WishSky choices={s.choices} paused={help||revisit} onField={setWishField}
          onChoose={i=>{tap();setS(p=>p.choices.includes(i)||p.choices.length>=3?p:{...p,choices:[...p.choices,i]});}}
          onDone={handoff=>{setSkyHandoff(handoff);patch({stage:2});}}/>}
        {s.stage===2&&<StarPathJourney path={s.path??freshPath()} choices={s.choices} month={s.month} day={s.day} rotation={s.rotation} paused={help||revisit}
          handoff={skyHandoff} onField={setWishField}
          onPath={path=>patch({path,color:path.color})} onDate={(month,day)=>patch({month,day})} onRotation={rotation=>patch({rotation})} onTap={tap}
          onComplete={()=>setS(p=>({...p,color:true,stars:13,stone:true,rotation:150,stage:5}))}/>}
        {s.stage===5&&(s.decoded<3?<EchoRelay key={s.decoded} choices={s.choices} delivered={deliveredWishes(s.choices,s.decoded,s.echoWishes)} paused={help||revisit}
          onTone={ms=>{if(soundRef.current)tone(ms);}} onTouch={symbol=>{if(symbol)feedback(symbol==='.'?30:140,soundRef.current);else tap();}}
          onDelivered={wish=>setS(p=>({...p,decoded:p.decoded+1,echoWishes:[...deliveredWishes(p.choices,p.decoded,p.echoWishes),wish]}))}/>:
          <RelayDeparture choices={s.choices} paused={help||revisit} onContinue={()=>{setRelayFlight(true);patch({stage:6,pathClosed:false});}}/>) }
        {s.stage===6&&<>
          <PathClosure choices={s.choices} paused={help||revisit} fromRelay={relayFlight} showcase={!!s.pathClosed}
            onComplete={()=>{tap();patch({pathClosed:true});}} onScatter={()=>{tap();setModelBurst(true);}}
            onGem={points=>{setArrival(points);setModelBurst(false);setLetterVisit(n=>n+1);setS(p=>finish(p));}}/>
          {s.completed&&<nav className="journey-revisit" aria-label="重访星间来信" inert={!s.pathClosed||modelBurst} aria-hidden={!s.pathClosed||modelBurst} style={{visibility:s.pathClosed&&!modelBurst?'visible':'hidden'}}><button onClick={showLetter}>读生日回信</button><button onClick={home}>回到星空</button></nav>}
        </>}
        {s.stage===7&&<BlessingAscent key={letterVisit} choices={s.choices} paused={help||revisit||returning}
          origin={arrival?.origin} onFeedback={tap} onExit={home}/>}

      </main>}
    {!saveOK&&<output className="storage-note">当前浏览器无法保存旅程，请保持页面打开。</output>}
    <Dialog open={revisit} onOpenChange={setRevisit}><DialogContent className="sky-dialog">
      <DialogTitle>又见面了，Leah。</DialogTitle><DialogDescription>愿望和回信，都还在这里。</DialogDescription>
      <button className="continue" onClick={()=>revisitAt(6)}>看看手链与现实中的光</button>
      <button className="soft-button" onClick={()=>revisitAt(7)}>读生日回信</button>
      <button className="continue" onClick={()=>beginLesson(true)}>重温之前的选择 <ArrowRight size={16}/></button>
      <button className="soft-button" onClick={()=>beginLesson(false)}>重新开始，选择新的愿望</button>
      <DialogClose className="soft-button">再看一会星空</DialogClose>
    </DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="sky-dialog"><DialogTitle>让星光再亮一点</DialogTitle>
      <DialogDescription>{hint}</DialogDescription><DialogClose className="continue">继续寻找</DialogClose>
    </DialogContent></Dialog>
  </div>;
}
