'use client';
// A radial dial supports both pointer rotation and keyboard slider semantics.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from 'react';
import { advanceDialRotation } from '../../lib/dial-motion';
import { dialReveal } from '@/lib/dial-reveal';
// Text presentation keeps zodiac marks in the starlight palette on phones.
const ZODIAC = ['♑', '♒', '♓', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐'].map((sign) => sign + '\uFE0E');
export function DateDial({
  label,
  value,
  max,
  kind,
  onChange,
  aligned = false,
  paused = false,
  formation = 1,
}: {
  label: string;
  value: number;
  max: number;
  kind: 'month' | 'day';
  onChange: (n: number) => void;
  aligned?: boolean;
  paused?: boolean;
  formation?: number;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ a: number; v: number; id: number } | null>(null);
  const [turning, setTurning] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [dial, setDial] = useState({ value, max, rotation: (-value * 360) / max });
  // Store the accumulated angle with the value, so a wrapped date never unwinds.
  if (dial.value !== value || dial.max !== max) {
    setDial({ value, max, rotation: dial.max === max
      ? advanceDialRotation(dial.rotation, dial.value, value, max)
      : (-value * 360) / max });
  }
  const p=Math.max(0,Math.min(1,formation));
  const reveal=dialReveal(p,max);
  const {outer,inner,reading}=reveal;
  const ring=(q:number)=>({pathLength:1,strokeDasharray:1,strokeDashoffset:1-q,visibility:q>0?'visible' as const:'hidden' as const});
  const asleep = paused || hidden || p<1;
  const previous=value===1?max:value-1, next=value===max?1:value+1;
  if (asleep && turning) setTurning(false);
  useEffect(() => {
    const cancel = () => {
      const id = drag.current?.id; drag.current = null; setTurning(false);
      if (id !== undefined && surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
    };
    const visibility = () => { setHidden(document.hidden); if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', cancel); };
  }, []);
  useEffect(() => {
    if (!asleep) return;
    const id = drag.current?.id;
    drag.current = null;
    if (id !== undefined && surface.current?.hasPointerCapture(id)) {
      surface.current.releasePointerCapture(id);
    }
  }, [asleep]);
  const stopTurning = () => {
    const id = drag.current?.id;
    drag.current = null;
    setTurning(false);
    if (id !== undefined && surface.current?.hasPointerCapture(id)) {
      surface.current.releasePointerCapture(id);
    }
  };
  const angle = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return (
      (Math.atan2(
        e.clientY - b.top - b.height / 2,
        e.clientX - b.left - b.width / 2,
      ) *
        180) /
      Math.PI
    );
  };
  return (
    <div className={'dial-block dial-motion dial-' + kind +
      (aligned ? ' dial-aligned' : '') + (asleep ? ' dial-paused' : '') +
      (turning ? ' dial-turning' : '')} data-formation={p}>
      <div
        ref={surface}
        className="date-dial"
        role="slider"
        tabIndex={asleep ? -1 : 0}
        aria-label={label}
        aria-disabled={asleep}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={value+label}
        onPointerDown={(e) => {
          if (asleep || e.isPrimary === false || e.button > 0) return;
          drag.current = { a: angle(e), v: value, id: e.pointerId };
          setTurning(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (asleep || !drag.current || drag.current.id !== e.pointerId) return;
          const a = angle(e);
          let d = a - drag.current.a;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          const step = 360 / max;
          if (Math.abs(d) >= step * 0.6) {
            const n = Math.round(d / step),
              v = ((((drag.current.v - 1 + n) % max) + max) % max) + 1;
            onChange(v);
            drag.current = { a, v, id: e.pointerId };
          }
        }}
        onPointerUp={stopTurning}
        onPointerCancel={stopTurning}
        onLostPointerCapture={stopTurning}
        onBlur={stopTurning}
        onKeyDown={(e) => {
          if (asleep) return;
          if (
            ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(e.key)
          ) {
            e.preventDefault();
            onChange(
              ((value -
                1 +
                (['ArrowLeft', 'ArrowDown'].includes(e.key) ? max - 1 : 1)) %
                max) +
                1,
            );
          }
        }}
      >
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <g className="dial-aura" visibility={p===1?'visible':'hidden'}>
            <circle className="dial-aura-wide" cx="120" cy="120" r="63" />
            <circle className="dial-aura-inner" cx="120" cy="120" r="49" />
          </g>
          <circle className="dial-entry-ring" cx="120" cy="120" r="106" transform="rotate(-90 120 120)" {...ring(outer)} />
          <circle className="dial-entry-ring dial-inner-ring" cx="120" cy="120" r="61" transform="rotate(90 120 120)" {...ring(inner)} />
          <g className="dial-orbit dial-orbit-outer" opacity={reading} visibility={reading>0?'visible':'hidden'}>
            <circle className="dial-orbit-arc" cx="120" cy="120" r="113" />
            <circle className="dial-satellite" cx="120" cy="7" r="1.5" />
            <circle className="dial-satellite dial-satellite-dim" cx="218" cy="176" r="1" />
          </g>
          <g className="dial-orbit dial-orbit-inner" opacity={inner} visibility={inner>0?'visible':'hidden'}>
            <circle className="dial-orbit-arc" cx="120" cy="120" r="56" />
            <circle className="dial-satellite" cx="64" cy="120" r="1.3" />
          </g>
          <g
            className="dial-scale"
            style={{
              transform: 'rotate(' + dial.rotation + 'deg)',
              transformOrigin: '120px 120px',
            }}
          >
            {Array.from({ length: max }, (_, i) => {
              const a = ((i + 1) * Math.PI * 2) / max - Math.PI / 2;
              const order=(i+1-value+max)%max;
              const tick=reveal.ticks[order],tip=104-((i+1===value)?10:6)*tick;
              const appearing=reveal.labels[order],radius=82+4*(1-appearing);
              const x=120+radius*Math.cos(a),y=120+radius*Math.sin(a);
              const selected=i+1===value;
              return (
                <g key={i}>
                  <line
                    visibility={tick>0?'visible':'hidden'}
                    x1={120 + tip * Math.cos(a)}
                    y1={120 + tip * Math.sin(a)}
                    x2={120 + 104 * Math.cos(a)}
                    y2={120 + 104 * Math.sin(a)}
                    className={i + 1 === value ? 'dial-active' : i%3===0?'dial-major':''}
                  />
                  <g className="dial-symbol-position" transform={`translate(${x} ${y})`}>
                    <g className="dial-symbol-upright" style={{transform:`rotate(${-dial.rotation}deg)`}}>
                      <text className={'dial-symbol'+(selected?' is-selected':'')} data-value={i+1}
                        textAnchor="middle" dominantBaseline="central" opacity={appearing}
                        visibility={appearing>0?'visible':'hidden'}>
                        {kind==='month'?ZODIAC[i]:String(i+1)}
                      </text>
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
          <path className="dial-pointer" visibility={reveal.pointer>0?'visible':'hidden'} d={`M${120-3*reveal.pointer} 3 ${120+3*reveal.pointer} 3 120 ${3+11*reveal.pointer}Z`} />
        </svg>
        <div className="dial-reading" aria-hidden="true" style={{clipPath:`inset(0 ${(1-reading)*50}% 0 ${(1-reading)*50}%)`}}>
          <strong>{String(value).padStart(2,'0')}</strong>
          <small>{label}</small>
        </div>
      </div>
      <div className="dial-arrows" style={{opacity:reading}}>
        <button
          aria-label={label + '减一'}
          disabled={asleep}
          onClick={() => {if(!asleep)onChange(previous);}}
        >
          −
        </button>
        <span aria-hidden="true" />
        <button
          aria-label={label + '加一'}
          disabled={asleep}
          onClick={() => {if(!asleep)onChange(next);}}
        >
          +
        </button>
      </div>
    </div>
  );
}
