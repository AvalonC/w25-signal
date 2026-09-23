'use client';
// The continuous canvas reads current values from its RAF and exposes a two-dimensional gesture surface.
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef } from 'react';
import { MOTION, softStep } from '@/lib/motion';
import { prismEntranceFrame, PRISM_ENTRANCE_MS } from '@/lib/light-infusion';
import type { SkyPoint } from '@/lib/path-arrival';

export function PrismLight({ value, bloom, paused, locked, onChange, entrance = 1, entryTime = PRISM_ENTRANCE_MS, entryOrigin }: {
  value: number; bloom: number; paused: boolean; locked: boolean; onChange: (n: number) => void; entrance?: number;
  entryTime?: number; entryOrigin?: SkyPoint;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const current = useRef({ value, bloom, paused, entrance, entryTime, entryOrigin }); current.current = { value, bloom, paused, entrance, entryTime, entryOrigin };
  useEffect(() => { if (paused || locked) drag.current = null; }, [paused, locked]);
  useEffect(() => {
    const cancel = () => { drag.current = null; };
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0, last = 0, time = 0, angle = current.current.value;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    const motion = () => { reduced = media.matches; }; media.addEventListener('change', motion);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || current.current.paused) { last = now; return; }
      if (now-last < 32) return;
      time += Math.min(60, now-last); last = now;
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (w <= 0 || h <= 0) return;
      if (c.width !== Math.round(w*dpr) || c.height !== Math.round(h*dpr)) { c.width = Math.round(w*dpr); c.height = Math.round(h*dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      angle += (current.current.value-angle)*(reduced ? 1 : .085);
      const p=current.current, camera=prismEntranceFrame(p.entryTime,reduced);
      const spread = softStep(p.bloom/MOTION.prismBloom), close = Math.exp(-(((angle-68)/13)**2));
      const power = p.entrance*camera.spectrum, drift = reduced ? 0 : time*.00023;
      const cameraTravel=reduced?1:camera.approach*.42+camera.turn*.58;
      const cx = w*(.62-.18*cameraTravel), cy = h*(.41+.08*cameraTravel);
      const size = Math.min(w*.23, h*.23)*(reduced?1:.45+.55*cameraTravel), end=w*1.08;
      const yaw=reduced?-.35:-1.46+1.11*camera.turn, tilt=(angle-50)*.009*camera.turn;
      const project=(x:number,y:number,z:number)=>{
        const rx=x*Math.cos(yaw)+z*Math.sin(yaw),rz=z*Math.cos(yaw)-x*Math.sin(yaw);
        const perspective=3.8/(3.8+rz),px=rx*size*perspective,py=y*size*perspective;
        return {x:cx+px*Math.cos(tilt)-py*Math.sin(tilt),y:cy+px*Math.sin(tilt)+py*Math.cos(tilt),z:rz};
      };
      const front=[project(0,-1,.44),project(-.86,.65,.44),project(.86,.65,.44)];
      const back=[project(0,-1,-.44),project(-.86,.65,-.44),project(.86,.65,-.44)];
      const inlet=project(-.44,-.16,.44),outlet=project(.44,-.16,.44);
      const source={x:w*.1,y:cy+size*.6};
      ctx.globalCompositeOperation = 'lighter';
      const beam=camera.beam, tip={x:source.x+(inlet.x-source.x)*beam,y:source.y+(inlet.y-source.y)*beam};
      if(beam>0){
        const input=ctx.createLinearGradient(source.x,source.y,inlet.x,inlet.y);
        input.addColorStop(0,'#e6eeff00');input.addColorStop(.5,'#e8f0ff70');input.addColorStop(1,'#fff7fdcc');
        ctx.strokeStyle=input;ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
        if(beam>=1){ctx.globalAlpha=.55;ctx.strokeStyle='#fff4ff';ctx.lineWidth=.8;
          ctx.beginPath();ctx.moveTo(inlet.x,inlet.y);ctx.lineTo(outlet.x,outlet.y);ctx.stroke();ctx.globalAlpha=1;}
      }
      if(!camera.done){
        const box=c.getBoundingClientRect(),origin=p.entryOrigin?{x:p.entryOrigin.x*innerWidth-box.left,y:p.entryOrigin.y*innerHeight-box.top}:{x:w*.5,y:h*.86};
        const meeting={x:w*.53,y:h*.52};
        const advance=camera.approach,orbit=camera.turn;
        const forward={x:origin.x+(meeting.x-origin.x)*advance,y:origin.y+(meeting.y-origin.y)*advance};
        const star={x:forward.x+(source.x-forward.x)*orbit,y:forward.y+(source.y-forward.y)*orbit};
        const at=beam>0?tip:star,opacity=1-softStep((camera.spectrum-.05)/.5);
        ctx.globalAlpha=opacity;ctx.fillStyle='#fff3fc';ctx.shadowColor='#dbe9ff';ctx.shadowBlur=14;
        const r=12-(camera.approach*4);ctx.beginPath();ctx.moveTo(at.x,at.y-r);ctx.lineTo(at.x+2,at.y-2);
        ctx.lineTo(at.x+r,at.y);ctx.lineTo(at.x+2,at.y+2);ctx.lineTo(at.x,at.y+r);ctx.lineTo(at.x-2,at.y+2);ctx.lineTo(at.x-r,at.y);ctx.lineTo(at.x-2,at.y-2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
      }
      // Overlapping curved bands and sparse travelling points keep the light continuous.
      for (let i = 0; i < 84; i++) {
        const f = i/83, ribbon = reduced ? 0 : Math.sin(drift+f*7)*h*.014;
        const offset = (f-.5)*(h*.38+spread*h*.34), shift = (angle-50)*h*.0018;
        const ey = outlet.y+offset+shift+ribbon;
        const band = ctx.createLinearGradient(outlet.x, outlet.y, end, ey);
        const hue = (266-f*236)*(1-close)+326*close;
        const alpha = (.014+Math.sin(f*Math.PI)*.021)*(1-spread*.25)*power;
        band.addColorStop(0, `hsla(${hue},85%,86%,${alpha*.5})`);
        band.addColorStop(.28, `hsla(${hue},92%,82%,${alpha})`);
        band.addColorStop(.72, `hsla(${hue},92%,82%,${alpha*.72})`);
        band.addColorStop(1, `hsla(${hue},90%,80%,0)`);
        ctx.strokeStyle = band; ctx.lineWidth = 3+spread*5;
        ctx.beginPath(); ctx.moveTo(outlet.x, outlet.y);
        ctx.bezierCurveTo(outlet.x+w*.16, outlet.y+offset*.18+ribbon, end-w*.18, ey-ribbon, end, ey); ctx.stroke();
        if (!reduced && i%6 === 0) {
          const t = (time*.00008+f*.87)%1, u = 1-t;
          const x = u*u*u*outlet.x+3*u*u*t*(outlet.x+w*.16)+3*u*t*t*(end-w*.18)+t*t*t*end;
          const y = u*u*u*outlet.y+3*u*u*t*(outlet.y+offset*.18+ribbon)+3*u*t*t*(ey-ribbon)+t*t*t*ey;
          ctx.fillStyle = `hsla(${hue},80%,91%,${Math.sin(t*Math.PI)*.32*power})`;
          ctx.beginPath(); ctx.arc(x, y, .6+(i%3)*.2, 0, Math.PI*2); ctx.fill();
        }
      }
      const glow = ctx.createRadialGradient(cx+size*.4, cy, 0, cx+size*.4, cy, size*(2+spread*2.5));
      glow.addColorStop(0, `rgba(255,211,238,${(.025+close*.05+Math.sin(spread*Math.PI)*.07)*power})`);
      glow.addColorStop(.5, `rgba(216,213,255,${.012*power})`); glow.addColorStop(1, '#f3d6ed00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const faces=[back,[front[0],front[1],back[1],back[0]],[front[1],front[2],back[2],back[1]],[front[2],front[0],back[0],back[2]],front];
      faces.sort((a,b)=>b.reduce((sum,v)=>sum+v.z,0)/b.length-a.reduce((sum,v)=>sum+v.z,0)/a.length);
      ctx.globalAlpha=1-spread*.25;
      for(const face of faces){
        const glass=ctx.createLinearGradient(cx-size,cy-size,cx+size,cy+size);
        glass.addColorStop(0,'#d7eaff06');glass.addColorStop(.55,`rgba(216,232,255,${.03+(1-camera.turn)*.09})`);glass.addColorStop(1,'#ffe8fa0d');
        ctx.fillStyle=glass;ctx.strokeStyle='#dce7fa77';ctx.lineWidth=.75;
        ctx.beginPath();face.forEach((v,i)=>{if(i===0)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y);});ctx.closePath();ctx.fill();ctx.stroke();
      }
      if(camera.turn>0&&camera.turn<1){
        const sheen=project(-.65+camera.turn*1.3,-.3,.44);ctx.globalAlpha=Math.sin(camera.turn*Math.PI)*.5;
        ctx.strokeStyle='#f7edff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sheen.x-size*.07,sheen.y-size*.34);ctx.lineTo(sheen.x+size*.07,sheen.y+size*.34);ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', motion); };
  }, []);
  return <div className="prism-light" role="slider" tabIndex={paused || locked ? -1 : 0} aria-label="左右拖动棱镜，观察光的变化"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-disabled={paused || locked}
    onKeyDown={(e) => { if (paused || locked) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); onChange(value+(e.key === 'ArrowRight' ? 2 : -2)); } }}
    onPointerDown={(e) => { if (paused || locked || document.hidden || drag.current || e.button > 0) return;
      drag.current = { id: e.pointerId, x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (!drag.current || drag.current.id !== e.pointerId || paused || locked) return;
      onChange(value+(e.clientX-drag.current.x)*.32); drag.current.x = e.clientX; }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }} onBlur={() => { drag.current = null; }}>
    <canvas ref={canvas} aria-hidden="true" />
  </div>;
}
