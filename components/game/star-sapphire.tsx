'use client';
import { useEffect, useRef } from 'react';
import { softStep } from '@/lib/motion';
type V = [number,number,number];
const vertices: V[]=[]; const edges: [number,number][]=[];
for(let layer=0;layer<2;layer++) for(let i=0;i<8;i++){
  const a=i*Math.PI/4,r=(i%2?.58:1)*(layer?.96:.48);
  vertices.push([Math.cos(a)*r,layer?-.08:.4,Math.sin(a)*r]);
  edges.push([layer*8+i,layer*8+(i+1)%8]);
  if(layer) edges.push([i,8+i],[i,8+(i+1)%8]);
}
vertices.push([0,-.9,0]);for(let i=0;i<8;i++)edges.push([8+i,16]);
const seeds=edges.flatMap(([a,b],e)=>Array.from({length:9},(_,i)=>({v:vertices[a].map((v,k)=>v+(vertices[b][k]-v)*i/8) as V,seed:e*9+i})));
const rand=(i:number)=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function StarSapphire({ formation, release, angle, paused, demonstrate }: {
  formation:number; release:number; angle:number; paused:boolean; demonstrate:boolean;
}){
  const ref=useRef<HTMLCanvasElement>(null),live=useRef({formation,release,angle,paused,demonstrate});
  live.current={formation,release,angle,paused,demonstrate};
  useEffect(()=>{
    const c=ref.current!,g=c.getContext('2d');if(!g)return;
    let frame=0,last=0,turn=0,time=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden||live.current.paused){last=now;return;}if(now-last<32)return;
      time+=Math.min(now-last,60);last=now;const p=live.current;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      turn+=(p.angle-turn)*(reduced?1:.12);
      const a=turn+(p.demonstrate&&!reduced?Math.sin(time*.0012)*.18:0),scale=Math.min(w*.3,h*.29);
      const project=(v:V)=>{const x=v[0]*Math.cos(a)-v[2]*Math.sin(a),z=v[0]*Math.sin(a)+v[2]*Math.cos(a),y=v[1]*.88-z*.48,depth=v[1]*.48+z*.88;return{x:w*.5+x*scale*(3/(3+depth)),y:h*.47-y*scale*(3/(3+depth)),z:depth};};
      const form=reduced?1:softStep(p.formation),exit=softStep(p.release);
      const halo=g.createRadialGradient(w*.5,h*.47,0,w*.5,h*.47,scale*1.5);halo.addColorStop(0,`rgba(255,179,222,${.035*form*(1-exit)})`);halo.addColorStop(1,'#ffb3de00');g.fillStyle=halo;g.fillRect(0,0,w,h);
      edges.forEach(([a,b])=>{const u=project(vertices[a]),v=project(vertices[b]);g.strokeStyle=`rgba(255,210,237,${.25*softStep((form-.45)/.55)*(1-exit)*(.65+(u.z+1)*.12)})`;g.lineWidth=.6;g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();});
      seeds.forEach(({v,seed},i)=>{
        const q=project(v),sx=rand(seed)*w,sy=rand(seed+500)*h;
        let x=sx+(q.x-sx)*form,y=sy+(q.y-sy)*form;
        if(!reduced){x+=(rand(seed+2300)*w-x)*exit;y+=(rand(seed+3400)*h-y)*exit;}
        g.globalAlpha=(.28+.48*(reduced?.7:Math.sin(seed+time*.0008)**2))*(1-exit);
        g.fillStyle=i%9===0?'#ffe4f5':'#bfcce9';g.beginPath();g.arc(x,y,i%9===0?1.4:.55,0,7);g.fill();
      });g.globalAlpha=1;
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={ref} className="star-sapphire-canvas" aria-hidden="true" />;
}
