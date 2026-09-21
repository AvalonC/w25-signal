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
const SHORES = [[60, 196], [280, 143], [78, 89], [278, 28]];
const BENDS = [[[116, 185], [232, 202]], [[246, 105], [128, 140]], [[109, 44], [226, 82]]];
const ROUTES = BENDS.map((bend, i) => `M${SHORES[i].join(' ')} C${bend[0].join(' ')} ${bend[1].join(' ')} ${SHORES[i + 1].join(' ')}`);
function position(point: number[]) { return { left: `${point[0] / 3.6}%`, top: `${point[1] / 3}%` }; }

export function EchoRelay({ choices, delivered, paused, onDelivered, onTone, onTouch }: {
  choices: number[]; delivered: number[]; paused: boolean;
  onDelivered: (wish: number) => void; onTone: (ms: number) => void;
  onTouch: (symbol?: '.' | '-') => void;
}) {
  const [relay, setRelay] = useState(freshRelay);
  const [hold, setHold] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [pulse, setPulse] = useState(0);
  const held = useRef<{ at: number; pointer: number | null } | null>(null);
  const raf = useRef(0), finished = useRef(false), keyUsed = useRef(false);
  const callbacks = useRef({ onDelivered, onTone, onTouch });
  callbacks.current = { onDelivered, onTone, onTouch };
  const blocked = paused || hidden;
  const round = Math.min(delivered.length, 2);
  const send = (action: RelayAction) => {
    if (blocked) return;
    setRelay((p) => relayStep(p, action, choices, delivered));
  };
  const companions = [...new Set([...delivered, ...(relay.wish === null ? [] : [relay.wish]), ...(relay.helper === null ? [] : [relay.helper])])];
  const light = wishLight(companions);
  const target = MORSE_CODES[round];
  const listenCode = round === 1 && relay.helper === null ? target.slice(0, 2) : target.slice(relay.listenFrom);
  const timeline = useMemo(() => morseTimeline(listenCode, light.unit), [listenCode, light.unit]);
  const identity = `${relay.phase}-${relay.wish}-${relay.replay}-${relay.draft.length}`;
  const elapsed = useVisibleClock(!blocked && !relay.listeningPaused && relay.phase !== 'choose' && relay.phase !== 'help', identity);
  const pulseElapsed = useVisibleClock(!blocked && pulse > 0, pulse);
  const flash = relay.phase === 'listen' ? timeline.frames.findIndex((f) => elapsed >= f.start + 900 && elapsed < f.end + 900) : -1;
  const echoLit = relay.phase === 'echo' && elapsed >= 620 && elapsed < 620 + light.unit;
  const farLit = flash >= 0 || echoLit || relay.phase === 'cross';
  const next = target[relay.draft.length];
  const glimpse = relay.phase === 'answer' && (light.glimpse || relay.misses >= 2 || relay.draft.length < light.lead || round === 2);
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
    if (flash >= 0 && !blocked && !relay.listeningPaused) callbacks.current.onTone(timeline.frames[flash].end - timeline.frames[flash].start);
  }, [flash, blocked, relay.listeningPaused, timeline]);
  useEffect(() => { if (echoLit && !blocked) callbacks.current.onTone(light.unit); }, [echoLit, blocked, light.unit]);
  useEffect(() => {
    if (blocked || relay.listeningPaused) return;
    if (relay.phase === 'listen' && elapsed >= timeline.duration + 1550)
      setRelay((p) => relayStep(p, { type: 'heard' }, choices, delivered));
    if (relay.phase === 'echo' && elapsed >= 620 + light.unit + 650)
      setRelay((p) => relayStep(p, { type: 'echoed' }, choices, delivered));
    if (relay.phase === 'cross' && elapsed >= 2800 && !finished.current && relay.wish !== null) {
      finished.current = true;
      callbacks.current.onDelivered(relay.wish);
    }
  }, [elapsed, relay.phase, relay.wish, relay.listeningPaused, blocked, choices, delivered, timeline.duration, light.unit]);
  const input = (symbol: '.' | '-') => {
    if (blocked || relay.phase !== 'answer') return;
    callbacks.current.onTouch(symbol); setPulse((p) => p + 1); send({ type: 'send', symbol });
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
  const t = relay.phase === 'cross' ? Math.min(1, elapsed / 2300) : 0, u = 1 - t;
  const near = SHORES[round].map((value, axis) => u*u*u*value + 3*u*u*t*BENDS[round][0][axis] + 3*u*t*t*BENDS[round][1][axis] + t*t*t*SHORES[round + 1][axis]);
  const verse = relay.phase === 'choose'
    ? round === 0 ? '那边有一束光在等你。让一个愿望陪它出发。' : round === 1 ? '已经接通的星路还亮着。再带一个愿望向前。' : '最后一段，两边的光要一起完成。'
    : relay.phase === 'cross' ? `「${selectedName}」到了。星路又向前亮了一段。`
    : relay.phase === 'help' ? '远方的光变模糊了。轻触一颗同行的愿望星，陪它把话说完。'
    : relay.listeningPaused ? '光会在这里等你。'
    : relay.phase === 'echo' ? '轮到远方了。看它把下一束短光送来。'
    : relay.phase === 'listen' ? relay.helper !== null ? `「${NOUNS[relay.helper][0]}」靠近了，远方的光又清楚起来。` : '先看远方的光，把节奏记在心里。'
    : relay.misses ? '没关系。已经点亮的光，还在等你。'
    : hold >= 1 ? '长光已亮。松开，送它过去。'
    : round === 2 ? '这一束轮到你。送一束短光，远方会接着回应。'
    : '远方说完了。现在，把完整的节奏回应给它。';
  return <section className={'echo-relay relay-' + relay.phase + (round === 1 ? ' relay-reversed' : '') + (blocked || relay.listeningPaused ? ' is-paused' : '')} aria-label="把愿望送过星海" data-round={round}>
    <div className="relay-sky">
      <svg className="relay-bridge" viewBox="0 0 360 300" preserveAspectRatio="none" aria-label={`已接通 ${delivered.length} 段星路，共三段`}>
        {ROUTES.map((path, i) => <path key={path} d={path} className={'relay-path' + (i < round ? ' relay-route-complete' : i === round ? ' relay-route-current' : '')} />)}
        {SHORES.map(([x, y], i) => <circle key={i} r={i <= round ? 3 : 2} cx={x} cy={y} className={i <= round ? 'relay-route-stop reached' : 'relay-route-stop'} />)}
        {SHORES.slice(1).map(([x, y], i) => <text key={i} x={x + (i === 1 ? 24 : -28)} y={y + 5} className={'relay-route-letter' + (i < round ? ' lit' : '')}>{i < round ? 'W25'[i] : '·'}</text>)}
      </svg>
      <div className={'relay-far' + (farLit ? ' is-speaking' : '') + (relay.phase === 'help' ? ' is-faint' : '')} style={position(SHORES[round + 1])}>
        <Spark lit={farLit} />
        <span>{relay.phase === 'help' ? '光有些模糊' : relay.phase === 'echo' ? '远方接力' : relay.phase === 'cross' ? '收到了' : '远方的光'}</span>
      </div>
      <button className={'relay-near' + (hold >= 1 ? ' is-long' : '')}
        style={{ ...position(near), '--hold': hold } as CSSProperties} disabled={blocked || relay.phase !== 'answer'}
        aria-label="回应星光：轻按为点，按住至少一秒为划" onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => { keyUsed.current = false; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); begin(e.pointerId); }}
        onPointerUp={(e) => end(e.pointerId)} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { keyUsed.current = true; e.preventDefault(); begin(null); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(null); } }}
        onClick={(e) => { if (e.detail === 0 && !keyUsed.current) input('.'); keyUsed.current = false; }}>
        <Spark lit={hold > 0 || relay.phase === 'cross' || (pulse > 0 && pulseElapsed < light.unit)} />
        <span>{relay.phase === 'cross' ? selectedName : relay.phase === 'answer' ? round === 2 ? '送一束短光 ·' : '轻按 ·　长按 —' : '你与光'}</span>
      </button>
      <fieldset className="wish-hand" aria-label="愿望与同行的光">
        {choices.map((wish, i) => <button key={wish} className={(delivered.includes(wish) ? 'delivered ' : '') + (relay.wish === wish ? 'carried ' : '') + (relay.helper === wish ? 'helping' : '')}
          style={{ left: `${15 + i * 35}%` }} disabled={blocked || (relay.phase !== 'help' && (relay.phase !== 'choose' || delivered.includes(wish)))}
          aria-label={`${NOUNS[wish][0]}。${relay.phase === 'help' ? '帮助远方恢复星光。' : delivered.includes(wish) ? '已经送达，仍在同行。' : WISH_LIGHTS[wish].line}`}
          onClick={() => { callbacks.current.onTouch(); send({ type: relay.phase === 'help' ? 'help' : 'choose', wish }); }}>
          <Spark lit={companions.includes(wish)} /><strong>{NOUNS[wish][0]}</strong>
          <small>{relay.helper === wish ? '陪光接通' : delivered.includes(wish) ? '仍在同行' : relay.wish === wish ? '正在同行' : ''}</small>
        </button>)}
      </fieldset>
    </div>
    <output key={relay.phase} className="relay-verse" aria-live="polite">{verse}</output>
    {relay.phase !== 'choose' && relay.phase !== 'cross' && <>
      <div className="relay-footsteps" aria-label={'已经回应的节奏：' + relay.draft.replaceAll('.', '短 ').replaceAll('-', '长 ')}>
        {target.split('').map((_, i) => <i key={i} className={(i < relay.draft.length ? 'lit ' : '') + (round === 2 && i % 2 === 0 ? 'from-far' : 'from-near')} aria-hidden="true">
          {i < relay.draft.length ? relay.draft[i] === '-' ? '—' : '·' : '·'}
        </i>)}
      </div>
      {glimpse && <p className="relay-next" role="note">下一束：{next === '-' ? '长光' : '短光'}</p>}
      {relay.phase !== 'echo' && <button className="soft-button relay-listen" disabled={blocked} onClick={() => {
        cancel(); silence(); send({ type: relay.phase === 'listen' ? 'pause' : 'replay' });
      }}>{relay.phase === 'listen' ? relay.listeningPaused ? '让光继续' : '让光等一等' : '再听一次远方'}</button>}
      <details className="rhythm-access relay-access">
        <summary>让星光再清楚一些</summary>
        <p>{round === 2 ? '两边轮流送出短光。远方亮起时等它说完，再送出你的短光。' : '看远方的星闪完，再回应完整节奏。轻按是点，按住一秒是划；长光亮起后松手。'}{round === 1 && relay.helper === null ? '光模糊时，轻触下面任意一颗愿望星帮助它。' : ''}</p>
        <p>这一封：{target.replaceAll('.', '· ').replaceAll('-', '— ')}<br />{companions.map((wish) => WISH_LIGHTS[wish].line).join('')}</p>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('.')}>送出短光 ·</button>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('-')}>送出长光 —</button>
      </details>
    </>}
  </section>;
}
