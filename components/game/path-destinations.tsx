'use client';
import { softStep } from '@/lib/motion';

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
  return <svg className="path-destination-drawing" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M31 24 68 24 84 46 51 85 16 46 31 24ZM16 46H84M31 24 38 46 51 85 63 46 68 24M31 24 63 46M68 24 38 46" {...trace(p)}/>
    <g opacity={p}><circle cx="31" cy="24" r="1.8"/><circle cx="68" cy="24" r="1.8"/><circle cx="51" cy="85" r="1.8"/></g>
  </svg>;
}
