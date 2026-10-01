'use client';
import { softStep } from '@/lib/motion';
import { gemstoneOutline, projectSapphire, SAPPHIRE_VERTICES, SAPPHIRE_EDGES, SAPPHIRE_FACES, type GemVertex } from '@/lib/sapphire-shape';

type Destination = 'prism' | 'date' | 'sapphire';
type Point = readonly [number, number];
const visible = (progress: number) => progress > 0 ? 'visible' as const : 'hidden' as const;
const trace = (progress: number) => ({pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - progress, visibility: visible(progress)});
const mix = (from: Point, to: Point, progress: number): Point => [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
const point = ([x, y]: Point) => `${x} ${y}`;
const polygon = (...points: Point[]) => `M${points.map(point).join(' ')}Z`;

function ringArc(radius: number, progress: number, clockwise: boolean) {
  const sweep = clockwise ? 1 : 0;
  if (progress >= 1) return `M50 ${50-radius}A${radius} ${radius} 0 1 ${sweep} 50 ${50+radius}A${radius} ${radius} 0 1 ${sweep} 50 ${50-radius}`;
  const angle = progress * Math.PI * 2 * (clockwise ? 1 : -1);
  return `M50 ${50-radius}A${radius} ${radius} 0 ${progress > .5 ? 1 : 0} ${sweep} ${50+Math.sin(angle)*radius} ${50-Math.cos(angle)*radius}`;
}

/** Each destination builds itself in place; the shared scene clock owns every unfolding edge. */
export function DestinationDrawing({place, progress = 1, reduced = false}: {place: Destination; progress?: number; reduced?: boolean}) {
  const p = Math.max(0, Math.min(1, progress));
  if (place === 'prism') {
    const axis = softStep(p / .28), left = softStep((p-.12) / .58), right = softStep((p-.23) / .58);
    const edge = softStep((p-.14) / .69), rays = softStep((p-.76) / .24);
    const top: Point = [49, 18], foot: Point = [60, 84], center = mix(top, foot, .5);
    const a = mix(center, top, reduced ? 1 : axis), b = mix(center, foot, reduced ? 1 : axis);
    // The two faces hinge on the same ridge, never travel in as detached stars.
    const c = mix(mix(a, b, .79), [22, 74], reduced ? 1 : left);
    const d = mix(mix(a, b, .72), [78, 69], reduced ? 1 : right);
    return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
      <path className="path-prism-fold path-prism-fold-left" d={polygon(a, c, b)} fillOpacity={left*.055} visibility={visible(left)}/>
      <path className="path-prism-fold path-prism-fold-right" d={polygon(a, b, d)} fillOpacity={right*.035} visibility={visible(right)}/>
      <path className="path-prism-ridge" d={`M${point(a)} ${point(b)}`} {...trace(axis)}/>
      <path className="path-prism-outline" d={polygon(c, a, d, b)} {...trace(edge)}/>
      <path className="path-prism-input" d="M4 43 41 45" {...trace(rays)}/>
      <path className="path-prism-ray path-prism-ray-rose" d="M59 47 95 35" {...trace(softStep((p-.80)/.2))}/>
      <path className="path-prism-ray path-prism-ray-pearl" d="M61 52 97 55" {...trace(softStep((p-.84)/.16))}/>
      <path className="path-prism-ray path-prism-ray-ice" d="M64 59 96 76" {...trace(softStep((p-.88)/.12))}/>
    </svg>;
  }
  if (place === 'date') {
    const axis = softStep(p/.18) * (1-softStep((p-.42)/.34));
    const outer = softStep((p-.08)/.66), inner = softStep((p-.23)/.58), needle = softStep((p-.62)/.38);
    const marks = softStep((p-.52)/.28), cardinals = softStep((p-.54)/.29);
    const needlePoints: Point[] = [[37,51], [48,49], [62,33], [55,55], [43,63]];
    return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
      <path className="path-date-axis" d={`M50 ${50-24*axis}V${50+24*axis}`} visibility={visible(axis)}/>
      <g transform={`rotate(${reduced ? 0 : -18*(1-outer)} 50 50)`}>
        <g className={p===1?'path-date-outer':undefined}>
          <path className="path-date-ring path-date-ring-outer" d={ringArc(36,outer,true)} visibility={visible(outer)}/>
          {Array.from({length:12},(_,i)=>{
            const tick = softStep((p-.15-i*.047)/.18), a = i*Math.PI/6;
            const angle = a + (reduced ? 0 : (1-tick)*Math.PI*.38);
            const x = 50+Math.sin(a)*36, y = 50-Math.cos(a)*36;
            return <path key={i} className="path-date-tick" visibility={visible(tick)} d={`M${x} ${y}L${x-Math.sin(angle)*5*tick} ${y+Math.cos(angle)*5*tick}`}/>;
          })}
          <path className="path-date-mark" visibility={visible(marks)} d={`M50 ${14-2*marks} ${50+2*marks} 14 50 ${14+2*marks} ${50-2*marks} 14ZM84 ${50-2*marks} ${84+2*marks} 50 84 ${50+2*marks} ${84-2*marks} 50Z`}/>
        </g>
      </g>
      <g transform={`rotate(${reduced ? 0 : 22*(1-inner)} 50 50)`}>
        <g className={p===1?'path-date-inner':undefined}>
          <path className="path-date-ring path-date-ring-inner" d={ringArc(24,inner,false)} visibility={visible(inner)}/>
          <path className="path-date-cardinals" d="M50 23V28M77 50H72M50 77V72M23 50H28" {...trace(cardinals)}/>
          <circle className="path-date-satellite" cx="50" cy="26" r={1.8*cardinals} visibility={visible(cardinals)}/>
        </g>
      </g>
      <g transform={`rotate(${reduced ? 0 : -24*(1-needle)} 50 50)`} visibility={visible(needle)}>
        <path className={p===1?'path-date-needle':'path-date-needle-growing'} d={polygon(...needlePoints.map(target=>mix([50,50],target,reduced?1:needle)))} {...trace(needle)}/>
        <circle className="path-forming-point" cx="50" cy="50" r={2*needle}/>
      </g>
    </svg>;
  }
  // The icon uses the same round stone, crown and viewing angle as the place ahead.
  // A quiet four-point setting sits behind it; the stone remains the dominant shape.
  const project = (vertex: GemVertex) => {
    const at = projectSapphire(vertex, .32, 100, 100);
    return {...at, x:50+(at.x-50)*1.14, y:47+(at.y-47)*1.14};
  };
  const projected = SAPPHIRE_VERTICES.map(project);
  const shape = (points: {x:number;y:number}[]) => polygon(...points.map(at=>[at.x,at.y] as Point));
  const line = ([a,b]: [number,number]) => `M${point([projected[a].x,projected[a].y])} ${point([projected[b].x,projected[b].y])}`;
  const outline = softStep(p/.5), crown = softStep((p-.13)/.47);
  const shoulder = softStep((p-.28)/.5), pavilion = softStep((p-.46)/.44), setting = softStep((p-.68)/.32);
  const cradle = Array.from({length:8},(_,i)=>{
    const angle=i*Math.PI/4, radius=i%2?.64:1.25;
    return project([Math.cos(angle)*radius,-.13,Math.sin(angle)*radius]);
  });
  const shoulders = SAPPHIRE_EDGES.filter(([a,b])=>a<8&&b>=8&&b<16&&(projected[a].z+projected[b].z)/2<.28);
  const lower = SAPPHIRE_EDGES.filter(([a,b])=>b===16&&projected[a].z<.4);
  const facets = SAPPHIRE_FACES.slice(0,-1).map((indices,i)=>({indices,i,depth:indices.reduce((sum,index)=>sum+projected[index].z,0)/indices.length}))
    .sort((a,b)=>b.depth-a.depth);
  return <svg className="path-destination-drawing path-sapphire-drawing" viewBox="0 0 100 100" aria-hidden="true">
    <path className="path-sapphire-setting" d={shape(cradle)} {...trace(setting)}/>
    <path className="path-sapphire-body" d={shape(gemstoneOutline(projected))} fillOpacity={outline*.09} {...trace(outline)}/>
    {facets.map(({indices,i})=><path key={i} className={`path-sapphire-facet${i%3===0?' path-sapphire-facet-light':''}`} d={shape(indices.map(index=>projected[index]))}
      fillOpacity={(i<16?shoulder:pavilion)*(i%3===0?.12:.06)} visibility={visible(i<16?shoulder:pavilion)}/>)}
    <path className="path-sapphire-pavilion" d={lower.map(line).join('')} {...trace(pavilion)}/>
    <path className="path-sapphire-shoulder" d={shoulders.map(line).join('')} {...trace(shoulder)}/>
    <path className="path-sapphire-crown" d={shape(projected.slice(0,8))} fillOpacity={crown*.12} {...trace(crown)}/>
  </svg>;
}
