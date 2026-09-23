export type Vec3 = [number, number, number];
export type ViewPoint = { x: number; y: number };
export type CameraView = {
  theta: number; phi: number; radius: number; target: Vec3; fov: number;
  left: number; top: number; width: number; height: number;
  orthographicSpan?: number;
};
// Origin is normalized to the viewport; the star particles retain pixel coordinates.
export type StarArrival = { id: number; points: ViewPoint[]; origin?: ViewPoint; viewport?: { width:number; height:number } };
export const BRACELET_DURATION = 3600;
export function clickOrigin(event:{detail:number;clientX:number;clientY:number},rect:{left:number;top:number;width:number;height:number},width:number,height:number):ViewPoint {
  const pointer=event.detail>0&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY);
  return {x:Math.max(0,Math.min(1,(pointer?event.clientX:rect.left+rect.width/2)/Math.max(1,width))),
    y:Math.max(0,Math.min(1,(pointer?event.clientY:rect.top+rect.height/2)/Math.max(1,height)))};
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function braceletPhase(ms: number, reduced = false) {
  if (reduced) return { solid: 1 - smooth(ms / 650), stars: smooth(ms / 650), spread: 0, done: ms >= 1000 };
  return {
    solid: 1 - smooth(ms / 1100),
    stars: smooth((ms - 80) / 1000),
    spread: smooth((ms - 1350) / 2250),
    done: ms >= BRACELET_DURATION,
  };
}
// model-viewer's public camera orbit is in radians, its field of view in degrees.
// Project the same unmodified geometry through that camera to prevent a jump
// between a freely rotated model and its star silhouette.
export function projectPoint(point: Vec3, view: CameraView): ViewPoint {
  const { theta: t, phi: p, radius, target, fov, left, top, width, height } = view;
  const back: Vec3 = [Math.sin(p) * Math.sin(t), Math.cos(p), Math.sin(p) * Math.cos(t)];
  const right: Vec3 = [Math.cos(t), 0, -Math.sin(t)];
  const up: Vec3 = [-Math.cos(p) * Math.sin(t), Math.sin(p), -Math.cos(p) * Math.cos(t)];
  const relative = point.map((v, i) => v - target[i]) as Vec3;
  const dot = (a: Vec3, b: Vec3) => a.reduce((n, v, i) => n + v * b[i], 0);
  const depth = Math.max(0.0001, radius - dot(relative, back));
  const scale = view.orthographicSpan ? height / view.orthographicSpan : height / (2 * Math.tan(fov * Math.PI / 360) * depth);
  return { x: left + width / 2 + dot(relative, right) * scale,
    y: top + height / 2 - dot(relative, up) * scale };
}
export function scatteredPoint(point: ViewPoint, index: number, spread: number, width: number, height: number): ViewPoint {
  const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const x = random(index + 777) * width, y = random(index + 999) * height;
  const arc = Math.sin(spread * Math.PI) * (random(index + 1300) - .5) * Math.min(width, height) * .3;
  return { x: point.x + (x - point.x) * spread + arc,
    y: point.y + (y - point.y) * spread - Math.abs(arc) * .5 };
}
