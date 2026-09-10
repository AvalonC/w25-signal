'use client';
import { useEffect, useRef } from 'react';
import { meteorFlight } from '@/lib/motion';
export function PassingMeteor({ paused }: {paused: boolean}) {
  const ref=useRef<HTMLCanvasElement>(null), pause=useRef(paused);pause.current=paused;
  useEffect(()=>{
    const c=ref.current!,g=c.getContext('2d');if(!g||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let frame=0,last=performance.now(),elapsed=0,flight=meteorFlight();
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(document.hidden||pause.current){last=now;return;}if(now-last<32)return;
      elapsed+=Math.min(now-last,80);last=now;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      const p=(elapsed-flight.delay)/flight.duration;if(p<0)return;
      if(p>1){flight=meteorFlight();elapsed=0;return;}
      const distance=Math.min(w,h)*.22,x=flight.x*w+flight.dx*distance*p,y=flight.y*h+flight.dy*distance*p;
      const len=flight.length*Math.sin(p*Math.PI),tailX=x-flight.dx*len,tailY=y-flight.dy*len;
      g.globalAlpha=flight.opacity*Math.sin(p*Math.PI);
      const gradient=g.createLinearGradient(tailX,tailY,x,y);gradient.addColorStop(0,'#ffb3de00');gradient.addColorStop(1,'#ffe0f2');
      g.strokeStyle=gradient;g.lineWidth=.7;g.beginPath();g.moveTo(tailX,tailY);g.lineTo(x,y);g.stroke();
      g.fillStyle='#ffeaf6';g.beginPath();g.arc(x,y,flight.radius,0,7);g.fill();
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={ref} className="passing-meteor" aria-hidden="true" />;
}
