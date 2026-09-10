'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MORSE_CODES, NOUNS, morseTimeline, symbolFromHold } from '@/lib/journey';
import { freshRelay, relayStep, wishLight, WISH_LIGHTS, type RelayAction } from '@/lib/echo-relay';
import { silence } from '@/lib/feedback';
import { useVisibleClock } from './scene-clock';

function Spark({ lit = false }: { lit?: boolean }) {
  return <svg className={'relay-spark' + (lit ? ' is-lit' : '')} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 5 58 41 95 50 58 59 50 95 42 59 5 50 42 41Z" />
  </svg>;
}

export function EchoRelay({ choices, delivered, paused, onDelivered, onTone, onTouch }: {
  choices: number[]; delivered: number[]; paused: boolean;
  onDelivered: (wish: number) => void; onTone: (ms: number) => void;
  onTouch: (symbol?: '.' | '-') => void;
}) {
  const [relay, setRelay] = useState(freshRelay);
  const [hold, setHold] = useState(0);
  const [hidden, setHidden] = useState(false);
  const held = useRef<{ at: number; pointer: number | null } | null>(null);
  const raf = useRef(0), finished = useRef(false);
  const callbacks = useRef({ onDelivered, onTone, onTouch });
  callbacks.current = { onDelivered, onTone, onTouch };
  const blocked = paused || hidden;
  const send = (action: RelayAction) => {
    if (blocked) return;
    setRelay((p) => relayStep(p, action, choices, delivered));
  };
  const light = wishLight(relay.wish === null ? delivered : [...delivered, relay.wish]);
  const target = MORSE_CODES[delivered.length];
  const timeline = useMemo(() => morseTimeline(target, light.unit), [target, light.unit]);
  const elapsed = useVisibleClock(!blocked && relay.phase !== 'choose', `${relay.phase}-${relay.wish}-${relay.replay}`);
  const flash = relay.phase === 'listen' ? timeline.frames.findIndex((f) => elapsed >= f.start + 1600 && elapsed < f.end + 1600) : -1;
  const next = target[relay.draft.length];
  const glimpse = relay.phase === 'answer' && (light.glimpse || relay.misses >= 2);
  const cancel = () => { held.current = null; cancelAnimationFrame(raf.current); setHold(0); };
  useEffect(() => {
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) { cancel(); silence(); }
    };
    const blur = () => { cancel(); silence(); };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      cancelAnimationFrame(raf.current); silence();
    };
  }, []);
  useEffect(() => { if (blocked) { cancel(); silence(); } }, [blocked]);
  useEffect(() => {
    if (flash >= 0 && !blocked) callbacks.current.onTone(timeline.frames[flash].end - timeline.frames[flash].start);
  }, [flash, blocked, timeline]);
  useEffect(() => {
    if (blocked) return;
    if (relay.phase === 'listen' && elapsed >= timeline.duration + 2300)
      setRelay((p) => relayStep(p, { type: 'heard' }, choices, delivered));
    if (relay.phase === 'cross' && elapsed >= 2800 && !finished.current && relay.wish !== null) {
      finished.current = true;
      callbacks.current.onDelivered(relay.wish);
    }
  }, [elapsed, relay.phase, relay.wish, blocked, choices, delivered, timeline.duration]);
  const input = (symbol: '.' | '-') => {
    if (blocked || relay.phase !== 'answer') return;
    callbacks.current.onTouch(symbol); send({ type: 'send', symbol });
  };
  const begin = (pointer: number | null) => {
    if (blocked || relay.phase !== 'answer' || held.current) return;
    held.current = { at: performance.now(), pointer };
    const tick = () => {
      if (!held.current) return;
      setHold(Math.min(1, (performance.now() - held.current.at) / 1000));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const end = (pointer: number | null) => {
    const gesture = held.current;
    if (!gesture || gesture.pointer !== pointer) return;
    const symbol = symbolFromHold(performance.now() - gesture.at);
    cancel(); input(symbol);
  };
  const selectedName = relay.wish === null ? '' : NOUNS[relay.wish][0];
  const seed = Math.min(light.lead, target.length - 1);
  const reverse = delivered.length === 1;
  const t = reverse ? 1 - Math.min(1, elapsed / 2000) : Math.min(1, elapsed / 2000), u = 1 - t;
  const path = reverse ? 'M278 48 C264 164 86 118 82 205' : 'M82 205 C86 118 264 164 278 48';
  const x = u*u*u*82 + 3*u*u*t*86 + 3*u*t*t*264 + t*t*t*278;
  const y = u*u*u*205 + 3*u*u*t*118 + 3*u*t*t*164 + t*t*t*48;
  const verse = relay.phase === 'choose'
    ? delivered.length === 1 ? '换一边看星海。刚送达的愿望，也在为你照路。' : delivered.length ? '送达的愿望，会陪下一束光同行。' : '把三个愿望，送到星海的另一边。'
    : relay.phase === 'cross' ? `「${selectedName}」到了。`
    : relay.phase === 'listen' ? WISH_LIGHTS[relay.wish!].line
    : relay.misses ? '没关系。已经点亮的光，还在等你。'
    : hold >= 1 ? '长光已亮。松开，送它过去。'
    : seed > 0 && relay.draft.length === seed ? `愿望已替你送出开头的${['', '一', '两', '三'][seed]}束光。接着回应余下的节奏。`
    : '远方说完了。现在，让指尖接住它的节奏。';
  return <section className={'echo-relay relay-' + relay.phase + (reverse ? ' relay-reversed' : '') + (blocked ? ' is-paused' : '')} aria-label="把愿望送过星海">
    <div className="relay-sky">
      <svg className="relay-bridge" viewBox="0 0 360 260" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} className="relay-path" />
        <path d={path} className="relay-path-lit" pathLength="1"
          style={{ strokeDasharray: `${relay.draft.length / target.length} 1` }} />
        {relay.phase === 'cross' && <circle r="2.2" cx={x} cy={y} className="relay-traveler" />}
      </svg>
      <div className={'relay-far' + (flash >= 0 || relay.phase === 'cross' ? ' is-speaking' : '')}>
        <Spark lit={flash >= 0 || relay.phase === 'cross'} />
        <span>{relay.phase === 'listen' ? '远方的来信' : relay.phase === 'cross' ? '收到了' : '星海的那一边'}</span>
        <div className="relay-landmarks" aria-label={`已读出 ${'W25'.slice(0, delivered.length) || '零个字母'}`}>
          {'W25'.split('').map((letter, i) => <i key={letter} className={i < delivered.length ? 'lit' : ''}>
            {i < delivered.length ? letter : '·'}
          </i>)}
        </div>
      </div>
      <button className={'relay-near' + (hold >= 1 ? ' is-long' : '')}
        style={{ '--hold': hold } as CSSProperties} disabled={blocked || relay.phase !== 'answer'}
        aria-label="回应星光：轻按为点，按住至少一秒为划" onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); begin(e.pointerId); }}
        onPointerUp={(e) => end(e.pointerId)} onPointerCancel={cancel} onLostPointerCapture={cancel}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(null); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(null); } }}
        onClick={(e) => { if (e.detail === 0) input('.'); }}>
        <Spark lit={hold > 0 || relay.phase === 'cross' || (flash >= 0 && flash < seed)} />
        <span>{relay.phase === 'choose' ? '你的三个愿望' : relay.phase === 'listen' ? '静静听' : relay.phase === 'cross' ? selectedName : '轻按 ·　长按 —'}</span>
      </button>
      {glimpse && <span className="relay-glimpse" aria-label={'下一束是' + (next === '-' ? '长光' : '短光')}>
        {next === '-' ? '—' : '·'}
      </span>}
    </div>
    <output key={relay.phase} className="relay-verse">{verse}</output>
    {relay.phase === 'choose' && <p className="relay-invitation">轻触一个愿望，让它先走。</p>}
    <fieldset className="wish-hand" aria-label="愿望与同行的光">
      {choices.map((wish) => <button key={wish} className={(delivered.includes(wish) ? 'delivered ' : '') + (relay.wish === wish ? 'carried' : '')}
        disabled={blocked || relay.phase !== 'choose' || delivered.includes(wish)}
        aria-label={`${NOUNS[wish][0]}。${delivered.includes(wish) ? '已经送达，仍在同行。' : WISH_LIGHTS[wish].line}`}
        onClick={() => { callbacks.current.onTouch(); send({ type: 'choose', wish }); }}>
        <span aria-hidden="true">✧</span><strong>{NOUNS[wish][0]}</strong>
        <small>{delivered.includes(wish) ? '仍在同行' : WISH_LIGHTS[wish].kind === 'lead' ? '捎去一束光' : WISH_LIGHTS[wish].kind === 'linger' ? '让回声慢些' : '留下光的轮廓'}</small>
      </button>)}
    </fieldset>
    {relay.phase !== 'choose' && relay.phase !== 'cross' && <>
      <div className="relay-footsteps" aria-label={'已经回应的节奏：' + relay.draft.replaceAll('.', '短 ').replaceAll('-', '长 ')}>
        {target.split('').map((_, i) => <i key={i} className={i < relay.draft.length ? 'lit' : ''} aria-hidden="true">
          {i < relay.draft.length ? relay.draft[i] === '-' ? '—' : '·' : '·'}
        </i>)}
      </div>
      <button className="soft-button relay-listen" disabled={blocked} onClick={() => {
        cancel(); silence(); send({ type: relay.phase === 'listen' ? 'pause' : 'replay' });
      }}>{relay.phase === 'listen' ? '让光等一等' : '再听一次远方'}</button>
      <details className="rhythm-access relay-access">
        <summary>让星光再清楚一些</summary>
        <p>看远方的星闪完，再回应相同的节奏。轻按是点，按住一秒是划；长光亮起后松手。愿望会替你点亮开头，或让来信更清楚。</p>
        <p>这一封：{target.replaceAll('.', '· ').replaceAll('-', '— ')}</p>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('.')}>送出短光 ·</button>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('-')}>送出长光 —</button>
      </details>
    </>}
  </section>;
}
