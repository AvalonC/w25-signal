'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState } from 'react';
import { RELAY_MARKS, RELAY_ROUTES, RELAY_SHORES } from '@/lib/relay-motion';
import { relayDeparture } from '@/lib/relay-departure';
import { useVisibleClock } from './scene-clock';

const STAR = 'M50 5 58 41 95 50 58 59 50 95 42 59 5 50 42 41Z';
const position = (point: readonly number[], yOffset: number) => ({ left: `${point[0] / 3.6}%`, top: `calc(${point[1] / 3}% + ${yOffset}px)` });

export function RelayDeparture({ choices, paused, onContinue }: {
  choices: number[]; paused: boolean; onContinue: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const once = useRef(false);
  const elapsed = useVisibleClock(!paused && !hidden && !once.current);
  const frame = relayDeparture(elapsed, reduced);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(!!media?.matches);
    visibility(); motion();
    document.addEventListener('visibilitychange', visibility);
    media?.addEventListener('change', motion);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      media?.removeEventListener('change', motion);
    };
  }, []);

  useEffect(() => {
    if (!frame.ready || paused || hidden || document.hidden || once.current) return;
    once.current = true;
    onContinue();
  }, [frame.ready, paused, hidden, onContinue]);

  return <section className={'relay-departure' + (paused || hidden ? ' is-paused' : '')}
    aria-label="带着愿望继续向前">
    <div className="relay-departure-guidance" aria-hidden="true" />
    <div className="relay-sky relay-departure-sky">
      <svg className="relay-departure-map" viewBox="0 0 360 300" preserveAspectRatio="none" aria-hidden="true"
        style={{ opacity: frame.routeOpacity }}>
        {RELAY_ROUTES.map((path) => <path key={path} d={path} className="relay-path relay-route-complete" />)}
        {RELAY_SHORES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 3 ? 3 : 2} className="relay-route-stop reached" />)}
        {RELAY_MARKS.map((mark) => {
          const half = mark.symbol === '-' ? 7 : 0;
          return <line key={`${mark.round}-${mark.index}`} x1={mark.point[0] - half} y1={mark.point[1]}
            x2={mark.point[0] + (half || .1)} y2={mark.point[1]} className="relay-departure-mark" />;
        })}
      </svg>
      <div className="relay-departure-main" aria-hidden="true"
        style={{ ...position(frame.main, 1), opacity: frame.mainOpacity }}>
        <svg viewBox="0 0 100 100"><path d={STAR} /></svg>
      </div>
      {frame.companions.map((point, i) => <div key={choices[i] ?? i} className="relay-departure-companion" aria-hidden="true"
        style={{ ...position(point, .5), opacity: frame.companionOpacity }}>
        <svg viewBox="0 0 100 100"><path d={STAR} /></svg>
      </div>)}
    </div>
    <div className="relay-departure-console" aria-hidden="true" />
  </section>;
}
