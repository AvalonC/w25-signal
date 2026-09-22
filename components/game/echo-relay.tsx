'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CircleHelp, Pause, Play, RotateCcw, X } from 'lucide-react';
import { MORSE_CODES, NOUNS, morseTimeline, symbolFromHold } from '@/lib/journey';
import { freshRelay, relayStep, wishLight, WISH_LIGHTS, type RelayAction } from '@/lib/echo-relay';
import { silence } from '@/lib/feedback';
import { useVisibleClock } from './scene-clock';
import { RELAY_SHORES as SHORES, RELAY_ROUTES as ROUTES, RELAY_MARKS, RELAY_WISHES, relayArrival, relayCurve } from '@/lib/relay-motion';

function Spark({ lit = false }: { lit?: boolean }) {
  return <svg className={'relay-spark' + (lit ? ' is-lit' : '')} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M50 5 58 41 95 50 58 59 50 95 42 59 5 50 42 41Z" />
  </svg>;
}
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
  const [reduced, setReduced] = useState(false), [access, setAccess] = useState(false);
  const [arrived, setArrived] = useState(delivered.length > 0);
  const accessDialog = useRef<HTMLDialogElement>(null);
  const held = useRef<{ at: number; pointer: number | null } | null>(null);
  const raf = useRef(0), finished = useRef(false), keyUsed = useRef(false);
  const callbacks = useRef({ onDelivered, onTone, onTouch });
  callbacks.current = { onDelivered, onTone, onTouch };
  const round = Math.min(delivered.length, 2);
  const entryElapsed = useVisibleClock(!paused && !hidden && !arrived);
  const entry = relayArrival(entryElapsed, reduced);
  const blocked = paused || hidden || !arrived;
  const clockBlocked = blocked || access;
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
  const elapsed = useVisibleClock(!clockBlocked && !relay.listeningPaused && relay.phase !== 'choose' && relay.phase !== 'help', identity);
  const pulseElapsed = useVisibleClock(!clockBlocked && pulse > 0, pulse);
  const flash = relay.phase === 'listen' ? timeline.frames.findIndex((f) => elapsed >= f.start + 900 && elapsed < f.end + 900) : -1;
  const echoLit = relay.phase === 'echo' && elapsed >= 620 && elapsed < 620 + light.unit;
  const farLit = flash >= 0 || echoLit || relay.phase === 'cross';
  const next = target[relay.draft.length];
  const glimpse = relay.phase === 'answer' && (light.glimpse || relay.misses >= 2 || relay.draft.length < light.lead || round === 2);
  const cancel = () => { held.current = null; cancelAnimationFrame(raf.current); setHold(0); };
  useEffect(() => { if (entry.ready && !paused && !hidden) setArrived(true); }, [entry.ready, paused, hidden]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(!!media?.matches);
    changed(); media?.addEventListener('change', changed);
    return () => media?.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const dialog = accessDialog.current;
    if (access && !dialog?.open) dialog?.showModal();
    if (!access && dialog?.open) dialog.close();
  }, [access]);
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
  useEffect(() => { if (clockBlocked) { cancel(); silence(); } }, [clockBlocked]);
  useEffect(() => {
    if (flash >= 0 && !clockBlocked && !relay.listeningPaused) callbacks.current.onTone(timeline.frames[flash].end - timeline.frames[flash].start);
  }, [flash, clockBlocked, relay.listeningPaused, timeline]);
  useEffect(() => { if (echoLit && !clockBlocked) callbacks.current.onTone(light.unit); }, [echoLit, clockBlocked, light.unit]);
  useEffect(() => {
    if (clockBlocked || relay.listeningPaused) return;
    if (relay.phase === 'listen' && elapsed >= timeline.duration + 1550)
      setRelay((p) => relayStep(p, { type: 'heard' }, choices, delivered));
    if (relay.phase === 'echo' && elapsed >= 620 + light.unit + 650)
      setRelay((p) => relayStep(p, { type: 'echoed' }, choices, delivered));
    if (relay.phase === 'cross' && elapsed >= (reduced ? 850 : 2800) && !finished.current && relay.wish !== null) {
      finished.current = true;
      callbacks.current.onDelivered(relay.wish);
    }
  }, [elapsed, relay.phase, relay.wish, relay.listeningPaused, clockBlocked, choices, delivered, timeline.duration, light.unit, reduced]);
  const input = (symbol: '.' | '-') => {
    if (blocked || relay.phase !== 'answer') return;
    callbacks.current.onTouch(symbol); setAccess(false); setPulse((p) => p + 1); send({ type: 'send', symbol });
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
  const t = relay.phase === 'cross' ? Math.min(1, elapsed / (reduced ? 450 : 2300)) : 0;
  const near = arrived ? relayCurve(round, t) : entry.main;
  const verse = !arrived ? '循着宝石留下的粉光，走近远方。'
    : relay.phase === 'choose' ? '轻触下方一颗愿望星，让它先走。'
    : relay.phase === 'cross' ? `「${selectedName}」到了。跟着光，向前走。`
    : relay.phase === 'help' ? '远方模糊了。轻触下方愿望星，帮它照亮。'
    : relay.listeningPaused ? '光会在这里等你。'
    : relay.phase === 'echo' ? '看远方的蓝光，等它把这一束送来。'
    : relay.phase === 'listen' ? relay.helper !== null ? `「${NOUNS[relay.helper][0]}」照亮了远方。看它闪完。` : '看标着“远方”的星，记住长短节奏。'
    : relay.misses ? '已经点亮的还在。接着回应下一束。'
    : hold >= 1 ? '长光已亮。松开，送它过去。'
    : round === 2 ? '轮到你。轻点标着“你”的粉光。'
    : '轮到你。轻点粉光是短，按住一秒是长。';
  const subline = !arrived ? '三个愿望，也会陪你停在这里。' : relay.phase === 'choose' ? round === 0 ? '第一段，听远方，再完整回应。' : round === 1 ? '第二段，愿望会帮另一岸恢复光。' : '最后一段，你与远方轮流送短光。'
    : relay.phase === 'answer' ? '按住后松手，才会送出这一束。' : relay.phase === 'listen' ? '等它说完，再回应同样的节奏。' : relay.phase === 'help' ? '已经送达的愿望，也能帮忙。' : '';
  return <section className={'echo-relay relay-' + (arrived ? relay.phase : 'arrival') + (round === 1 ? ' relay-reversed' : '') + (clockBlocked || relay.listeningPaused ? ' is-paused' : '')} aria-label="把愿望送过星海" data-round={round}>
    <div className="relay-guidance"><output className="relay-verse" aria-live="polite">{verse}</output><p className="relay-subline">{subline || '\u00a0'}</p></div>
    <div className="relay-sky">
      <svg className="relay-bridge" viewBox="0 0 360 300" preserveAspectRatio="none" aria-label={`已接通 ${delivered.length} 段星路，共三段`}>
        {ROUTES.map((path, i) => <path key={path} d={path} className={'relay-path' + (i < round ? ' relay-route-complete' : i === round ? ' relay-route-current' : '')} />)}
        {SHORES.map(([x, y], i) => <circle key={i} r={i <= round ? 3 : 2} cx={x} cy={y} className={i <= round ? 'relay-route-stop reached' : 'relay-route-stop'} />)}
        {SHORES.slice(1).map(([x, y], i) => <text key={i} x={x + (i === 1 ? 24 : -28)} y={y + 5} className={'relay-route-letter' + (i < round ? ' lit' : '')}>{i < round ? 'W25'[i] : '·'}</text>)}
        {RELAY_MARKS.filter((mark) => mark.round < round || mark.round === round && mark.index < relay.draft.length).map((mark) => <line key={`${mark.round}-${mark.index}`} className="relay-sent-mark"
          x1={mark.point[0] - (mark.symbol === '-' ? 7 : 0)} y1={mark.point[1]} x2={mark.point[0] + (mark.symbol === '-' ? 7 : .1)} y2={mark.point[1]} />)}
        {!arrived && <path className="relay-entry-trail" d="M230 132 Q128 120 60 203" style={{ opacity: entry.trail }} />}
      </svg>
      <div className={'relay-far' + (farLit ? ' is-speaking' : '') + (relay.phase === 'help' ? ' is-faint' : '')} style={position(SHORES[round + 1])}>
        <Spark lit={farLit} />
        <span>{relay.phase === 'help' ? '远方 · 有些模糊' : relay.phase === 'echo' ? '远方 · 正在回应' : relay.phase === 'cross' ? '收到了' : '远方'}</span>
      </div>
      <button className={'relay-near' + (hold >= 1 ? ' is-long' : '')}
        style={{ ...position(near), '--hold': hold } as CSSProperties} disabled={blocked || relay.phase !== 'answer'}
        aria-label="回应星光：轻按为点，按住至少一秒为划" onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => { keyUsed.current = false; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); begin(e.pointerId); }}
        onPointerUp={(e) => end(e.pointerId)} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { keyUsed.current = true; e.preventDefault(); begin(null); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(null); } }}
        onClick={(e) => { if (e.detail === 0 && !keyUsed.current) input('.'); keyUsed.current = false; }}>
        <Spark lit={!arrived || hold > 0 || relay.phase === 'cross' || (pulse > 0 && pulseElapsed < light.unit)} />
        <span>{relay.phase === 'cross' ? selectedName : relay.phase === 'answer' ? round === 2 ? '你 · 轻点短光' : '你 · 轻点或按住' : '你'}</span>
      </button>
      <fieldset className="wish-hand" aria-label="愿望与同行的光">
        {choices.map((wish, i) => <button key={wish} className={(delivered.includes(wish) ? 'delivered ' : '') + (relay.wish === wish ? 'carried ' : '') + (relay.helper === wish ? 'helping' : '')}
          style={{ ...position(arrived ? RELAY_WISHES[i] : entry.companions[i]), '--wish-label': arrived ? 1 : entry.settle } as CSSProperties} disabled={blocked || (relay.phase !== 'help' && (relay.phase !== 'choose' || delivered.includes(wish)))}
          aria-label={`${NOUNS[wish][0]}。${relay.phase === 'help' ? '帮助远方恢复星光。' : delivered.includes(wish) ? '已经送达，仍在同行。' : WISH_LIGHTS[wish].line}`}
          onClick={() => { callbacks.current.onTouch(); send({ type: relay.phase === 'help' ? 'help' : 'choose', wish }); }}>
          <Spark lit={companions.includes(wish)} /><strong>{NOUNS[wish][0]}</strong>
          <small>{relay.helper === wish ? '陪光接通' : delivered.includes(wish) ? '仍在同行' : relay.wish === wish ? '正在同行' : ''}</small>
        </button>)}
      </fieldset>
    </div>
    <div className="relay-console">
    <div className="relay-readback">
      <div className="relay-footsteps" aria-label={'已经回应的节奏：' + relay.draft.replaceAll('.', '短 ').replaceAll('-', '长 ')}>
        {target.split('').map((_, i) => <i key={i} className={(i < relay.draft.length ? 'lit ' : '') + (round === 2 && i % 2 === 0 ? 'from-far' : 'from-near')} aria-hidden="true">
          {i < relay.draft.length ? relay.draft[i] === '-' ? '—' : '·' : '·'}
        </i>)}
      </div>
      <p className="relay-next" role="note">{glimpse ? `下一束：${next === '-' ? '长光' : '短光'}` : '\u00a0'}</p>
    </div>
    <div className="relay-tools">
      <button className="relay-listen" title={relay.phase === 'listen' ? relay.listeningPaused ? '让光继续' : '让光等一等' : '再听一次远方'} aria-label={relay.phase === 'listen' ? relay.listeningPaused ? '让光继续' : '让光等一等' : '再听一次远方'} disabled={blocked || relay.phase === 'echo' || relay.phase === 'choose' || relay.phase === 'cross'} onClick={() => {
        cancel(); silence(); send({ type: relay.phase === 'listen' ? 'pause' : 'replay' });
      }}>{relay.phase === 'listen' ? relay.listeningPaused ? <Play size={18} /> : <Pause size={18} /> : <RotateCcw size={18} />}<span>{relay.phase === 'listen' ? relay.listeningPaused ? '继续' : '等一等' : '再听'}</span></button>
      <button className="relay-help-button" title="回应方法与辅助按钮" aria-label="回应方法与辅助按钮" disabled={blocked} onClick={() => { cancel(); silence(); setAccess(true); }}><CircleHelp size={18} /><span>回应方法</span></button>
    </div>
    </div>
      <dialog ref={accessDialog} className="relay-access-dialog" aria-labelledby="relay-help-title" onCancel={() => setAccess(false)} onClose={() => setAccess(false)}>
        <button className="relay-access-close" aria-label="关闭回应方法" onClick={() => setAccess(false)}><X size={20} /></button>
        <h2 id="relay-help-title">让星光更清楚一些</h2>
        <p>{round === 2 ? '两边轮流送出短光。远方亮起时等它说完，再送出你的短光。' : '看远方的星闪完，再回应完整节奏。轻按是点，按住一秒是划；长光亮起后松手。'}{round === 1 && relay.helper === null ? '光模糊时，轻触下面任意一颗愿望星帮助它。' : ''}</p>
        <p>这一封：{target.replaceAll('.', '· ').replaceAll('-', '— ')}<br />{companions.map((wish) => WISH_LIGHTS[wish].line).join('')}</p>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('.')}>送出短光 ·</button>
        <button disabled={blocked || relay.phase !== 'answer'} onClick={() => input('-')}>送出长光 —</button>
      </dialog>
  </section>;
}
