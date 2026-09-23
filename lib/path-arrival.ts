import { softStep } from './motion.ts';
export type SkyPoint = { x: number; y: number };
export type SkyBox = { left: number; top: number; width: number; height: number };
export type SkyHandoff = { main: SkyPoint; companions: SkyPoint[]; orbit: number; kind?: 'wish' | 'return' };
export const PATH_ENTRY_MS = 3800;
export const PATH_ENTRY_REDUCED_MS = 480;
export const PATH_RETURN_MS = 900;
export const PATH_PLACES = { prism: { x:23,y:36 }, date: { x:76,y:24 }, sapphire: { x:62,y:69 } } as const;

export function inViewport(point: SkyPoint, box: SkyBox, width: number, height: number): SkyPoint {
  return { x:(box.left+point.x*box.width/100)/width, y:(box.top+point.y*box.height/100)/height };
}
export function inSky(point: SkyPoint, box: SkyBox, width: number, height: number): SkyPoint {
  return { x:(point.x*width-box.left)/box.width*100, y:(point.y*height-box.top)/box.height*100 };
}
export function wishOrbit(orbit: number, order: number, radius: number): SkyPoint {
  const angle=orbit+order*Math.PI*2/3;
  return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*.6};
}
const mix=(a:SkyPoint,b:SkyPoint,q:number):SkyPoint=>({x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q});
function arch(a:SkyPoint,b:SkyPoint,q:number,bend:number):SkyPoint {
  const p=mix(a,b,q);return {x:p.x+Math.sin(q*Math.PI)*bend,y:p.y-Math.sin(q*Math.PI)*Math.abs(bend)};
}
export function pathArrival(elapsed:number, reduced:boolean, start:SkyPoint, companionStarts:SkyPoint[], orbit:number, width:number,height:number, target:SkyPoint={x:26,y:78}) {
  const duration=reduced?PATH_ENTRY_REDUCED_MS:PATH_ENTRY_MS;
  const t=Math.max(0,elapsed), fly=softStep(t/(reduced?duration:1100));
  const main=reduced?mix(start,target,fly):arch(start,target,fly,1.8);
  const phase=orbit+(reduced?0:t*.0008);
  const companions=[0,1,2].map(i=>{
    const offset=wishOrbit(phase,i,15);
    const home={x:main.x+offset.x/width*100,y:main.y+offset.y/height*100};
    const begin=companionStarts[i]??home;
    if(reduced)return mix(begin,home,fly);
    if(i===2)return mix(begin,home,softStep(t/650));
    const delay=i===0?320:650,at=i===0?{x:23,y:36-10}:{x:76,y:24-7};
    const outgoing=softStep((t-delay)/1100),back=softStep((t-2700)/1100);
    if(back>0)return arch(at,home,back,i===0?-8:8);
    return arch(begin,at,outgoing,i===0?-6:8);
  });
  return { main,companions,phase,
    prism:softStep((t-(reduced?0:1100))/(reduced?duration:1600)),
    date:softStep((t-(reduced?0:1400))/(reduced?duration:1500)),
    route:softStep((t-(reduced?0:450))/(reduced?duration:2400)),
    labels:softStep((t-(reduced?0:2850))/(reduced?duration:800)),
    done:t>=duration };
}

export function pathReturn(elapsed:number,reduced:boolean,start:SkyPoint,companionStarts:SkyPoint[],orbit:number,width:number,height:number,target:SkyPoint) {
  const duration=reduced?PATH_ENTRY_REDUCED_MS:PATH_RETURN_MS;
  const t=Math.max(0,elapsed),q=softStep(t/duration),main=mix(start,target,q);
  const phase=orbit+(reduced?0:t*.0008);
  const companions=[0,1,2].map(i=>{
    const offset=wishOrbit(phase,i,15),home={x:main.x+offset.x/width*100,y:main.y+offset.y/height*100};
    return mix(companionStarts[i]??home,home,q);
  });
  const reveal=softStep(t/(reduced?duration:650));
  return {main,companions,phase,prism:reveal,date:reveal,route:reveal,labels:reveal,done:t>=duration};
}
