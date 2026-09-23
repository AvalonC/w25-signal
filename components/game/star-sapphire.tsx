'use client';
// A canvas RAF reads live gesture values without re-creating the renderer.
/* oxlint-disable react/react-compiler */
import { useEffect, useRef } from 'react';
import { softStep } from '@/lib/motion';
import { SAPPHIRE_DISCOVERIES, sapphireAlignment } from '@/lib/sapphire-discovery';
import {drawLibraDiscovery} from '@/lib/libra-drawing';
import {gemstoneOutline,projectSapphire,SAPPHIRE_VERTICES as vertices,SAPPHIRE_EDGES as edges,SAPPHIRE_FACES as faces,type GemVertex as V} from '@/lib/sapphire-shape';
type DiscoverySight = { target: number; found: number; strength: number; dwell: number; exit: boolean };
const seeds=edges.flatMap(([a,b],e)=>Array.from({length:9},(_,i)=>({v:vertices[a].map((v,k)=>v+(vertices[b][k]-v)*i/8) as V,seed:e*9+i})));
const rand=(i:number)=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function StarSapphire({ formation, release, angle, paused, demonstrate, origin = 'stars', light = 0, dust = 1, tint = 1, libra = false, infusion = 0, radiance = 0, discovery, guide }: {
  formation:number; release:number; angle:number; paused:boolean; demonstrate:boolean;
  origin?:'light'|'stars'|'nebula'; light?:number; dust?:number; tint?:number; libra?:boolean;
  infusion?:number; radiance?:number; discovery?:DiscoverySight; guide?:{active:boolean;near:boolean};
}){
  const ref=useRef<HTMLCanvasElement>(null),live=useRef({formation,release,angle,paused,demonstrate,origin,light,dust,tint,libra,infusion,radiance,discovery,guide});
  live.current={formation,release,angle,paused,demonstrate,origin,light,dust,tint,libra,infusion,radiance,discovery,guide};
  useEffect(()=>{
    const c=ref.current!,g=c.getContext('2d');if(!g)return;
    let frame=0,last=0,turn=live.current.angle,time=0,shade=live.current.tint,libraFade=live.current.libra?1:0,guideFade=0;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let reduced=motion.matches;
    const updateMotion=()=>{reduced=motion.matches;};motion.addEventListener('change',updateMotion);
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);if(document.hidden||live.current.paused){last=now;return;}if(now-last<32)return;
      time+=Math.min(now-last,60);last=now;const p=live.current;
      const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
      g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
      turn+=(p.angle-turn)*(reduced?1:.12);
      shade+=(p.tint-shade)*(reduced?1:.045);libraFade+=((p.libra?1:0)-libraFade)*.06;
      guideFade+=((p.guide?.active?(p.guide.near?1:.42):0)-guideFade)*.12;
      const rgb=[Math.round(205+50*shade),Math.round(223-44*shade),Math.round(255-33*shade)].join(',');
      const a=turn+(p.demonstrate&&!reduced?Math.sin(time*.0012)*.18:0),scale=Math.min(w*.3,h*.29);
      const project=(v:V)=>projectSapphire(v,a,w,h);
      const form=reduced?(p.formation>0?1:0):softStep(p.formation),exit=softStep(p.release);
      const resolved=softStep((form-.38)/.62)*(1-exit);
      const alignment=p.discovery?softStep(sapphireAlignment(a,p.discovery.target).strength):0;
      const libraFocus=p.discovery?.target===1?alignment:0;
      const shapeOpacity=1-libraFocus*.68;
      const projected=vertices.map(project),outline=gemstoneOutline(projected);
      const polygon=(points:{x:number;y:number}[])=>{g.beginPath();points.forEach((v,i)=>{if(i)g.lineTo(v.x,v.y);else g.moveTo(v.x,v.y);});g.closePath();};
      // The real gift's four-point cradle appears behind a round faceted stone.
      // It is a visual clue, never another instruction to read.
      if(p.discovery?.target===0){
        const cradle:V[]=Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4,r=i%2?.64:1.25;return[Math.cos(angle)*r,-.13,Math.sin(angle)*r] as V;});
        polygon(cradle.map(project));g.lineWidth=1.1;g.strokeStyle=`rgba(224,231,247,${(.12+alignment*.4)*resolved})`;g.stroke();
        g.fillStyle=`rgba(190,204,234,${(.015+alignment*.035)*resolved})`;g.fill();
        const expected=gemstoneOutline(vertices.map(v=>projectSapphire(v,SAPPHIRE_DISCOVERIES[0].angle,w,h)));
        g.setLineDash([2,5]);g.lineWidth=.8;g.strokeStyle=`rgba(207,225,246,${.24*(1-alignment)*resolved})`;polygon(expected);g.stroke();g.setLineDash([]);
      }
      // Depth-sorted facets and a stronger outside contour make the stone read
      // as one volume instead of equally bright intersecting front/back edges.
      faces.map(indices=>({points:indices.map(i=>projected[i]),depth:indices.reduce((n,i)=>n+projected[i].z,0)/indices.length}))
        .sort((left,right)=>right.depth-left.depth).forEach((face,i)=>{
          const facing=Math.max(0,Math.min(1,(.5-face.depth)*.7));
          const facet=(.018+facing*.10+(i%3)*.008)*resolved*shapeOpacity;
          const colour=shade>.45?i%2?'239,155,203':'255,208,234':i%2?'150,184,232':'208,229,255';
          g.fillStyle=`rgba(${colour},${facet})`;polygon(face.points);g.fill();
        });
      g.strokeStyle=`rgba(${rgb},${.78*resolved*shapeOpacity})`;g.lineWidth=1.25;polygon(outline);g.stroke();
      g.strokeStyle=`rgba(239,230,246,${.46*resolved*shapeOpacity})`;g.lineWidth=1;polygon(projected.slice(0,8));g.stroke();
      if(!p.guide&&p.infusion===0){
        const halo=g.createRadialGradient(w*.5,h*.47,0,w*.5,h*.47,scale*1.5);halo.addColorStop(0,`rgba(${rgb},${(.025+shade*.04)*form*(1-exit)})`);halo.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=halo;g.fillRect(0,0,w,h);
      }
      // Light enters the flat crown, then travels through actual shoulder and
      // pavilion faces. Every wash is clipped by a facet instead of a glow disc.
      if(p.infusion>0||guideFade>.005){
        const crown:V=[0,.4,0],entry=project(crown),bloom=reduced?0:p.radiance;
        const quiet=reduced?1:.86+Math.sin(time*.0013)*.14;
        const fillFace=(face:V[],delay:number,strength:number,guideAmount=0)=>{
          const points=face.map(project),show=softStep((p.infusion-delay)/.5);
          const alpha=(show*strength+guideAmount)*form*(1-exit)*shapeOpacity;
          if(alpha<.001)return;
          const bottom=points.reduce((lowest,point)=>point.y>lowest.y?point:lowest,entry);
          const wash=g.createLinearGradient(entry.x,entry.y,entry.x,Math.max(entry.y+scale*.18,bottom.y));
          wash.addColorStop(0,`rgba(255,225,243,${alpha})`);
          wash.addColorStop(.5,`rgba(255,182,220,${alpha*.68})`);
          wash.addColorStop(1,`rgba(234,146,210,${alpha*.24})`);
          g.fillStyle=wash;g.beginPath();g.moveTo(points[0].x,points[0].y);
          for(const point of points.slice(1))g.lineTo(point.x,point.y);
          g.closePath();g.fill();
        };
        for(let i=0;i<8;i++){
          const next=(i+1)%8,offset=(i%3)*.018;
          fillFace([crown,vertices[i],vertices[next]],offset,.045+bloom*.045,guideFade*quiet*(i%2?.065:.09));
          fillFace([vertices[i],vertices[8+i],vertices[8+next]],.13+offset,.04+bloom*.05);
          fillFace([vertices[i],vertices[8+next],vertices[next]],.18+offset,.03+bloom*.038);
          fillFace([vertices[8+i],vertices[16],vertices[8+next]],.37+offset,.026+bloom*.04);
        }
        if(guideFade>.005){
          g.strokeStyle=`rgba(255,226,243,${guideFade*quiet*.45*(1-exit)})`;g.lineWidth=.9;
          g.beginPath();
          const crownPoints=vertices.slice(0,8).map(project);
          crownPoints.forEach((point,i)=>{if(i)g.lineTo(point.x,point.y);else g.moveTo(point.x,point.y);});
          g.closePath();g.stroke();
        }
      }
      if(p.origin==='light'){
        const gather=softStep(p.light),scatter=softStep(p.dust),cx=w*.5,cy=h*.47;
        if(scatter<.01 && gather>0 && !reduced){
          for(const side of [-1,1]){
            const sx=cx+side*w*.26,sy=cy+side*25;
            const ray=g.createLinearGradient(sx,sy,cx,cy);ray.addColorStop(0,`rgba(${rgb},0)`);ray.addColorStop(1,`rgba(${rgb},.9)`);
            g.strokeStyle=ray;g.globalAlpha=Math.sin(gather*Math.PI)*.55;g.lineWidth=.8;
            g.beginPath();g.moveTo(sx,sy);g.quadraticCurveTo(cx,cy-60*side,cx,cy);g.stroke();
          }g.globalAlpha=1;
        }
        const energy=gather*(1-scatter);
        const bloom=g.createRadialGradient(cx,cy,0,cx,cy,scale*(.28+energy*.55));
        bloom.addColorStop(0,`rgba(${rgb},${energy*.85})`);bloom.addColorStop(.16,`rgba(${rgb},${energy*.28})`);bloom.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=bloom;g.fillRect(0,0,w,h);
      }
      edges.forEach(([a,b],index)=>{const u=projected[a],v=projected[b];const glint=Math.max(0,Math.cos(turn*1.7+index*.8))**12;
        const front=(u.z+v.z)/2<0;
        g.strokeStyle=`rgba(${rgb},${(front?.25:.055)+glint*.16*shapeOpacity})`;
        g.globalAlpha=resolved*shapeOpacity;g.lineWidth=front?.85:.5;g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();});g.globalAlpha=1;
      if(p.infusion>0 && p.infusion<1 && !reduced){
        edges.forEach(([a,b],index)=>{
          const delay=a<8&&b<8?0:a===16||b===16?.39:a<8||b<8?.15:.27;
          const at=softStep((p.infusion-delay-(index%3)*.018)/.5);if(at<=0||at>=1)return;
          const one=project(vertices[a]),two=project(vertices[b]);
          const u=one.y<=two.y?one:two,v=one.y<=two.y?two:one;
          const tail=Math.max(0,at-.24),start={x:u.x+(v.x-u.x)*tail,y:u.y+(v.y-u.y)*tail};
          const head={x:u.x+(v.x-u.x)*at,y:u.y+(v.y-u.y)*at};
          const strength=Math.sin(at*Math.PI)*.48*(1-exit);
          const stream=g.createLinearGradient(start.x,start.y,head.x,head.y);
          stream.addColorStop(0,'rgba(255,192,226,0)');stream.addColorStop(1,`rgba(255,231,245,${strength})`);
          g.strokeStyle=stream;g.lineWidth=.95;
          g.beginPath();g.moveTo(start.x,start.y);g.lineTo(head.x,head.y);g.stroke();
          g.fillStyle=`rgba(255,238,248,${strength})`;g.beginPath();g.arc(head.x,head.y,.9,0,7);g.fill();
        });
      }
      if(p.discovery){
        const sight=p.discovery,cx=w*.5,cy=h*.47;
        const close=sight.exit?1:softStep(sapphireAlignment(a,sight.target).strength);
        g.globalAlpha=(1-exit)*form;
        // Actual projected facets brighten as their broad face meets the light.
        if(sight.target===0 || sight.found>=0){
          const facing=sight.target===0?close:.22;
          for(const index of [0,1,7]){
            const points=[project(vertices[index]),project(vertices[8+index]),project(vertices[8+(index+1)%8])];
            g.fillStyle=`rgba(225,238,255,${facing*(.06+sight.dwell*.05)})`;
            g.strokeStyle=`rgba(237,246,255,${facing*.7})`;g.lineWidth=.7+facing*.5;
            g.beginPath();g.moveTo(points[0].x,points[0].y);g.lineTo(points[1].x,points[1].y);
            g.lineTo(points[2].x,points[2].y);g.closePath();g.fill();g.stroke();
          }
        }
        // The faint sky chart stays fixed; its reflection turns with the stone.
        // Both charts coincide only at the Libra orientation.
        if(sight.target===1 || sight.found>=1){
          drawLibraDiscovery(g,{cx,cy,scale,angle:a,targetAngle:SAPPHIRE_DISCOVERIES[1].angle,
            alignment:close,found:sight.found>=1,time,reduced,opacity:(1-exit)*form});
          if(sight.target===1 && close>.65){g.fillStyle=`rgba(247,224,241,${(close-.65)*2})`;
            g.font='12px Georgia';g.textAlign='center';g.fillText('10 · 08',cx,cy+scale*1.36);}
        }
        if(sight.target===2){
          const endX=w*.84,endY=h*.30;
          const source={x:w*.13,y:h*.64};
          const bend=project(vertices[9]);
          const light=g.createLinearGradient(source.x,source.y,endX,endY);
          light.addColorStop(0,'#ffb3de00');light.addColorStop(.36,`rgba(255,179,222,${.15+close*.4})`);
          light.addColorStop(.64,`rgba(255,223,241,${close*.8})`);light.addColorStop(1,`rgba(255,198,231,${close*.85})`);
          g.strokeStyle=light;g.lineWidth=.65+close*1.15;
          g.beginPath();g.moveTo(source.x,source.y);g.lineTo(bend.x,bend.y);
          g.lineTo(cx,cy);g.lineTo(endX,endY+(1-close)*h*.18);g.stroke();
          if(close>.2){
            const glow=g.createRadialGradient(endX,endY,0,endX,endY,14+close*16);
            glow.addColorStop(0,`rgba(255,226,242,${close*.52})`);glow.addColorStop(.25,`rgba(255,179,222,${close*.1})`);
            glow.addColorStop(1,'#ffb3de00');g.fillStyle=glow;g.fillRect(endX-32,endY-32,64,64);
          }
          if(!reduced && close>.4){
            const step=(time%3200)/3200,x=cx+(endX-cx)*step,y=cy+(endY-cy)*step;
            g.fillStyle=`rgba(255,228,244,${close*Math.sin(step*Math.PI)*.8})`;
            g.beginPath();g.arc(x,y,1.6,0,7);g.fill();
          }
        }
        g.globalAlpha=1;
      }
      seeds.forEach(({v,seed},i)=>{
        const q=project(v),expansion=p.origin==='light'?softStep(p.dust):1;
        const nebulaAngle=(seed%3)*Math.PI*2/3+rand(seed+17)*4.5;
        const nebulaRadius=(.018+rand(seed+17)**.7*.2)*(1-form*.32);
        const sx=p.origin==='nebula'?w*(.5+Math.cos(nebulaAngle)*nebulaRadius):w*.5+(rand(seed)-.5)*w*.84*expansion;
        const sy=p.origin==='nebula'?h*.47+Math.sin(nebulaAngle)*nebulaRadius*w*.64:h*.47+(rand(seed+500)-.5)*h*.85*expansion;
        let x=sx+(q.x-sx)*form,y=sy+(q.y-sy)*form;
        if(!reduced){x+=(rand(seed+2300)*w-x)*exit;y+=(rand(seed+3400)*h-y)*exit;}
        g.globalAlpha=(.20+.38*(reduced?.7:Math.sin(seed+time*.0008)**2))*(1-exit)*shapeOpacity*(p.origin==='light'||p.origin==='nebula'?softStep(p.dust):1);
        g.fillStyle=i%9===0?'#f1eeff':`rgb(${rgb})`;g.beginPath();g.arc(x,y,i%9===0?1.4:.55,0,7);g.fill();
      });g.globalAlpha=1;
      if(libraFade>.01){
        g.globalAlpha=libraFade*(1-exit)*(1-libraFocus*.6);g.strokeStyle='#c8d5ef40';g.lineWidth=.65;
        g.beginPath();g.ellipse(w*.5,h*.47,scale*1.36,scale*.69,-.17,0,Math.PI*2);g.stroke();
        g.fillStyle='#dce4f4';g.font='22px Georgia';g.textAlign='center';g.fillText('♎\uFE0E',w*.5+scale*1.13,h*.47-scale*.57);
        g.font='11px Georgia';g.fillStyle='#b9c7e0';g.fillText('X · VIII',w*.5-scale*.98,h*.47+scale*.63);g.globalAlpha=1;
      }
    };frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);motion.removeEventListener('change',updateMotion);};
  },[]);
  return <canvas ref={ref} className="star-sapphire-canvas" aria-hidden="true" />;
}
