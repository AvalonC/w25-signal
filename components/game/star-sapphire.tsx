'use client';
// A canvas RAF reads live gesture values without re-creating the renderer.
/* oxlint-disable react/react-compiler */
import { useEffect, useRef } from 'react';
import { softStep } from '@/lib/motion';
import { SAPPHIRE_DISCOVERIES, sapphireAlignment } from '@/lib/sapphire-discovery';
type V = [number,number,number];
type DiscoverySight = { target: number; found: number; strength: number; dwell: number; exit: boolean };
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
      const project=(v:V)=>{const x=v[0]*Math.cos(a)-v[2]*Math.sin(a),z=v[0]*Math.sin(a)+v[2]*Math.cos(a),y=v[1]*.88-z*.48,depth=v[1]*.48+z*.88;return{x:w*.5+x*scale*(3/(3+depth)),y:h*.47-y*scale*(3/(3+depth)),z:depth};};
      const form=reduced?(p.formation>0?1:0):softStep(p.formation),exit=softStep(p.release);
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
          const alpha=(show*strength+guideAmount)*form*(1-exit);
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
      edges.forEach(([a,b],index)=>{const u=project(vertices[a]),v=project(vertices[b]);const glint=Math.max(0,Math.cos(turn*1.7+index*.8))**12;g.strokeStyle=`rgba(${rgb},${(.18+glint*.32)*softStep((form-.45)/.55)*(1-exit)*(.65+(u.z+1)*.12)})`;g.lineWidth=.6+glint*.3;g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();});
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
          const chart=[[-.74,.04],[0,-.68],[.74,.04],[-.96,.48],[-.52,.48],[.52,.48],[.96,.48],[0,.3]];
          const links=[[0,1],[1,2],[0,3],[0,4],[3,4],[2,5],[2,6],[5,6],[1,7]];
          const offset=sight.found>=1?0:a-SAPPHIRE_DISCOVERIES[1].angle;
          const map=(point:number[],rotation:number)=>({x:cx+(point[0]*Math.cos(rotation)-point[1]*Math.sin(rotation))*scale*.9,
            y:cy+(point[0]*Math.sin(rotation)+point[1]*Math.cos(rotation))*scale*.9});
          const paintChart=(rotation:number,alpha:number,colour:string,dashed:boolean)=>{
            g.strokeStyle=`rgba(${colour},${alpha})`;g.fillStyle=`rgba(${colour},${Math.min(1,alpha*1.8)})`;
            g.lineWidth=dashed?.6:1;g.setLineDash(dashed?[2,5]:[]);
            for(const [from,to] of links){const u=map(chart[from],rotation),v=map(chart[to],rotation);
              g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();}
            g.setLineDash([]);
            chart.forEach((point,index)=>{const q=map(point,rotation);g.beginPath();g.arc(q.x,q.y,index===1?2.4:1.6,0,7);g.fill();});
          };
          paintChart(0,sight.found>=1?.12:.2,'194,211,244',true);
          paintChart(offset,sight.found>=1?.26:.16+close*.64,'249,221,239',false);
          if(sight.target===1 && close>.65){g.fillStyle=`rgba(247,224,241,${(close-.65)*2})`;
            g.font='12px Georgia';g.textAlign='center';g.fillText('10 · 08',cx,cy+scale*.75);}
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
        g.globalAlpha=(.28+.48*(reduced?.7:Math.sin(seed+time*.0008)**2))*(1-exit)*(p.origin==='light'||p.origin==='nebula'?softStep(p.dust):1);
        g.fillStyle=i%9===0?'#f1eeff':`rgb(${rgb})`;g.beginPath();g.arc(x,y,i%9===0?1.4:.55,0,7);g.fill();
      });g.globalAlpha=1;
      if(libraFade>.01){
        g.globalAlpha=libraFade*(1-exit);g.strokeStyle='#c8d5ef40';g.lineWidth=.65;
        g.beginPath();g.ellipse(w*.5,h*.47,scale*1.36,scale*.69,-.17,0,Math.PI*2);g.stroke();
        g.fillStyle='#dce4f4';g.font='22px Georgia';g.textAlign='center';g.fillText('♎\uFE0E',w*.5+scale*1.13,h*.47-scale*.57);
        g.font='11px Georgia';g.fillStyle='#b9c7e0';g.fillText('X · VIII',w*.5-scale*.98,h*.47+scale*.63);g.globalAlpha=1;
      }
    };frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);motion.removeEventListener('change',updateMotion);};
  },[]);
  return <canvas ref={ref} className="star-sapphire-canvas" aria-hidden="true" />;
}
