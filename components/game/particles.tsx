'use client';
import { useEffect, useRef } from 'react';
import type { StarArrival } from '@/lib/bracelet-transition';
type Point = { x: number; y: number };
export type WishField = {nodes:{word:string;x:number;y:number;selected:boolean;order:number}[];carrier:Point;departing:boolean};
function glyph(text: string, w: number, h: number, wish = false): Point[] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return [];
  const lines = text.split('\n');
  const font = Math.min(
    w / (Math.max(...lines.map((l) => l.length)) * 0.64),
    h / (lines.length * 1.7),
    120,
  );
  g.fillStyle = 'white';
  g.font = wish ? '500 28px "PingFang SC", "Microsoft YaHei", sans-serif' : '300 ' + font + 'px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((s, i) =>
    g.fillText(s, w / 2, h / 2 + (i - (lines.length - 1) / 2) * font * 1.5),
  );
  const pixels = g.getImageData(0, 0, w, h).data,
    points: Point[] = [];
  const step = wish ? 2 : Math.max(3, Math.round(font / 17));
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step)
      if (pixels[(y * w + x) * 4 + 3] > 110) points.push({ x, y });
  return points;
}
export function Starfield({
  text = '',
  burst = false,
  charge = 0,
  arrival,
  wishes,
  paused = false,
}: {
  text?: string;
  burst?: boolean;
  charge?: number;
  arrival?: StarArrival | null;
  wishes?: WishField | null;
  paused?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    props = useRef({ text, burst, charge, arrival, wishes, paused });
  useEffect(() => {
    props.current = { text, burst, charge, arrival, wishes, paused };
  }, [text, burst, charge, arrival, wishes, paused]);
  useEffect(() => {
    const c = ref.current!,
      g = c.getContext('2d');
    if (!g) return;
    let w = 0,
      h = 0,
      frame = 0,
      last = '',
      targets: Point[] = [],
      previous = 0;
    let lastArrival = 0;
    const wishGlyphs = new Map<string,Point[]>();
    let phaseTime=0,lastTime=0;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const rand = (i: number) => {
      const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const stars = Array.from({ length: 2300 }, (_, i) => ({
      x: rand(i) * innerWidth,
      y: rand(i + 2000) * innerHeight,
      seed: rand(i + 100),
      r: 0.5 + rand(i + 900) * 1.2,
      tone: rand(i + 4100),
    }));
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      const dpr = Math.min(devicePixelRatio, 2);
      c.width = w * dpr;
      c.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      last = '\0';
    };
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    resize();
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || props.current.paused) {lastTime=time;return;}
      if(time - previous < (reduced ? 100 : 32))return;
      phaseTime+=Math.min(time-lastTime,60);lastTime=time;
      previous = time;
      const p = props.current;
      if (p.arrival && p.arrival.id !== lastArrival) {
        lastArrival = p.arrival.id;
        p.arrival.points.forEach((point, i) => { if (stars[i]) { stars[i].x = point.x; stars[i].y = point.y; } });
      }
      if (p.text !== last) {
        last = p.text;
        targets = p.text
          ? glyph(p.text, Math.round(w * 0.88), Math.round(h * 0.44)).map(
              (t) => ({ x: t.x + w * 0.06, y: t.y + h * 0.18 }),
            )
          : [];
      }
      g.clearRect(0, 0, w, h);
      stars.forEach((s, i) => {
        const t =
          targets.length && i < 2080
            ? {...targets[Math.min(targets.length - 1, Math.floor((i / 2080) * targets.length))]}
            : { x: rand(i) * w, y: rand(i + 2000) * h };
        const goal = p.burst
          ? { x: rand(i + 777) * w, y: rand(i + 999) * h }
          : t;
        if(p.wishes&&i<2080){
          const node=p.wishes.nodes[Math.floor(i/260)];
          if(node){
            if(node.selected){
              const orbit=phaseTime*.0008+node.order*Math.PI*2/3;
              const r=p.wishes.departing?15:30;
              goal.x=p.wishes.carrier.x+Math.cos(orbit)*r+Math.sin(i*2.7)*2.1;
              goal.y=p.wishes.carrier.y+Math.sin(orbit)*r*.6+Math.cos(i*3.3)*2.1;
            }else if(p.wishes.nodes.filter(n=>n.selected).length===3){
              goal.x=rand(i)*w;goal.y=rand(i+2000)*h;
            }else{
              let dots=wishGlyphs.get(node.word);
              if(!dots){dots=glyph(node.word,110,64,true);wishGlyphs.set(node.word,dots);}
              const dot=dots[Math.floor((i%260)/260*dots.length)]??{x:55,y:32};
              goal.x=node.x+dot.x-55;goal.y=node.y+dot.y-32;
            }
          }
        }
        const ease = reduced ? 1 : p.burst ? 0.12 : p.wishes ? .055 : 0.037;
        s.x += (goal.x - s.x) * ease;
        s.y += (goal.y - s.y) * ease;
        const inText = (!!targets.length && i < 2080 || !!p.wishes && i<2080) && !p.burst;
        const companion=!!p.wishes?.nodes[Math.floor(i/260)]?.selected;
        g.globalAlpha = inText
          ? 0.62 + 0.3 * Math.sin(time * 0.001 + s.seed * 8) ** 2
          : 0.12 + (0.28 + s.tone * 0.2) * Math.sin(time * 0.0003 + s.seed * 8) ** 2;
        if (!inText && i > 230 && !p.burst) return;
        g.fillStyle = inText
          ? p.wishes&&!companion?'#e3e8f3':'#ffe2f2'
          : s.tone < 0.16
            ? '#d8e7ff'
            : s.tone > 0.91
              ? '#ffe5d2'
              : '#b8c9df';
        g.beginPath();
        g.arc(
          s.x,
          s.y,
          companion ? .55 : s.r * (inText ? 0.65 + p.charge * 0.6 : 1),
          0,
          Math.PI * 2,
        );
        g.fill();
        if (inText && !p.wishes && i % 75 === 0) {
          g.globalAlpha = 0.5 + p.charge * 0.5;
          const r = 3 + p.charge * 6;
          g.fillRect(s.x - r, s.y - 0.4, r * 2, 0.8);
          g.fillRect(s.x - 0.4, s.y - r, 0.8, r * 2);
        }
      });
      g.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return <canvas className="starfield" ref={ref} aria-hidden="true" />;
}
export function WordDust({
  word,
  progress,
  selected,
}: {
  word: string;
  progress: number;
  selected: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    p = useRef(progress);
  useEffect(() => {
    p.current = progress;
  }, [progress]);
  useEffect(() => {
    const c = ref.current!,
      g = c.getContext('2d');
    if (!g) return;
    const w = 280,
      h = 110,
      dpr = Math.min(devicePixelRatio, 2);
    c.width = w * dpr;
    c.height = h * dpr;
    g.scale(dpr, dpr);
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d')!;
    o.fillStyle = '#fff';
    o.font = '44px Georgia, "Songti SC", "Microsoft YaHei", serif';
    o.textAlign = 'center';
    o.fillText(word, w / 2, 70);
    const data = o.getImageData(0, 0, w, h).data,
      points: { x: number; y: number; a: number }[] = [];
    for (let y = 0; y < h; y += 3)
      for (let x = 0; x < w; x += 3)
        if (data[(y * w + x) * 4 + 3] > 80)
          points.push({ x, y, a: Math.sin(x * 13 + y * 17) * 20 });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let id = 0,
      v = 0,
      prev = 0;
    const draw = (t: number) => {
      id = requestAnimationFrame(draw);
      if (document.hidden || t - prev < 32) return;
      prev = t;
      v = reduced ? p.current : v + (p.current - v) * 0.1;
      g.clearRect(0, 0, w, h);
      g.fillStyle = selected ? '#ffb3de' : '#e5eaff';
      points.forEach((s, i) => {
        const drift = 1 - v;
        g.globalAlpha = 0.5 + (i % 5) * 0.1;
        g.beginPath();
        g.arc(
          s.x +
            drift * (s.a * 1.7 + Math.sin((reduced ? 0 : t) * 0.0006 + i) * 6),
          s.y + drift * (Math.cos(i * 3) * 26),
          selected ? 1.2 : 0.95,
          0,
          7,
        );
        g.fill();
      });
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [word, selected]);
  return <canvas ref={ref} aria-hidden="true" />;
}
