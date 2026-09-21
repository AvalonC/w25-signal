'use client';
// Pointer capture keeps the carried light attached to one finger across the sky.
/* oxlint-disable react/react-compiler */
// The composed light is several live SVG stars, so it has no single img source.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { NOUNS } from '@/lib/journey';

export type PathPlace = 'sky' | 'prism' | 'date' | 'sapphire';
type Destination = Exclude<PathPlace, 'sky'>;
type Point = { x: number; y: number };
const PLACES: Record<Destination, Point> = {
  prism: { x: 23, y: 36 },
  date: { x: 76, y: 24 },
  sapphire: { x: 62, y: 69 },
};
const STAR = 'M20 1 24 15 39 20 24 25 20 39 15 25 1 20 15 15Z';

export function CompanionLight({
  choices,
  pink,
  compact = false,
  onClick,
  label,
}: {
  choices: number[];
  pink: boolean;
  compact?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const names = choices.map((choice) => NOUNS[choice]?.[0]).filter(Boolean).join('、');
  const className = `path-company${pink ? ' path-company-pink' : ''}${compact ? ' path-company-compact' : ''}`;
  const content = <>
    <svg className="path-company-star" viewBox="0 0 40 40" aria-hidden="true"><path d={STAR} /></svg>
    {choices.slice(0, 3).map((choice, index) => (
      <span key={choice} className="path-companion-orbit" style={{ '--companion-angle': `${index * 120 + 16}deg`, '--companion-delay': `${index * -1.6}s` } as CSSProperties} aria-hidden="true">
        <svg className="path-companion-trail" viewBox="0 0 60 60"><path d="M30 3A27 27 0 0 0 11 11" /></svg>
        <svg className="path-companion" viewBox="0 0 40 40"><path d={STAR} /></svg>
      </span>
    ))}
  </>;
  const description = label || `同行的光${names ? `，带着${names}` : ''}`;
  return onClick ? (
    <button type="button" className={className} onClick={onClick} aria-label={description}>{content}</button>
  ) : (
    <span className={className} role="img" aria-label={description}>{content}</span>
  );
}

function PlaceDrawing({ place }: { place: Destination }) {
  if (place === 'prism') return <svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M22 74 49 18 78 69 22 74 60 84 78 69M49 18 60 84M9 43 40 44" />
    <path className="path-prism-ray" d="M59 47 95 35M61 52 97 55M64 59 96 76" />
  </svg>;
  if (place === 'date') return <svg viewBox="0 0 100 100" aria-hidden="true">
    <g className="path-date-outer">
      <circle cx="50" cy="50" r="36" />
      <path d="M50 10V18M90 50H82M50 90V82M10 50H18M22 22 28 28M78 22 72 28M22 78 28 72M78 78 72 72" />
      <path className="path-date-mark" d="M50 12 52 14 50 16 48 14ZM84 48 86 50 84 52 82 50Z" />
    </g>
    <g className="path-date-inner">
      <circle cx="50" cy="50" r="24" />
      <path d="M50 23V28M77 50H72M50 77V72M23 50H28" />
      <circle className="path-date-satellite" cx="50" cy="26" r="1.8" />
    </g>
    <path className="path-date-needle" d="M37 51 48 49 62 33 55 55 43 63Z" />
    <circle cx="50" cy="50" r="2" />
  </svg>;
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M31 24 68 24 84 46 51 85 16 46 31 24ZM16 46H84M31 24 38 46 51 85 63 46 68 24M31 24 63 46M68 24 38 46" />
    <circle cx="31" cy="24" r="1.8" /><circle cx="68" cy="24" r="1.8" /><circle cx="51" cy="85" r="1.8" />
  </svg>;
}

export function PathSky({ color, dateFound, choices, paused, onVisit }: {
  color: boolean;
  dateFound: boolean;
  choices: number[];
  paused: boolean;
  onVisit: (place: Destination) => void;
}) {
  const skyRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const positionRef = useRef<Point>({ x: 26, y: 78 });
  const [position, setPosition] = useState<Point>(positionRef.current);
  const [dragging, setDragging] = useState(false);
  const [near, setNear] = useState<Destination | null>(null);
  const [hidden, setHidden] = useState(false);
  const ready = color && dateFound;

  const clearGesture = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current && lightRef.current?.hasPointerCapture(current.id)) lightRef.current.releasePointerCapture(current.id);
    setDragging(false);
    setNear(null);
  }, []);

  useEffect(() => {
    if (paused) clearGesture();
  }, [paused, clearGesture]);

  useEffect(() => {
    const onVisibility = () => { setHidden(document.hidden); if (document.hidden) clearGesture(); };
    onVisibility();
    window.addEventListener('blur', clearGesture);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', clearGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      gesture.current = null;
    };
  }, [clearGesture]);

  function nearest(point: Point) {
    const box = skyRef.current?.getBoundingClientRect();
    if (!box) return null;
    let found: Destination | null = null;
    let distance = Math.min(70, box.width * .2);
    for (const place of Object.keys(PLACES) as Destination[]) {
      if (place === 'sapphire' && !ready) continue;
      const target = PLACES[place];
      const next = Math.hypot((target.x - point.x) * box.width / 100, (target.y - point.y) * box.height / 100);
      if (next < distance) { found = place; distance = next; }
    }
    return found;
  }
  function moveTo(point: Point) {
    const next = { x: Math.max(7, Math.min(93, point.x)), y: Math.max(10, Math.min(91, point.y)) };
    positionRef.current = next;
    setPosition(next);
    setNear(nearest(next));
  }
  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (paused || document.hidden || gesture.current || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const box = skyRef.current?.getBoundingClientRect();
    if (!box) return;
    gesture.current = { id: event.pointerId, dx: (event.clientX - box.left) / box.width * 100 - positionRef.current.x, dy: (event.clientY - box.top) / box.height * 100 - positionRef.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    const box = skyRef.current?.getBoundingClientRect();
    if (paused || !current || current.id !== event.pointerId || !box) return;
    moveTo({ x: (event.clientX - box.left) / box.width * 100 - current.dx, y: (event.clientY - box.top) / box.height * 100 - current.dy });
  }
  function cancel(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    clearGesture();
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    const destination = paused ? null : nearest(positionRef.current);
    cancel(event);
    if (destination) onVisit(destination);
  }
  const words = ready ? '光与日子都在了。让它们在那颗星里相遇。' : color ? '你喜欢的光，正等着属于你的那一天。' : dateFound ? '那一天已经醒来。还缺一束你喜欢的光。' : '路还没有连起来。两处微光，在远方等你。';
  const labels: Record<Destination, string> = {
    prism: color ? '粉光，已在同行' : '光分开的地方',
    date: dateFound ? '十月八日，已点亮' : '日子藏在星里',
    sapphire: ready ? '让两束光相遇' : '等光，也等那一天',
  };
  return <section className={`path-exploration${paused || hidden ? ' path-paused' : ''}${color ? ' path-has-color' : ''}${dateFound ? ' path-has-date' : ''}`} aria-label="带着愿望，探索尚未连接的星路">
    <p className="path-verse" aria-live="polite">{words}</p>
    <div ref={skyRef} className={`path-sky${dragging ? ' path-dragging' : ''}`}>
      <svg className="path-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className={`path-route${color ? ' path-route-found' : ''}`} d="M26 78C9 66 11 49 23 36M23 36C35 44 42 53 62 69" />
        <path className={`path-route${dateFound ? ' path-route-found' : ''}`} d="M26 78C48 82 78 78 81 61M83 51C90 42 85 32 76 24M76 24C58 36 50 48 62 69" />
        <path className="path-missing" d="M81 61 83 51" />
        <circle className="path-origin" cx="26" cy="78" r=".6" />
      </svg>
      {(Object.keys(PLACES) as Destination[]).map((place) => {
        if (place === 'sapphire' && !dateFound) return null;
        const available = place !== 'sapphire' || ready;
        const found = place === 'prism' ? color : place === 'date' ? dateFound : ready;
        return <button type="button" key={place} className={`path-place path-place-${place}${found ? ' path-place-found' : ''}${near === place ? ' path-place-near' : ''}`} style={{ left: `${PLACES[place].x}%`, top: `${PLACES[place].y}%` }} disabled={paused || !available} aria-label={`${labels[place]}${available ? '，轻触前往，也可以把同行的光拖到这里' : '，先找到颜色与日子'}`} onClick={() => { if (!paused && available) onVisit(place); }}>
          <PlaceDrawing place={place} /><span>{labels[place]}</span>
        </button>;
      })}
      <button ref={lightRef} type="button" className={`path-carrier${near ? ' path-carrier-near' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} disabled={paused} aria-label="同行的光。拖到一处微光再松手；也可直接轻触目的地，键盘方向键移动，回车前往。" onPointerDown={begin} onPointerMove={move} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={(event) => {
        if (paused) return;
        const shifts: Record<string, Point> = { ArrowLeft: { x: -6, y: 0 }, ArrowRight: { x: 6, y: 0 }, ArrowUp: { x: 0, y: -6 }, ArrowDown: { x: 0, y: 6 } };
        const shift = shifts[event.key];
        if (shift) { event.preventDefault(); moveTo({ x: positionRef.current.x + shift.x, y: positionRef.current.y + shift.y }); }
        else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const destination = nearest(positionRef.current); if (destination) onVisit(destination); }
      }}>
        <CompanionLight choices={choices} pink={color} />
      </button>
    </div>
    <p className="path-whisper">{near ? `松开，让光去往${near === 'prism' ? '棱镜' : near === 'date' ? '星盘' : '宝石'}。` : '带着光走一走。也可以轻触远方。'}</p>
  </section>;
}
