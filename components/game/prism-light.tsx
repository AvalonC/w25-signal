'use client';
import { useEffect, useRef } from 'react';
import { MOTION, softStep } from '@/lib/motion';

export function PrismLight({ value, bloom, paused, locked, onChange }: {
  value: number; bloom: number; paused: boolean; locked: boolean; onChange: (n: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), drag = useRef<number | null>(null);
  const current = useRef({value, bloom, paused}); current.current = {value,bloom,paused};
  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d'); if (!ctx) return;
    let frame=0, last=0, angle=current.current.value;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(document.hidden || current.current.paused || now-last<32) return;
      last=now;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      angle+=(current.current.value-angle)*(reduced?1:.085);
      const spread=softStep(current.current.bloom/MOTION.prismBloom), close=Math.exp(-(((angle-68)/13)**2));
      const cx=w*.44,cy=h*.49,size=Math.min(w*.20,h*.22),end=w*1.12;
      ctx.globalCompositeOperation='lighter';
      // A broad, nearly white incident beam; overlapping narrow bands make a
      // continuous spectrum instead of six ruler-straight coloured rays.
      const input=ctx.createLinearGradient(0,cy,cx,cy);
      input.addColorStop(0,'#dce8ff00');input.addColorStop(.6,'#e8edff40');input.addColorStop(1,'#fff3fa8a');
      ctx.strokeStyle=input;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,cy+8);ctx.lineTo(cx,cy);ctx.stroke();
      for(let i=0;i<72;i++){
        const f=i/71,offset=(f-.5)*(h*.36+spread*h*.6);
        const shift=(angle-50)*h*.0018;
        const ey=cy+offset+shift;
        const band=ctx.createLinearGradient(cx,cy,end,ey);
        const hue=260-f*220, pink=close;
        const alpha=(.018+Math.sin(f*Math.PI)*.02)*(1-spread*.4);
        band.addColorStop(0,`hsla(${hue*(1-pink)+326*pink},${80+20*pink}%,${83+2*pink}%,${alpha})`);
        band.addColorStop(.4,`hsla(${hue*(1-pink)+326*pink},${80+20*pink}%,${80+5*pink}%,${alpha})`);
        band.addColorStop(1,'#ffb3de00');
        ctx.strokeStyle=band;ctx.lineWidth=3+spread*8;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx+w*.16,cy+offset*.25,end-w*.15,ey,end,ey);ctx.stroke();
      }
      const glow=ctx.createRadialGradient(cx+size*.4,cy,0,cx+size*.4,cy,size*(1.6+spread*5));
      glow.addColorStop(0,`rgba(255,200,232,${.025+close*.045+Math.sin(spread*Math.PI)*.08})`);glow.addColorStop(1,'#ffb3de00');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='source-over';
      ctx.save();ctx.translate(cx,cy);ctx.rotate((angle-50)*.009);
      const glass=ctx.createLinearGradient(-size,-size,size,size);glass.addColorStop(0,'#d7e4ff08');glass.addColorStop(.6,'#c9dcff15');glass.addColorStop(1,'#fff1fb05');
      ctx.globalAlpha=1-spread*.65;ctx.fillStyle=glass;ctx.strokeStyle='#dce7fa70';ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(-size*.86,size*.65);ctx.lineTo(size*.86,size*.65);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#e4ddfa28';ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.13,size*.35);ctx.lineTo(-size*.86,size*.65);ctx.moveTo(size*.13,size*.35);ctx.lineTo(size*.86,size*.65);ctx.stroke();ctx.restore();
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <div className="prism-light" role="slider" tabIndex={paused||locked?-1:0} aria-label="左右拖动棱镜，观察光的变化"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-disabled={paused||locked}
    onKeyDown={(e)=>{if(paused||locked)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onChange(value+(e.key==='ArrowRight'?2:-2));}}}
    onPointerDown={(e)=>{if(paused||locked)return;drag.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={(e)=>{if(drag.current===null||paused||locked)return;onChange(value+(e.clientX-drag.current)*.32);drag.current=e.clientX;}}
    onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
    <canvas ref={canvas} aria-hidden="true" />
  </div>;
}
