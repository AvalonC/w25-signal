'use client';
import { softStep } from '@/lib/motion';

type Destination = 'prism' | 'date' | 'sapphire';
const trace=(progress:number)=>({pathLength:1,strokeDasharray:1,strokeDashoffset:1-progress});

/** A visiting wish traces the object before it becomes a place to explore. */
export function DestinationDrawing({place,progress=1}:{place:Destination;progress?:number}) {
  const p=Math.max(0,Math.min(1,progress));
  if(place==='prism') {
    const gather=softStep(p/.46),edge=softStep((p-.15)/.55),facets=softStep((p-.42)/.45),rays=softStep((p-.62)/.38);
    return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
      <path className="path-prism-face" d="M22 74 49 18 78 69 60 84Z" fillOpacity={facets*.055} {...trace(edge)}/>
      <path d="M49 18 60 84 22 74M60 84 78 69" {...trace(facets)}/>
      {[[22,74,-24,15],[49,18,4,-25],[78,69,28,12]].map(([x,y,dx,dy],i)=><circle key={i} className="path-forming-point" cx={x+dx*(1-gather)} cy={y+dy*(1-gather)} r={.8+1.25*Math.sin(p*Math.PI)} opacity={softStep(p/.12)} />)}
      <path className="path-prism-input" d="M4 43 41 45" {...trace(rays)}/>
      <path className="path-prism-ray path-prism-ray-rose" d="M59 47 95 35" {...trace(rays)}/>
      <path className="path-prism-ray path-prism-ray-pearl" d="M61 52 97 55" {...trace(softStep((rays-.1)/.9))}/>
      <path className="path-prism-ray path-prism-ray-ice" d="M64 59 96 76" {...trace(softStep((rays-.22)/.78))}/>
    </svg>;
  }
  if(place==='date') {
    const outer=softStep(p/.65),inner=softStep((p-.2)/.7),needle=softStep((p-.6)/.4);
    return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
      <g transform={`translate(50 50) rotate(${-62*(1-outer)}) scale(${.68+.32*outer}) translate(-50 -50)`}>
        <g className={p===1?'path-date-outer':undefined}>
          <circle cx="50" cy="50" r="36" {...trace(outer)}/>
          {Array.from({length:12},(_,i)=>{
            const tick=softStep((p-.12-i*.018)/.48),a=i*Math.PI/6,r=36+(1-tick)*16;
            return <path key={i} opacity={tick} d={`M${50+Math.sin(a)*r} ${50-Math.cos(a)*r}L${50+Math.sin(a)*(r-5)} ${50-Math.cos(a)*(r-5)}`}/>;
          })}
          <path className="path-date-mark" opacity={inner} d="M50 12 52 14 50 16 48 14ZM84 48 86 50 84 52 82 50Z"/>
        </g>
      </g>
      <g transform={`translate(50 50) rotate(${85*(1-inner)}) scale(${.65+.35*inner}) translate(-50 -50)`}>
        <g className={p===1?'path-date-inner':undefined}>
          <circle cx="50" cy="50" r="24" {...trace(inner)}/>
          <path opacity={inner} d="M50 23V28M77 50H72M50 77V72M23 50H28"/>
          <circle className="path-date-satellite" cx="50" cy="26" r="1.8" opacity={inner}/>
        </g>
      </g>
      <g opacity={needle} transform={`translate(50 50) rotate(${-110*(1-needle)}) scale(${.3+.7*needle}) translate(-50 -50)`}>
        <path className={p===1?'path-date-needle':undefined} d="M37 51 48 49 62 33 55 55 43 63Z"/>
        <circle className="path-forming-point" cx="50" cy="50" r="2"/>
      </g>
    </svg>;
  }
  return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M31 24 68 24 84 46 51 85 16 46 31 24ZM16 46H84M31 24 38 46 51 85 63 46 68 24M31 24 63 46M68 24 38 46" {...trace(p)}/>
    <g opacity={p}><circle cx="31" cy="24" r="1.8"/><circle cx="68" cy="24" r="1.8"/><circle cx="51" cy="85" r="1.8"/></g>
  </svg>;
}
