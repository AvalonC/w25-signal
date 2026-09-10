'use client';
// Browser storage initializes after SSR; RAF gesture clocks run only from handlers.
// This imperative scene controller is intentionally outside React Compiler optimization.
/* oxlint-disable react/react-compiler */
// The radial pointer controls and live canvas/SVG scenes require explicit ARIA roles.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
// AR Quick Look requires a native rel=ar anchor with a direct img child.
/* oxlint-disable next/no-html-link-for-pages, next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Volume2,
  VolumeX,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Starfield, WordDust } from './particles';
import { WireBracelet } from './model';
import { SapphireScene } from './sapphire-scene';
import { EchoRelay } from './echo-relay';
import { deliveredWishes } from '@/lib/echo-relay';
import { PrismLight } from './prism-light';
import { PassingMeteor } from './passing-meteor';
import { MOTION, MOTION_STYLE, meteorFlight } from '@/lib/motion';
import { useVisibleClock } from './scene-clock';
import type { StarArrival } from '@/lib/bracelet-transition';
import {
  fresh,
  readSave,
  restart,
  finish,
  MORSE_CODES,
  NOUNS,
  PINK,
  morseTimeline,
  type Journey,
  constellationDelay,
  blessingDuration,
  endingPhase,
} from '@/lib/journey';
import { switchTap, tone, feedback, silence, playBirthday } from '@/lib/feedback';
const POS = [
  [19, 18],
  [47, 10],
  [78, 24],
  [14, 44],
  [34, 37],
  [57, 45],
  [78, 39],
  [86, 57],
  [17, 69],
  [35, 81],
  [53, 68],
  [70, 82],
  [87, 76],
];
const TRAJECTORIES = [
  [34, -13, 34],
  [-28, 12, 31],
  [22, -21, 30],
  [-18, 19, 28],
  [31, 8, 35],
  [-25, -14, 33],
  [17, 23, 29],
  [-33, 6, 36],
  [25, -8, 31],
  [-20, -22, 34],
  [29, 16, 37],
  [-27, 18, 30],
  [18, -17, 32],
];
const HEADINGS = [
  '',
  '想带走的，留在心里。',
  '光里，有你喜欢的颜色。',
  '有的光一闪，有的多留一会。',
  '这一天，你来到世上。',
  '隔着星海，也能听见彼此。',
  '原来，是为了来到你身边。',
];
const NOTES = [
  '',
  '轻轻拖动散落的光，留下三个愿望。',
  '慢慢转动，看看光会在哪里停留。',
  '循着闪光，看看它要去哪里。',
  '转动星盘，找回十月八日的星光。',
  '你带来的愿望，会在路上照亮彼此。',
  '星星、长短的光，还有你喜欢的粉色。',
];
const HINTS = [
  '',
  '按住词的星光并拖动，让它聚拢。选满三个继续。键盘可用 Enter 聚拢并选择。',
  '慢慢转动，让分开的光重新相遇。',
  '跟随闪光触碰前三颗星，组成 W。后面的 2 和 5 会自动接续，随后进入下一幕。',
  '将两个星盘转到 10 月 8 日。星盘汇成光、织出宝石后，持续左右转动它，慢慢读出名字、天秤和粉色之间的联系；也可轻触下方按钮。',
  '先轻触一个愿望。看远方的星闪完，再用下方的星回应：轻按是点，按住一秒是划。答对会自动送达，答错保留已经点亮的部分。送达的愿望仍会帮忙，它们的光可以叠在一起。不便长按时，展开“让星光再清楚一些”。',
  '点击四角星中央那颗粉色宝石，完成这封信。',
  '按住 HBD, Leah 至少 3 秒，星光会带你回到起点。',
];
function Star({ on = false }: { on?: boolean }) {
  return (
    <svg
      className={'four-star ' + (on ? 'lit' : '')}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path d="M50 3 60 40 97 50 60 60 50 97 40 60 3 50 40 40Z" />
    </svg>
  );
}
const ZODIAC = ['♑', '♒', '♓', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐'];
const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
  'XXII',
  'XXIII',
  'XXIV',
  'XXV',
  'XXVI',
  'XXVII',
  'XXVIII',
  'XXIX',
  'XXX',
  'XXXI',
];
function Dial({
  label,
  value,
  max,
  kind,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  kind: 'month' | 'day';
  onChange: (n: number) => void;
}) {
  const drag = useRef<{ a: number; v: number } | null>(null);
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
    <div className="dial-block">
      <div
        className="date-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={(e) => {
          drag.current = { a: angle(e), v: value };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const a = angle(e);
          let d = a - drag.current.a;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          const step = 360 / max;
          if (Math.abs(d) >= step * 0.6) {
            const n = Math.round(d / step),
              v = ((((drag.current.v - 1 + n) % max) + max) % max) + 1;
            onChange(v);
            drag.current = { a, v };
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onBlur={() => (drag.current = null)}
        onKeyDown={(e) => {
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
          <circle cx="120" cy="120" r="106" />
          <circle cx="120" cy="120" r="90" />
          <g
            style={{
              transform: 'rotate(' + (-value * 360) / max + 'deg)',
              transformOrigin: '120px 120px',
            }}
          >
            {Array.from({ length: max }, (_, i) => {
              const a = ((i + 1) * Math.PI * 2) / max - Math.PI / 2;
              return (
                <g key={i}>
                  <line
                    x1={120 + 94 * Math.cos(a)}
                    y1={120 + 94 * Math.sin(a)}
                    x2={120 + 104 * Math.cos(a)}
                    y2={120 + 104 * Math.sin(a)}
                    className={i + 1 === value ? 'dial-active' : ''}
                  />
                  <text
                    x={120 + 80 * Math.cos(a)}
                    y={120 + 80 * Math.sin(a)}
                    className={i + 1 === value ? 'dial-label-active' : 'dial-label'}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {kind === 'month' ? ZODIAC[i] : ROMAN[i + 1]}
                  </text>
                </g>
              );
            })}
          </g>
          <path className="dial-pointer" d="M117 3 123 3 120 15Z" />
        </svg>
        <div>
          <strong>{kind === 'day' ? ROMAN[value] : String(value).padStart(2, '0')}</strong>
          <small>
            {label} {kind === 'month' ? ZODIAC[value - 1] : String(value).padStart(2, '0')}
          </small>
        </div>
      </div>
      <div className="dial-arrows">
        <button
          aria-label={label + '减一'}
          onClick={() => onChange(value === 1 ? max : value - 1)}
        >
          −
        </button>
        <span>转动星盘</span>
        <button
          aria-label={label + '加一'}
          onClick={() => onChange(value === max ? 1 : value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
export default function JourneyGame() {
  const [s, setS] = useState<Journey>(fresh),
    [boot, setBoot] = useState(true),
    [ready, setReady] = useState(false),
    [sound, setSound] = useState(false),
    [help, setHelp] = useState(false),
    [revisit, setRevisit] = useState(false),
    [saveOK, setSaveOK] = useState(true);
  const [pulse, setPulse] = useState(false),
    [loaderProgress, setLoaderProgress] = useState(0),
    [words, setWords] = useState<number[]>(Array(8).fill(0)),
    [prism, setPrism] = useState(16),
    [prismScattering, setPrismScattering] = useState(false);
  const [message, setMessage] = useState('');
  const [ending, setEnding] = useState('project'),
    [charge, setCharge] = useState(0),
    [returning, setReturning] = useState(false),
    [bridge, setBridge] = useState<{ lines: string[]; next: number } | null>(
      null,
    ),
    [bridgeIndex, setBridgeIndex] = useState(0);
  const [reduced, setReduced] = useState(false),
    [modelBurst, setModelBurst] = useState(false);
  const [starArrival, setStarArrival] = useState<StarArrival | null>(null);
  const [flights, setFlights] = useState(() => TRAJECTORIES.map((p) => [...p, 1300]));
  const haptic = useRef<HTMLInputElement>(null),
    nounDrag = useRef<{
      i: number;
      x: number;
      y: number;
      progress: number;
    } | null>(null);
  const endPress = useRef<{ start: number; pointer: number | null } | null>(null),
    holdFrame = useRef(0),
    returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef(sound);
  const choicesAtEntry = useRef(s.choices);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    choicesAtEntry.current = s.choices;
  }, [s.choices]);
  const patch = (v: Partial<Journey>) => setS((p) => ({ ...p, ...v }));
  const tap = () => switchTap(haptic.current, soundRef.current);
  const cancelHold = () => {
    endPress.current = null;
    cancelAnimationFrame(holdFrame.current);
    setCharge(0);
    silence();
  };
  useEffect(() => {
    haptic.current?.setAttribute('switch', '');
    setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      const saved = readSave(
        localStorage.getItem('w25-journey-v2'),
        localStorage.getItem('w25-signal-v1'),
      );
      setS(
        saved.completed && saved.stage === 7 ? { ...saved, stage: 0 } : saved,
      );
    } catch {
      setSaveOK(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem('w25-journey-v2', JSON.stringify(s));
      } catch {
        setSaveOK(false);
      }
  }, [s, ready]);
  useEffect(() => {
    if (!ready || !boot) return;
    const timeline = morseTimeline(MORSE_CODES.join(' '), 180);
    let frame = 0,
      elapsed = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const dt = now - previous;
      previous = now;
      if (!document.hidden) elapsed += Math.min(dt, 80);
      setPulse(
        timeline.frames.some((f) => elapsed >= f.start && elapsed < f.end),
      );
      setLoaderProgress(Math.min(1, elapsed / timeline.duration));
      if (elapsed >= timeline.duration + 250) {
        setBoot(false);
        setPulse(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, boot]);
  // Reset gesture UI only on chapter entry, never during a drag or wish toggle.
  useEffect(() => {
    if (s.stage === 2) { setPrism(16); setPrismScattering(false); }
    if (s.stage === 3) setFlights(TRAJECTORIES.map(() => {
      const f = meteorFlight(); return [f.dx * 30, f.dy * 30, f.length * .65, 1100 + f.duration * .25];
    }));
    setWords(
      choicesAtEntry.current.reduce((a, n) => {
        a[n] = 1;
        return a;
      }, Array(8).fill(0)),
    );
    setMessage('');
    setModelBurst(false);
    cancelHold();
    window.scrollTo(0, 0);
  }, [s.stage]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        cancelHold();
      }
    };
    document.addEventListener('visibilitychange', stop);
    window.addEventListener('blur', cancelHold);
    return () => {
      document.removeEventListener('visibilitychange', stop);
      window.removeEventListener('blur', cancelHold);
      cancelAnimationFrame(holdFrame.current);
      if (returnTimer.current) clearTimeout(returnTimer.current);
      silence();
    };
  }, []);
  useEffect(() => {
    if (!bridge) return;
    let frame = 0,
      elapsed = 0,
      previous = performance.now();
    const durations = bridge.lines.length ? bridge.lines.map(blessingDuration) : [MOTION.release];
    const total = durations.reduce((a, b) => a + b, 0);
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(now - previous, 80);
      previous = now;
      let at = 0,
        index = 0;
      while (index < durations.length - 1 && elapsed >= at + durations[index])
        at += durations[index++];
      setBridgeIndex(index);
      if (elapsed >= total) {
        setS((p) => ({ ...p, stage: bridge.next }));
        setBridge(null);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bridge]);
  useEffect(() => {
    if (boot || help || bridge || s.stage !== 3 || s.stars < 3) return;
    let frame = 0,
      elapsed = 0,
      previous = performance.now();
    const delay = constellationDelay(s.stars);
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(now - previous, 80);
      previous = now;
      if (elapsed >= delay) {
        if (s.stars < 13) setS((p) => ({ ...p, stars: p.stars + 1 }));
        else {
          setBridgeIndex(0);
          setBridge({
            lines: ['有些光，记得你来时的日子。'],
            next: 4,
          });
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [s.stage, s.stars, boot, help, bridge]);
  useEffect(() => {
    if (s.stage !== 7 || returning || boot) return;
    let frame = 0,
      t = 0,
      last = performance.now(),
      lastPulse = -1;
    const timeline = morseTimeline(MORSE_CODES.join(' '), 160);
    const tick = (now: number) => {
      if (!document.hidden) t += Math.min(now - last, 80);
      last = now;
      setEnding(endingPhase(t));
      const n = timeline.frames.findIndex((f) => t >= f.start && t < f.end);
      setPulse(n >= 0);
      if (n >= 0 && n !== lastPulse) {
        feedback(
          timeline.frames[n].end - timeline.frames[n].start,
          false,
        );
        lastPulse = n;
      }
      if (t < 9000) frame = requestAnimationFrame(tick);
      else setPulse(false);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      silence();
    };
  }, [s.stage, returning, boot]);
  useEffect(() => {
    if (s.stage === 7 && !returning && !boot && sound) playBirthday();
    return () => { if (s.stage === 7) silence(); };
  }, [s.stage, returning, boot, sound]);
  const go = (lines: string[], next: number) => {
    cancelHold();
    setBridgeIndex(0);
    setBridge({ lines, next });
  };
  const start = (replay = false) => {
    setStarArrival(null);
    setPrism(16);
    setPrismScattering(false);
    setS((p) => restart(p, replay));
    setRevisit(false);
  };
  const open = () => {
    tap();
    if (s.completed) setRevisit(true);
    else start();
  };
  const selectWord = (i: number) => {
    if (s.replay) return;
    setS((p) => ({
      ...p,
      choices: p.choices.includes(i)
        ? p.choices.filter((n) => n !== i)
        : p.choices.length < 3
          ? [...p.choices, i]
          : p.choices,
    }));
    tap();
  };
  const aligned = Math.abs(prism - 68) <= 2;
  const prismTime = useVisibleClock(s.stage === 2 && prismScattering && !help && !boot && !bridge, s.stage);
  useEffect(() => {
    if (s.stage === 2 && aligned && !prismScattering && !boot) setPrismScattering(true);
  }, [s.stage, aligned, prismScattering, boot]);
  useEffect(() => {
    if (s.stage !== 2 || !prismScattering || prismTime < MOTION.prismBloom || bridge) return;
    patch({ color: true });
    go(['原来，光也记得你喜欢的颜色。'], 3);
  }, [s.stage, prismScattering, prismTime, bridge]);
  const adjustPrism = (n: number) => {
    if (prismScattering || bridge) return;
    const value = Math.max(0, Math.min(100, n));
    if (Math.abs(value - 68) <= 2 && !aligned) tap();
    setPrism(value);
  };
  function returnHome() {
    cancelHold();
    setReturning(true);
    returnTimer.current = setTimeout(
      () => {
        patch({ stage: 0 });
        setReturning(false);
        setEnding('project');
      },
      reduced ? 200 : 1500,
    );
  }
  function beginReturn(pointer: number | null) {
    if (endPress.current || returning) return;
    endPress.current = { start: performance.now(), pointer };
    const tick = () => {
      if (!endPress.current) return;
      const q = (performance.now() - endPress.current.start) / 3000;
      setCharge(Math.min(1, q));
      if (q >= 1) {
        tap();
        returnHome();
        return;
      }
      holdFrame.current = requestAnimationFrame(tick);
    };
    holdFrame.current = requestAnimationFrame(tick);
  }
  const text =
    s.stage === 0 && s.completed
      ? 'Project\nW25'
      : s.stage === 7 && ending === 'hbd'
        ? 'HBD, Leah'
        : s.stage === 7 && ending === 'project'
          ? 'Project\nW25'
          : '';
  return (
    <div
      className={
        'cosmos free-flow ' +
        (boot ? 'booting ' : '') +
        (modelBurst ? 'bracelet-leaving ' : '') +
        (bridge ? 'bridging' : '')
      }
      style={{ '--pink': PINK, ...MOTION_STYLE } as CSSProperties}
    >
      <Starfield
        text={boot ? '' : text}
        burst={returning}
        charge={charge}
        arrival={starArrival}
      />
      <input
        ref={haptic}
        type="checkbox"
        className="haptic-switch"
        tabIndex={-1}
        aria-hidden="true"
      />
      {boot ? (
        <main className="loader" role="status" aria-label="正在接收星光">
          <Star on={reduced || pulse} />
          <span>一封来信，正在穿越星海</span>
          <div className="loading-line">
            <i style={{ width: loaderProgress * 100 + '%' }} />
          </div>
          <button
            className="soft-button"
            onClick={() => {
              setBoot(false);
              setPulse(false);
            }}
          >
            进入星海
          </button>
        </main>
      ) : (
        <>
          <header className="sky-header" inert={!!bridge}>
            <span className="sky-brand">
              ✧ <span>星 间 来 信</span>
            </span>
            <div>
              <button
                aria-label={sound ? '关闭声音' : '开启声音'}
                aria-pressed={sound}
                onClick={() => {
                  setSound((v) => !v);
                  if (!sound) tone(120);
                  else silence();
                }}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              {s.stage > 0 && s.stage < 7 && (
                <button
                  aria-label="查看提示"
                  onClick={() => {
                    cancelHold();
                    setHelp(true);
                  }}
                >
                  <HelpCircle size={18} />
                </button>
              )}
            </div>
          </header>
          {s.stage === 0 ? (
            <button
              className={'start-sky ' + (s.completed ? 'known' : '')}
              aria-label={
                s.completed
                  ? 'Project W25，点击选择重新开始或重温'
                  : '轻触星空，开始旅程'
              }
              onClick={open}
            >
              {!s.completed && (
                <div className="first-whisper">
                  <span>有一束光</span>
                  <span>在等你。</span>
                </div>
              )}
              <span className="start-cue">
                {s.completed
                  ? '旧的星光，也可以有新的相遇。'
                  : '轻触星空，听一听它想说的话。'}
                <small>TOUCH TO BEGIN</small>
              </span>
            </button>
          ) : (
            <main
              key={s.stage}
              inert={!!bridge}
              className={'scene scene-' + s.stage}
            >
              {s.stage < 7 && (
                <div className={'scene-heading ' + (s.stage === 4 && s.stone ? 'date-heading-released' : '')}
                  hidden={s.stage === 2} aria-hidden={s.stage === 4 && s.stone}>
                  <p className="chapter-mark">
                    0{s.stage} <i /> 07
                  </p>
                  <h1>{HEADINGS[s.stage]}</h1>
                  <p>{NOTES[s.stage]}</p>
                </div>
              )}
              {s.stage === 1 && (
                <>
                  <div className="word-cloud">
                    {NOUNS.map(([word, en], i) => (
                      <button
                        key={en}
                        className={
                          'word-nebula ' +
                          (s.choices.includes(i) ? 'chosen' : '')
                        }
                        aria-label={
                          word +
                          (s.choices.includes(i) ? '，已选择' : '，拖动聚拢')
                        }
                        aria-pressed={s.choices.includes(i)}
                        disabled={
                          s.replay ||
                          (s.choices.length === 3 && !s.choices.includes(i))
                        }
                        style={{ '--i': i } as CSSProperties}
                        onPointerDown={(e) => {
                          nounDrag.current = {
                            i,
                            x: e.clientX,
                            y: e.clientY,
                            progress: words[i],
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          const d = nounDrag.current;
                          if (d?.i !== i) return;
                          const p = Math.min(
                            1,
                            d.progress +
                              Math.hypot(e.clientX - d.x, e.clientY - d.y) / 85,
                          );
                          setWords((a) => a.map((n, k) => (k === i ? p : n)));
                        }}
                        onPointerUp={() => {
                          if (nounDrag.current?.i === i) {
                            nounDrag.current = null;
                            if (words[i] >= 0.97) selectWord(i);
                            else
                              setMessage(
                                '按住它，慢慢拖动，让散落的星光聚拢。',
                              );
                          }
                        }}
                        onPointerCancel={() => (nounDrag.current = null)}
                        onClick={(e) => {
                          if (e.detail === 0) {
                            setWords((a) => a.map((n, k) => (k === i ? 1 : n)));
                            selectWord(i);
                          }
                        }}
                      >
                        <WordDust
                          word={word}
                          progress={words[i]}
                          selected={s.choices.includes(i)}
                        />
                        <small aria-hidden="true">{s.choices.includes(i) ? '✧' : ''}</small>
                      </button>
                    ))}
                  </div>
                  <p className="choice-count">
                    <span>
                      {s.replay
                        ? '上次留下的愿望，还在这里。'
                        : s.choices.length === 3 ? '三个愿望，都在身边。' : '还可以留下' + ['三个', '两个', '一个'][s.choices.length] + '愿望。'}
                    </span>
                  </p>
                  <p className="live-message" role="status">
                    {message}
                  </p>
                  <button
                    className="continue"
                    disabled={s.choices.length !== 3}
                    onClick={() =>
                      go(
                        [...s.choices.map((i) => NOUNS[i][2]), '愿望有了归处。再借一束你喜欢的光。'],
                        2,
                      )
                    }
                  >
                    让它们，随我同行 <ArrowRight size={16} />
                  </button>
                </>
              )}
              {s.stage === 2 && (
                <PrismLight value={prism} bloom={prismTime} paused={help || !!bridge || boot} locked={prismScattering}
                  onChange={adjustPrism} />
              )}
              {s.stage === 3 && (
                <>
                  <div className="living-constellation">
                    {POS.map(([x, y], i) => {
                      const dash = MORSE_CODES.join('')[i] === '-';
                      return (
                        <button
                          key={i}
                          style={
                            {
                              left: x + '%',
                              top: y + '%',
                              '--star-delay': (i % 4) * 0.14 + 's',
                              '--drift-x': flights[i][0] + 'px',
                              '--drift-y': flights[i][1] + 'px',
                              '--flight-time': flights[i][3] + 'ms',
                              '--trail-angle':
                                Math.round(
                                  (Math.atan2(
                                    flights[i][1],
                                    flights[i][0],
                                  ) *
                                    180) /
                                    Math.PI,
                                ) + 'deg',
                              '--trail-length': flights[i][2] + 'px',
                            } as CSSProperties
                          }
                          className={
                            'constellation-star ' +
                            (i === s.stars ? 'calling ' : '') +
                            (i < s.stars ? 'found ' : '') +
                            (dash ? 'long' : 'short')
                          }
                          disabled={i !== s.stars || i >= 3 || !!bridge}
                          aria-label={'跟随第 ' + (i + 1) + ' 颗星'}
                          onClick={() => {
                            tap();
                            patch({ stars: s.stars + 1 });
                          }}
                        >
                          <span className="trail" />
                          <span className="star-head">✦</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="constellation-whisper" role="status">
                    {s.stars < 3
                      ? '轻触最明亮的星。'
                      : s.stars < 13
                        ? '它们听见了，正在把光传下去。'
                        : '一瞬是点，停留是划。'}
                  </p>
                </>
              )}
              {s.stage === 4 && (
                <div className={'birth-chapter ' + (s.stone ? 'is-unveiling' : '')}>
                  <div className="date-wheels" inert={s.stone} aria-hidden={s.stone}>
                    <Dial label="月" value={s.month} max={12} kind="month" onChange={(n) => { patch({ month: n }); tap(); }} />
                    <span className="date-dot">·</span>
                    <Dial label="日" value={s.day} max={31} kind="day" onChange={(n) => { patch({ day: n }); tap(); }} />
                  </div>
                  {!s.stone && <>
                    <p className="date-whisper">
                      {s.month === 10 && s.day === 8 ? '十月八日。世界从此，多了一个你。' : '时间转过四季，停在你到来的那天。'}
                    </p>
                    <button className="continue" disabled={s.month !== 10 || s.day !== 8}
                      onClick={() => { tap(); patch({ stone: true }); }}>
                      拾起这一天的星光 <ArrowRight size={16} />
                    </button>
                  </>}
                  {s.stone && <SapphireScene rotation={s.rotation} paused={help || boot || !!bridge}
                    onProgress={(rotation) => patch({ rotation })} onTap={tap}
                    onDone={() => { patch({ rotation: 150, stage: 5 }); }} />}
                </div>
              )}
              {s.stage === 5 && (
                s.decoded < 3 ? <EchoRelay key={s.decoded} choices={s.choices}
                  delivered={deliveredWishes(s.choices, s.decoded, s.echoWishes)} paused={help || boot || !!bridge}
                  onTone={(ms) => { if (soundRef.current) tone(ms); }}
                  onTouch={(symbol) => { if (symbol) feedback(symbol === '.' ? 30 : 140, soundRef.current); else tap(); }}
                  onDelivered={(wish) => setS((p) => ({
                    ...p, decoded: p.decoded + 1,
                    echoWishes: [...deliveredWishes(p.choices, p.decoded, p.echoWishes), wish],
                  }))} />
                : <div className="relay-arrived">
                  <p className="relay-address">W25</p>
                  <p className="reveal-copy">
                    一瞬是点，停留是划。<br />
                    这叫摩尔斯电码。<br />
                    你送出的三个愿望，已在这里相遇。
                  </p>
                  <p className="arrived-wishes">{s.choices.map((i) => NOUNS[i][0]).join(' · ')}</p>
                  <button className="continue" onClick={() => go(
                    ['把喜欢的颜色、到来的日子，和想带走的愿望，留在身边。'], 6)}>
                    看看光的另一面 <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {s.stage === 6 && (
                <>
                  <WireBracelet
                    paused={help || !!bridge}
                    onScatter={() => {
                      tap();
                      setModelBurst(true);
                    }}
                    onGem={(arrival) => {
                      cancelHold();
                      setStarArrival(arrival);
                      setModelBurst(false);
                      setEnding('project');
                      setS((p) => finish(p));
                    }}
                  />
                </>
              )}
              {s.stage === 7 && (
                <div
                  className={'ending-screen ' + (pulse ? 'pulse-ending' : '')}
                >
                  <h1 className="sr-only">
                    {ending === 'hbd' ? 'HBD, Leah' : 'Project W25'}
                  </h1>
                  {ending === 'hbd' && !returning && (
                    <>
                      <p className="ending-blessing">
                        {s.choices.map((i) => NOUNS[i][0]).join('、')}。<br />愿你留下的，往后的每一年都在身边。
                      </p>
                      <button
                        className="ending-hold"
                        aria-label="按住 HBD, Leah 三秒，回到开始屏"
                        onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          beginReturn(e.pointerId);
                        }}
                        onPointerUp={cancelHold}
                        onPointerCancel={cancelHold}
                        onKeyDown={(e) => {
                          if (
                            (e.key === ' ' || e.key === 'Enter') &&
                            !e.repeat
                          ) {
                            e.preventDefault();
                            beginReturn(null);
                          }
                        }}
                        onKeyUp={cancelHold}
                      >
                        <span className="sr-only">HBD, Leah</span>
                      </button>
                      <p className="ending-cue">
                        {charge > 0
                          ? '星光正在回应你的指尖…'
                          : '把手指停在这句话上，让星光慢慢散开。'}
                      </p>
                      <div className="return-progress">
                        <i style={{ width: charge * 100 + '%' }} />
                      </div>
                      <button
                        className="soft-button accessible-return"
                        onClick={returnHome}
                      >
                        轻触返回
                      </button>
                    </>
                  )}
                </div>
              )}
            </main>
          )}
          {bridge && (
            <div className="blessing-current" role="status" aria-live="polite">
              {bridge.lines.length > 0 && <p
                key={bridgeIndex}
                style={
                  {
                    '--phrase-time':
                      blessingDuration(bridge.lines[bridgeIndex]) + 'ms',
                  } as CSSProperties
                }
              >
                {bridge.lines[bridgeIndex]}
              </p>}
              <PassingMeteor paused={help} />
            </div>
          )}
          {!saveOK && (
            <p className="storage-note" role="status">
              当前浏览器无法保存旅程，请保持页面打开。
            </p>
          )}
          <Dialog open={revisit} onOpenChange={setRevisit}>
            <DialogContent className="sky-dialog">
              <DialogTitle>又见面了，Leah。</DialogTitle>
              <DialogDescription>
                上一次的愿望，还在这片星空里。你想如何开始？
              </DialogDescription>
              <button className="continue" onClick={() => start(true)}>
                重温之前的选择 <ArrowRight size={16} />
              </button>
              <button className="soft-button" onClick={() => start(false)}>
                重新开始，选择新的愿望
              </button>
              <DialogClose className="soft-button">再看一会星空</DialogClose>
            </DialogContent>
          </Dialog>
          <Dialog open={help} onOpenChange={setHelp}>
            <DialogContent className="sky-dialog">
              <DialogTitle>让星光再亮一点</DialogTitle>
              <DialogDescription>{HINTS[s.stage]}</DialogDescription>
              <DialogClose className="continue">继续寻找</DialogClose>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
