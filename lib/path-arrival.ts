import { softStep } from './motion.ts';
export type SkyPoint = { x: number; y: number };
export type SkyBox = { left: number; top: number; width: number; height: number };
export type SkyHandoff = { main: SkyPoint; companions: SkyPoint[]; orbit: number; kind?: 'wish' | 'return' };
export const PATH_ENTRY_MS = 2600;
export const WISH_ORBIT_RADIUS = 30;
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
/** The light stays where the wishes gathered. Only the places ahead are born. */
export function pathArrival(elapsed:number, reduced:boolean, start:SkyPoint, companionStarts:SkyPoint[], orbit:number, width:number,height:number) {
  const duration=reduced?PATH_ENTRY_REDUCED_MS:PATH_ENTRY_MS;
  const t=Math.max(0,elapsed),turn=reduced?0:t*.0008,phase=orbit+turn;
  const w=Math.max(1,width),h=Math.max(1,height);
  const companions=[0,1,2].map(i=>{
    const offset=wishOrbit(orbit,i,WISH_ORBIT_RADIUS);
    const begin=companionStarts[i]??{x:start.x+offset.x/w*100,y:start.y+offset.y/h*100};
    if(!turn)return {...begin};
    // Rotate the received orbit in screen pixels, preserving its radius and phase.
    const dx=(begin.x-start.x)*w/100,dy=(begin.y-start.y)*h/100/.6;
    return {x:start.x+(dx*Math.cos(turn)-dy*Math.sin(turn))/w*100,
      y:start.y+(dx*Math.sin(turn)+dy*Math.cos(turn))*.6/h*100};
  });
  return {main:{...start},companions,phase,
    prism:softStep((t-(reduced?0:160))/(reduced?duration:1700)),
    date:softStep((t-(reduced?0:400))/(reduced?duration:1740)),
    route:softStep((t-(reduced?0:1350))/(reduced?duration:1050)),
    labels:softStep((t-(reduced?0:2100))/(reduced?duration:500)),
    done:t>=duration};
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
