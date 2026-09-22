'use client';
/* oxlint-disable react/react-compiler */
import {useEffect,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {useVisibleClock} from './scene-clock';
import {cipherMarks} from '@/lib/hana-cipher';
const marks=cipherMarks();
const ease=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export function CipherReveal({paused,onDone}:{paused:boolean;onDone:()=>void}){
  const [unlocked,setUnlocked]=useState(false),[reduced,setReduced]=useState(false);
  const ref=useRef<HTMLCanvasElement>(null),done=useRef(false);
  const time=useVisibleClock(unlocked&&!paused);
  const live=useRef({time,unlocked,paused,reduced});live.current={time,unlocked,paused,reduced};
  const ready=unlocked&&time>=(reduced?1000:8000);
  useEffect(()=>{setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);},[]);
  useEffect(()=>{
    const c=ref.current!,g=c.getContext('2d');if(!g)return;let frame=0,last=0;
    const paint=(now:number)=>{
      frame=requestAnimationFrame(paint);if(document.hidden||live.current.paused||now-last<32)return;last=now;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(!w||!h)return;
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      const p=live.current,t=p.reduced&&p.unlocked?8500:p.time,step=Math.min(8,w/47),charWidth=step*6;
      const travel=p.unlocked?ease((t-1600)/3200):0,resolve= p.unlocked?ease((t-5900)/1800):0;
      marks.forEach((mark,i)=>{
        const row=i<7?0:1,at=i<7?i:i-7;
        const sx=w/2-charWidth*(row?3.9:3.5)+(at+(row&&at>=3?.8:0))*charWidth+step/2,sy=h*.35+row*step*11-step*3;
        mark.dots.forEach((dot,j)=>{
          const pink=j===mark.index,decoy=i===13;
          let x=sx+dot.x*step,y=sy+dot.y*step;
          const group=i<3?0:i<8?1:2,within=i<3?i:i<8?i-3:i-8;
          const gx=w*(.19+group*.31)+(within-((group===0?3:5)-1)/2)*step*2.4;
          const gy=h*.48;
          if(pink){x+=(gx-x)*travel;y+=(gy-y)*travel;}
          g.globalAlpha=pink?(decoy?1-travel:1-resolve):1-travel;
          g.fillStyle=pink?'#ffc5e4':'#c8d1e3';g.beginPath();g.arc(x,y,pink?1.8:1.05,0,7);g.fill();
          if(pink&&mark.symbol==='-'&&travel>.5){g.globalAlpha=travel*(1-resolve);g.strokeStyle='#ffc5e4';g.lineWidth=2;
            g.beginPath();g.moveTo(x-step*.7*travel,y);g.lineTo(x+step*.7*travel,y);g.stroke();}
        });
      });
      if(travel<1){g.globalAlpha=1-travel;g.strokeStyle='#c8d1e3';g.lineWidth=1.2;
        const dashX=w/2-charWidth*.9;g.beginPath();g.moveTo(dashX,h*.35+step*11);g.lineTo(dashX+step*2,h*.35+step*11);g.stroke();}
      if(resolve>0){g.globalAlpha=resolve;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffe0ef';
        g.font='38px Georgia';['W','2','5'].forEach((letter,i)=>g.fillText(letter,w*(.19+i*.31),h*.48));}
      g.globalAlpha=1;
    };frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);
  },[]);
  return <section className="cipher-reveal" aria-label="Project N7A-3914 的秘密">
    <p className="cipher-whisper">还有一个名字，一直藏在星光里。</p>
    <canvas ref={ref} className="cipher-canvas" aria-label={ready?'W25':'Project N7A-3914，每个字符藏着一颗粉点'} />
    <div className="cipher-key-row">
      <button className={'cipher-key'+(unlocked?' is-unlocked':'')} disabled={paused||unlocked} aria-label="用 HANA 唤醒藏在粉点中的名字" onClick={()=>setUnlocked(true)}>
        <span>HANA</span><small>{unlocked?'8 · 1 · 14 · 1':'✧'}</small>
      </button>
      <p className="cipher-note" aria-live="polite">{ready?'原来，每一颗粉点，都在说同一个名字。':unlocked?'名字是钥匙。粉点记住了长短的光。':'轻触这个名字，让粉点说出它的秘密。'}</p>
    </div>
    <button className="cipher-continue" disabled={paused||!ready} onClick={()=>{if(done.current||!ready||paused)return;done.current=true;onDone();}}>
      读你的生日回信 <ArrowRight size={16}/>
    </button>
  </section>;
}
