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
export function StarSapphire({ formation, release, angle, paused, demonstrate, origin = 'stars', light = 0, dust = 1, tint = 1, libra = false }: {
  formation:number; release:number; angle:number; paused:boolean; demonstrate:boolean;
  origin?:'light'|'stars'; light?:number; dust?:number; tint?:number; libra?:boolean;
}){
  const ref=useRef<HTMLCanvasElement>(null),live=useRef({formation,release,angle,paused,demonstrate,origin,light,dust,tint,libra});
  live.current={formation,release,angle,paused,demonstrate,origin,light,dust,tint,libra};
  useEffect(()=>{
    const c=ref.current!,g=c.getContext('2d');if(!g)return;
    let frame=0,last=0,turn=0,time=0,shade=0,libraFade=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden||live.current.paused){last=now;return;}if(now-last<32)return;
      time+=Math.min(now-last,60);last=now;const p=live.current;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      turn+=(p.angle-turn)*(reduced?1:.12);
      shade+=(p.tint-shade)*(reduced?1:.045);libraFade+=((p.libra?1:0)-libraFade)*.06;
      const rgb=[Math.round(205+50*shade),Math.round(223-44*shade),Math.round(255-33*shade)].join(',');
      const a=turn+(p.demonstrate&&!reduced?Math.sin(time*.0012)*.18:0),scale=Math.min(w*.3,h*.29);
      const project=(v:V)=>{const x=v[0]*Math.cos(a)-v[2]*Math.sin(a),z=v[0]*Math.sin(a)+v[2]*Math.cos(a),y=v[1]*.88-z*.48,depth=v[1]*.48+z*.88;return{x:w*.5+x*scale*(3/(3+depth)),y:h*.47-y*scale*(3/(3+depth)),z:depth};};
      const form=reduced?(p.formation>0?1:0):softStep(p.formation),exit=softStep(p.release);
      const halo=g.createRadialGradient(w*.5,h*.47,0,w*.5,h*.47,scale*1.5);halo.addColorStop(0,`rgba(${rgb},${(.025+shade*.04)*form*(1-exit)})`);halo.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=halo;g.fillRect(0,0,w,h);
      if(p.origin==='light'){
        const gather=softStep(p.light),scatter=softStep(p.dust),cx=w*.5,cy=h*.47;
        if(scatter<.01 && gather>0 && !reduced){
          for(const side of [-1,1]){
            const sx=cx+side*w*.26,sy=cy+side*25;
            const ray=g.createLinearGradient(sx,sy,cx,cy);ray.addColorStop(0,'#d6e5ff00');ray.addColorStop(1,'#e4ecffb0');
            g.strokeStyle=ray;g.globalAlpha=Math.sin(gather*Math.PI)*.55;g.lineWidth=.8;
            g.beginPath();g.moveTo(sx,sy);g.quadraticCurveTo(cx,cy-60*side,cx,cy);g.stroke();
          }g.globalAlpha=1;
        }
        const energy=gather*(1-scatter);
        const bloom=g.createRadialGradient(cx,cy,0,cx,cy,scale*(.28+energy*.55));
        bloom.addColorStop(0,`rgba(242,244,255,${energy*.7})`);bloom.addColorStop(.16,`rgba(204,220,255,${energy*.15})`);bloom.addColorStop(1,'#dce8ff00');g.fillStyle=bloom;g.fillRect(0,0,w,h);
      }
      edges.forEach(([a,b],index)=>{const u=project(vertices[a]),v=project(vertices[b]);const glint=Math.max(0,Math.cos(turn*1.7+index*.8))**12;g.strokeStyle=`rgba(${rgb},${(.18+glint*.32)*softStep((form-.45)/.55)*(1-exit)*(.65+(u.z+1)*.12)})`;g.lineWidth=.6+glint*.3;g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();});
      seeds.forEach(({v,seed},i)=>{
        const q=project(v),expansion=p.origin==='light'?softStep(p.dust):1;
        const sx=w*.5+(rand(seed)-.5)*w*.84*expansion,sy=h*.47+(rand(seed+500)-.5)*h*.85*expansion;
        let x=sx+(q.x-sx)*form,y=sy+(q.y-sy)*form;
        if(!reduced){x+=(rand(seed+2300)*w-x)*exit;y+=(rand(seed+3400)*h-y)*exit;}
        g.globalAlpha=(.28+.48*(reduced?.7:Math.sin(seed+time*.0008)**2))*(1-exit)*(p.origin==='light'?softStep(p.dust):1);
        g.fillStyle=i%9===0?'#f1eeff':`rgb(${rgb})`;g.beginPath();g.arc(x,y,i%9===0?1.4:.55,0,7);g.fill();
      });g.globalAlpha=1;
      if(libraFade>.01){
        g.globalAlpha=libraFade*(1-exit);g.strokeStyle='#c8d5ef40';g.lineWidth=.65;
        g.beginPath();g.ellipse(w*.5,h*.47,scale*1.36,scale*.69,-.17,0,Math.PI*2);g.stroke();
        g.fillStyle='#dce4f4';g.font='22px Georgia';g.textAlign='center';g.fillText('♎',w*.5+scale*1.13,h*.47-scale*.57);
        g.font='11px Georgia';g.fillStyle='#b9c7e0';g.fillText('X · VIII',w*.5-scale*.98,h*.47+scale*.63);g.globalAlpha=1;
      }
    };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={ref} className="star-sapphire-canvas" aria-hidden="true" />;
}
