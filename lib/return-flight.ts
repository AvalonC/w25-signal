import { softStep } from './motion.ts';
import type { SkyPoint } from './path-arrival.ts';

export const RETURN_FLIGHT_MS = 2300;
export const RETURN_FLIGHT_REDUCED_MS = 420;
export function returnFlight(elapsed:number,reduced=false) {
  const q=Math.max(0,Math.min(1,elapsed/(reduced?RETURN_FLIGHT_REDUCED_MS:RETURN_FLIGHT_MS)));
  return {
    camera:softStep(q/.92),star:softStep((q-.08)/.84),
    map:softStep((q-.08)/.82),labels:softStep((q-.6)/.4),
    closeOpacity:1-softStep((q-.64)/.36),copyOpacity:1-softStep(q/.4),done:q>=1,
  };
}
export function tracePoint(from:SkyPoint,to:SkyPoint,progress:number):SkyPoint {
  const q=Math.max(0,Math.min(1,progress)),u=1-q;
  const bend=Math.min(.025,Math.abs(to.y-from.y)*.2);
  const c1={x:from.x+(to.x-from.x)*.22+bend,y:from.y+(to.y-from.y)*.3};
  const c2={x:from.x+(to.x-from.x)*.78+bend,y:from.y+(to.y-from.y)*.78};
  return {x:u*u*u*from.x+3*u*u*q*c1.x+3*u*q*q*c2.x+q*q*q*to.x,
    y:u*u*u*from.y+3*u*u*q*c1.y+3*u*q*q*c2.y+q*q*q*to.y};
}
export function lightRoad(elapsed:number,reduced=false) {
  const duration=reduced?300:2200;
  return {trace:softStep(elapsed/duration),destination:softStep((elapsed-duration*.55)/(duration*.45)),
    verse:softStep((elapsed-duration*.65)/(duration*.45))};
}
/** The next road leaves beside the prism instead of crossing through its face. */
export function onwardPoint(from:SkyPoint,to:SkyPoint,progress:number):SkyPoint {
  const q=Math.max(0,Math.min(1,progress)),u=1-q,direction=Math.sign(to.x-from.x)||1;
  const c1={x:Math.max(.08,Math.min(.92,from.x+.3*direction)),y:from.y};
  const c2={x:Math.max(.08,Math.min(.92,to.x+.08*direction)),y:to.y+Math.sign(from.y-to.y)*.22};
  return {x:u*u*u*from.x+3*u*u*q*c1.x+3*u*q*q*c2.x+q*q*q*to.x,
    y:u*u*u*from.y+3*u*u*q*c1.y+3*u*q*q*c2.y+q*q*q*to.y};
}
