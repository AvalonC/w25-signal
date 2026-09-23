'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { CompanionLight } from './path-sky';
import { ModelSurface } from './model-surface';
import { useVisibleClock } from './scene-clock';
import { BRACELET_ASSETS } from '@/lib/model-assets';
import { projectPoint, smooth } from '@/lib/bracelet-transition';
import { CLOSURE_CODES, CLOSURE_GEM, CLOSURE_LETTERS, CLOSURE_ORBIT, CLOSURE_PARTS,
  CLOSURE_START, CLOSURE_TARGET, closureArrival, closureFrame, closureNear, closurePoint, closureRingPoint } from '@/lib/path-closure';
import metadata from '../../public/models/jewelry-metadata.json';

type Point = { x: number; y: number };
const route = Array.from({ length: 111 }, (_, i) => closureRingPoint(20 + i * 325 / 110));
const pathOf = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
const ring = pathOf(route);
const gap = pathOf(Array.from({ length: 21 }, (_, i) => closureRingPoint(345 + i * 35 / 20)));
const words = ['一瞬的光，和两次长长的停留。', '两点、三划，接成第二段回应。', '五点星光，接住了最后一个愿望。'];

export function PathClosure({ choices, paused = false, fromRelay = false, onComplete }: {
  choices: number[]; paused?: boolean; fromRelay?: boolean; onComplete: () => void;
}) {
  const [closed, setClosed] = useState(false), [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false), [hidden, setHidden] = useState(false);
  const [point, setPoint] = useState<Point>(CLOSURE_START), [near, setNear] = useState(false);
  const [dragging, setDragging] = useState(false), [selected, setSelected] = useState<number | null>(null);
  const area = useRef<HTMLDivElement>(null), light = useRef<HTMLButtonElement>(null);
  const pointer = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const begun = useRef(false), sent = useRef(false), currentPoint = useRef<Point>(CLOSURE_START);
  const callback = useRef(onComplete); callback.current = onComplete;
  const opening = useVisibleClock(!closed && !paused && !hidden);
  const elapsed = useVisibleClock(closed && !paused && !hidden);
  const phase = closureFrame(elapsed, reduced);
  const overview = reduced ? 1 : smooth(opening / 2200);
  const arrival = closureArrival(opening, reduced);
  const entryReady = fromRelay ? arrival.ready : reduced || opening >= 1800;
  const group = selected ?? phase.group;
  const clear = useCallback(() => {
    const previous = pointer.current;
    pointer.current = null;
    if (previous && light.current?.hasPointerCapture(previous.id)) light.current.releasePointerCapture(previous.id);
    setDragging(false); setNear(false);
    if (!begun.current) { currentPoint.current = CLOSURE_START; setPoint(CLOSURE_START); }
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(!!media?.matches);
    changed(); media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const changed = () => { setHidden(document.hidden); if (document.hidden) clear(); };
    changed(); document.addEventListener('visibilitychange', changed); window.addEventListener('blur', clear);
    return () => { document.removeEventListener('visibilitychange', changed); window.removeEventListener('blur', clear); };
  }, [clear]);
  useEffect(() => { if (paused) clear(); }, [paused, clear]);
  const join = () => {
    if (paused || document.hidden || begun.current || !entryReady) return;
    begun.current = true; clear(); setClosed(true);
  };
  const finish = () => {
    if (paused || document.hidden || !closed || !phase.ready || sent.current) return;
    sent.current = true; callback.current();
  };
  const position = (event: PointerEvent<HTMLButtonElement>, offset = pointer.current) => {
    const rect = area.current!.getBoundingClientRect();
    return { x: Math.max(5, Math.min(95, (event.clientX - rect.left) / rect.width * 100 - (offset?.dx ?? 0))),
      y: Math.max(5, Math.min(95, (event.clientY - rect.top) / rect.height * 100 - (offset?.dy ?? 0))) };
  };
  const isNear = (value: Point) => {
    const rect = area.current!.getBoundingClientRect();
    return closureNear(value, rect.width, rect.height);
  };
  const showPart = (index: number) => closed && (selected === null ? phase.lit[index] : CLOSURE_PARTS[index].group === selected);
  const showGem = closed && selected === null ? phase.gemstone : 0;
  const start = closed ? { x: point.x + (CLOSURE_TARGET.x-point.x) * phase.join,
    y: point.y + (CLOSURE_TARGET.y-point.y) * phase.join } : fromRelay && !entryReady ? arrival.point : point;
  const markClass = (index: number) => 'closure-stone' + (showPart(index) ? ' is-lit' : '') +
    (phase.active === index && !phase.ready || selected !== null && CLOSURE_PARTS[index].group === selected ? ' is-speaking' : '') +
    (CLOSURE_PARTS[index].symbol === '-' ? ' is-bar' : '');
  return <section className={'path-closure' + (closed ? ' is-closed' : '') + (dragging ? ' is-carrying' : '') +
    (paused || hidden ? ' is-paused' : '') + (reduced ? ' is-reduced' : '') + (fromRelay ? ' from-relay' : '')} aria-label="让星路在手链上闭合"
    style={{ '--closure-arrival-copy': fromRelay ? arrival.copy : 1 } as CSSProperties}>
    <output className="closure-whisper">{!closed ? '走过的光，原来围成了一圈。'
      : phase.settled ? '那些长短的回应，一直藏在它身上。' : group >= 0 ? words[group] : '最后一段星路，被你接通了。'}</output>
    <div className="closure-world" ref={area} style={{ '--closure-overview': overview,
      '--closure-solid': closed ? phase.solid : 0, '--closure-trace': closed ? 1 - phase.solid : 1 } as CSSProperties}>
      <div className="closure-object" aria-hidden={!closed}>
        <ModelSurface src={BRACELET_ASSETS.model} poster={BRACELET_ASSETS.poster} orbit={CLOSURE_ORBIT}
          target="0m 0m 0m" label="长短钻石链节组成 W25 的真实手链" onReady={setLoaded} interactive={false}>
          {CLOSURE_PARTS.flatMap((part, index) => part.stones.map((stone, j) => <span key={`${part.node}-${j}`}
            slot={`hotspot-morse-${index}-${j}`} data-position={stone.map((n) => `${n}m`).join(' ')}
            className={markClass(index)} aria-hidden="true" />))}
          <span slot="hotspot-closure-gem" data-position={CLOSURE_GEM.map((n) => `${n}m`).join(' ')}
            className="closure-gem" style={{ opacity: showGem }} aria-hidden="true" />
        </ModelSurface>
        {!loaded && <svg className="closure-poster-lights" viewBox="0 0 100 100" aria-hidden="true">
          {CLOSURE_PARTS.flatMap((part, index) => part.stones.map((stone, j) => {
            const p = projectPoint(stone, { ...metadata.poster, target: metadata.poster.target as [number, number, number],
              orthographicSpan: metadata.poster.span, radius: .145, fov: 30, left: 0, top: 0, width: 100, height: 100 });
            return <circle key={`${part.node}-${j}`} cx={p.x} cy={p.y} r={.8} className={markClass(index)} />;
          }))}
          {(() => { const p = projectPoint(CLOSURE_GEM, { ...metadata.poster, target: metadata.poster.target as [number, number, number],
            orthographicSpan: metadata.poster.span, radius: .145, fov: 30, left: 0, top: 0, width: 100, height: 100 });
            return <circle cx={p.x} cy={p.y} r={2.4} className="closure-gem" style={{ opacity: showGem }} />; })()}
        </svg>}
      </div>
      <div className="closure-sky" aria-hidden="true">
        <svg className="closure-ring" viewBox="0 0 100 100">
          <path className="closure-route-soft" d={ring} />
          <path className="closure-route" d={ring} />
          {closed && <path className="closure-join" d={gap} pathLength={1} strokeDasharray="1" strokeDashoffset={1-phase.join} />}
          {CLOSURE_PARTS.map((part, index) => {
            const dots = part.stones.map(closurePoint), p = dots[0];
            return part.symbol === '.' ? <circle className="closure-route-mark" key={part.node} cx={p.x} cy={p.y} r={.6} />
              : <path key={part.node} className="closure-route-mark" d={pathOf(dots)} data-part={index} />;
          })}
        </svg>
      </div>
      {!closed && <button type="button" className={'closure-target' + (near ? ' is-near' : '')}
          style={{ left: `${CLOSURE_TARGET.x}%`, top: `${CLOSURE_TARGET.y}%` }} disabled={paused || !entryReady}
          onClick={join} aria-label="接通最后一段星路"><span aria-hidden="true">✦</span></button>}
      {(!closed || phase.join < 1) && <button ref={light} type="button" className="closure-carried" disabled={closed || paused || !entryReady}
          style={{ left: `${start.x}%`, top: `${start.y}%`, opacity: closed ? 1-phase.join : fromRelay ? arrival.opacity : overview } as CSSProperties}
          aria-label="把同行的星光拖到对端，也可按回车接通星路"
          onPointerDown={(event) => {
            if (paused || document.hidden || begun.current || pointer.current || !entryReady || event.button > 0 || event.isPrimary === false) return;
            event.preventDefault(); const p = position(event, null);
            pointer.current = { id: event.pointerId, dx: p.x-currentPoint.current.x, dy: p.y-currentPoint.current.y };
            event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
          }}
          onPointerMove={(event) => {
            if (paused || !pointer.current || pointer.current.id !== event.pointerId) return;
            const p = position(event); currentPoint.current = p; setPoint(p); setNear(isNear(p));
          }}
          onPointerUp={(event) => {
            if (pointer.current?.id !== event.pointerId) return;
            const p = position(event);
            if (isNear(p)) { currentPoint.current = p; setPoint(p); join(); } else clear();
          }} onPointerCancel={clear} onLostPointerCapture={clear}
          onClick={(event) => { if (event.detail === 0) join(); }}>
          <CompanionLight choices={choices} pink />
        </button>}
    </div>
    <div className="closure-reading">
      {!closed ? <p className="closure-invitation">把同行的光，带到最后一个星点。</p> : <>
        <div className="closure-code" aria-label="W25 与手链上的三组长短链节">
          {CLOSURE_CODES.map((code, i) => <button type="button" key={code} disabled={paused || !phase.ready}
            className={group === i || phase.ready && selected === null ? 'is-current' : ''} aria-pressed={selected === i}
            aria-label={`查看手链上的 ${CLOSURE_LETTERS[i]}，${code}`} onClick={() => setSelected(selected === i ? null : i)}>
            <span className="closure-symbols" aria-hidden="true">{code.split('').map((symbol, j) =>
              <i key={j} className={symbol === '-' ? 'long' : ''} />)}</span>
            <strong>{phase.group >= i ? CLOSURE_LETTERS[i] : '\u00a0'}</strong>
          </button>)}
        </div>
        <p className="closure-meaning">{phase.settled ? '你的愿望、你的日子、你的颜色。都在这里。' : '短的是一点，长的是一划。'}</p>
        <button type="button" className="closure-continue" disabled={paused || !phase.ready} onClick={finish}>
          {phase.ready ? '让它来到眼前' : '光还在慢慢经过'}<ArrowRight size={16} aria-hidden="true" />
        </button>
      </>}
    </div>
  </section>;
}
