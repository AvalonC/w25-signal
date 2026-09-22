'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { NOUNS } from '@/lib/journey';
import { RELAY_ROUTES, RELAY_SHORES, relayReveal } from '@/lib/relay-motion';
import { useVisibleClock } from './scene-clock';

const STAR = 'M0 -15 3 -3 15 0 3 3 0 15 -3 3 -15 0 -3 -3Z';
export function RelayReveal({ choices, paused, onContinue }: {
  choices: number[]; paused: boolean; onContinue: () => void;
}) {
  const [hidden, setHidden] = useState(false), [reduced, setReduced] = useState(false);
  const [finished, setFinished] = useState(false);
  const [settled, setSettled] = useState(false), [letterYScale, setLetterYScale] = useState(1);
  const world = useRef<HTMLDivElement>(null);
  const once = useRef(false);
  const elapsed = useVisibleClock(!paused && !hidden && !finished && !settled);
  const frame = relayReveal(settled ? reduced ? 1000 : 5500 : elapsed, reduced, letterYScale);
  useEffect(() => { if (frame.ready) setSettled(true); }, [frame.ready]);
  useEffect(() => {
    const area = world.current;
    if (!area) return;
    const measure = () => { const rect = area.getBoundingClientRect(); if (rect.height) setLetterYScale(rect.width / rect.height * 300 / 360); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(area);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(!!media?.matches);
    visibility(); motion(); document.addEventListener('visibilitychange', visibility);
    media?.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media?.removeEventListener('change', motion); };
  }, []);
  const proceed = () => {
    if (!frame.ready || paused || document.hidden || once.current) return;
    once.current = true; setFinished(true); onContinue();
  };
  return <section className={'relay-reveal' + (paused || hidden ? ' is-paused' : '')} aria-label="长短的光，组成 W25">
    <div className="relay-guidance"><output className="relay-verse" aria-live="polite">{frame.ready ? '三段回应，原来写着同一个名字。' : frame.gather < 1 ? '走过的星路，正在把回应带到一起。' : 'W25。每一次回应，都留在了这里。'}</output>
      <p className="relay-subline">{frame.ready ? '主星回来了，带着愿望继续向前。' : '\u00a0'}</p></div>
    <div className="relay-reveal-world" ref={world}>
      <svg className="relay-reveal-sky" viewBox="0 0 360 300" preserveAspectRatio="none" aria-hidden="true">
        <g style={{ opacity: frame.routeOpacity }}>
          {RELAY_ROUTES.map((path) => <path key={path} d={path} className="relay-path relay-route-complete" />)}
          {RELAY_SHORES.map(([x,y], i) => <circle key={i} cx={x} cy={y} r={2} className="relay-route-stop reached" />)}
        </g>
        {frame.marks.map((mark, i) => <line key={i} x1={mark.line[0]} y1={mark.line[1]} x2={mark.line[2]+.1} y2={mark.line[3]} className="relay-forming-letter" vectorEffect="non-scaling-stroke" />)}
        <line x1={frame.extraStroke[0]} y1={frame.extraStroke[1]} x2={frame.extraStroke[2]} y2={frame.extraStroke[3]} className="relay-forming-letter" vectorEffect="non-scaling-stroke" style={{ opacity: frame.glyphOpacity }} />
      </svg>
      <div className="relay-reveal-main" style={{ left:`${frame.main[0]/3.6}%`, top:`${frame.main[1]/3}%`, opacity:frame.mainOpacity }} aria-hidden="true">
        <svg viewBox="-20 -20 40 40"><path d={STAR} className="relay-returned-star" /></svg>
      </div>
      {frame.companions.map(([x,y], i) => <div key={choices[i] ?? i} className="relay-reveal-companion" style={{ left:`${x/3.6}%`, top:`${y/3}%` }} aria-hidden="true">
        <svg viewBox="-20 -20 40 40" style={{ width:23-7*frame.returnLight }}><path d={STAR} className="relay-returned-companion" /></svg>
        <span style={{ opacity:1-frame.returnLight }}>{NOUNS[choices[i]]?.[0]}</span>
      </div>)}
      <button className="relay-returned-control" aria-label="带着愿望，循着主星继续" disabled={!frame.ready || paused || hidden || finished}
        style={{ left: `${frame.main[0]/3.6}%`, top: `${frame.main[1]/3}%`, opacity: frame.returnLight }} onClick={proceed}>
        <span>{choices.map((wish) => NOUNS[wish][0]).join(' · ')}</span>
      </button>
      <span className="sr-only">W25</span>
    </div>
    <div className="relay-reveal-footer"><p>一瞬是点，停留是划。这是摩尔斯电码。</p>
      <button className="relay-reveal-continue" disabled={!frame.ready || paused || hidden || finished} onClick={proceed}>循着光，继续向前 <ArrowRight size={17} /></button>
    </div>
  </section>;
}
