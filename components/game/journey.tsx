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
  RotateCcw,
  Play,
  Pause,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Starfield, WordDust } from './particles';
import { WireBracelet, Sapphire } from './model';
import {
  fresh,
  readSave,
  restart,
  finish,
  MORSE_CODES,
  NOUNS,
  PINK,
  symbolFromHold,
  prefixOK,
  morseTimeline,
  type Journey,
  constellationDelay,
  blessingDuration,
} from '@/lib/journey';
import { switchTap, tone, feedback, silence } from '@/lib/feedback';
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
const HEADINGS = [
  '',
  '把想要的未来，聚拢。',
  '把白光，转成你。',
  '一瞬，或停留。',
  '世界记住了这一天。',
  '现在，轮到你回应。',
  '原来星光，有这样的形状。',
];
const NOTES = [
  '',
  '拖动一团星光，让它聚成一个词。选三个就好。',
  '慢慢转动棱镜，找到那一束属于你的粉色。',
  '只需唤醒最初三颗星，余下的光会自己前行。',
  '拨动两枚星盘，让日期停在 10 月 9 日。',
  '看星星说话，再用你的指尖回答。',
  '这些短与长，都是你刚刚读懂的语言。',
];
const HINTS = [
  '',
  '按住词的星光并拖动，让它聚拢。选满三个继续。键盘可用 Enter 聚拢并选择。',
  '将棱镜转到 68° 附近，粉色对齐后轻触“留下这束光”。',
  '跟随闪光触碰前三颗星，组成 W。后面的 2 和 5 会自动接续，随后进入下一幕。',
  '拖动两个星盘到 10 月 9 日，也可以点击加减。得到宝石后，拖动它发现三道光。',
  '短按是点；按住 1 秒以上是划。看完一组再回应。按错可撤回，或展开“换一种方式回应”。',
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
function Dial({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
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
        <svg viewBox="0 0 180 180" aria-hidden="true">
          <circle cx="90" cy="90" r="78" />
          <circle cx="90" cy="90" r="65" />
          <g
            style={{
              transform: 'rotate(' + (-value * 360) / max + 'deg)',
              transformOrigin: '90px 90px',
            }}
          >
            {Array.from({ length: max }, (_, i) => {
              const a = ((i + 1) * Math.PI * 2) / max - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1={90 + 69 * Math.cos(a)}
                  y1={90 + 69 * Math.sin(a)}
                  x2={90 + 76 * Math.cos(a)}
                  y2={90 + 76 * Math.sin(a)}
                  className={i + 1 === value ? 'dial-active' : ''}
                />
              );
            })}
          </g>
          <path className="dial-pointer" d="M87 2 93 2 90 13Z" />
        </svg>
        <div>
          <strong>{String(value).padStart(2, '0')}</strong>
          <small>{label}</small>
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
    [prism, setPrism] = useState(16);
  const [draft, setDraft] = useState(''),
    [message, setMessage] = useState(''),
    [echoIntro, setEchoIntro] = useState(true),
    [playing, setPlaying] = useState(false),
    [sequence, setSequence] = useState(0),
    [hold, setHold] = useState(0);
  const [ending, setEnding] = useState('scatter'),
    [charge, setCharge] = useState(0),
    [returning, setReturning] = useState(false),
    [bridge, setBridge] = useState<{ lines: string[]; next: number } | null>(
      null,
    ),
    [bridgeIndex, setBridgeIndex] = useState(0);
  const [reduced, setReduced] = useState(false),
    [modelBurst, setModelBurst] = useState(false);
  const haptic = useRef<HTMLInputElement>(null),
    nounDrag = useRef<{
      i: number;
      x: number;
      y: number;
      progress: number;
    } | null>(null),
    gemDrag = useRef<{ x: number; y: number } | null>(null),
    prismDrag = useRef<number | null>(null);
  const echoPress = useRef<{ start: number; pointer: number | null } | null>(
      null,
    ),
    endPress = useRef<{ start: number; pointer: number | null } | null>(null),
    holdFrame = useRef(0),
    returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const patch = (v: Partial<Journey>) => setS((p) => ({ ...p, ...v }));
  const tap = () => switchTap(haptic.current, soundRef.current);
  const cancelHold = () => {
    echoPress.current = null;
    endPress.current = null;
    cancelAnimationFrame(holdFrame.current);
    setHold(0);
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
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setWords(
      s.choices.reduce((a, n) => {
        a[n] = 1;
        return a;
      }, Array(8).fill(0)),
    );
    setDraft('');
    setMessage('');
    setEchoIntro(true);
    setPlaying(false);
    setModelBurst(false);
    cancelHold();
    window.scrollTo(0, 0);
  }, [s.stage]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) {
        cancelHold();
        setPlaying(false);
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
    const durations = bridge.lines.map(blessingDuration);
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
            lines: ['你只点亮了开头，星光便替你走向更远的地方。'],
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
    if (s.stage !== 5 || !playing) return;
    const t = morseTimeline(MORSE_CODES[Math.min(s.decoded, 2)], 333);
    let frame = 0,
      elapsed = 0,
      prev = performance.now(),
      last = -1;
    const tick = (now: number) => {
      elapsed += Math.min(now - prev, 80);
      prev = now;
      const n = t.frames.findIndex(
        (f) => elapsed >= f.start && elapsed < f.end,
      );
      setPulse(n >= 0);
      if (n >= 0 && last !== n) {
        if (soundRef.current) tone(t.frames[n].end - t.frames[n].start);
        last = n;
      }
      if (elapsed > t.duration + 800) {
        setPlaying(false);
        setPulse(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setPulse(false);
      silence();
    };
  }, [playing, sequence, s.stage, s.decoded]);
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
      setEnding(
        t < 1600
          ? 'scatter'
          : t < 5200
            ? 'project'
            : t < 6700
              ? 'scatter2'
              : 'hbd',
      );
      const n = timeline.frames.findIndex((f) => t >= f.start && t < f.end);
      setPulse(n >= 0);
      if (n >= 0 && n !== lastPulse) {
        feedback(
          timeline.frames[n].end - timeline.frames[n].start,
          soundRef.current,
        );
        lastPulse = n;
      }
      if (t < 7300) frame = requestAnimationFrame(tick);
      else {
        setPulse(false);
        silence();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      silence();
    };
  }, [s.stage, returning, boot]);
  const go = (lines: string[], next: number) => {
    cancelHold();
    setPlaying(false);
    setBridgeIndex(0);
    setBridge({ lines, next });
  };
  const start = (replay = false) => {
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
  const aligned = Math.abs(prism - 68) <= 2,
    color = aligned
      ? PINK
      : 'hsl(' + Math.round(180 + prism * 1.85) + ' 82% 77%)';
  const adjustPrism = (n: number) => {
    const value = Math.max(0, Math.min(100, n));
    if (Math.abs(value - 68) <= 2 && !aligned) tap();
    setPrism(value);
  };
  const stoneQuotes = [
      '愿你像蓝宝石一样，温柔，也坚韧。',
      '愿属于你的粉色，照亮平凡的每一天。',
      '愿 10 月 9 日的星光，年年都为你而亮。',
    ],
    stoneSteps = Math.min(3, 1 + Math.floor(s.rotation / 50));
  function inputSymbol(ms: number) {
    const symbol = symbolFromHold(ms),
      value = draft + symbol,
      target = MORSE_CODES[s.decoded];
    if (!target) return;
    feedback(symbol === '.' ? 30 : 140, sound);
    if (!prefixOK(value, target)) {
      setMessage('这束回声没有对上。已保留之前的节奏，再试一次。');
      return;
    }
    setDraft(value);
    setMessage(value === target ? '这一组已经完整，轻触确认接通。' : '');
  }
  function beginEcho(pointer: number | null) {
    if (echoPress.current || playing || s.decoded >= 3) return;
    echoPress.current = { start: performance.now(), pointer };
    const tick = () => {
      if (!echoPress.current) return;
      setHold(
        Math.min(1, (performance.now() - echoPress.current.start) / 1000),
      );
      holdFrame.current = requestAnimationFrame(tick);
    };
    holdFrame.current = requestAnimationFrame(tick);
  }
  function endEcho(pointer: number | null) {
    const p = echoPress.current;
    if (!p || p.pointer !== pointer) return;
    echoPress.current = null;
    cancelAnimationFrame(holdFrame.current);
    setHold(0);
    inputSymbol(performance.now() - p.start);
  }
  function returnHome() {
    cancelHold();
    setReturning(true);
    returnTimer.current = setTimeout(
      () => {
        patch({ stage: 0 });
        setReturning(false);
        setEnding('scatter');
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
        (bridge ? 'bridging' : '')
      }
      style={{ '--pink': PINK } as CSSProperties}
    >
      <Starfield
        text={boot ? '' : text}
        burst={
          modelBurst ||
          returning ||
          (s.stage === 7 && ['scatter', 'scatter2'].includes(ending))
        }
        charge={charge}
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
                }}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              {s.stage > 0 && s.stage < 7 && (
                <button
                  aria-label="查看提示"
                  onClick={() => {
                    cancelHold();
                    setPlaying(false);
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
                <div className="scene-heading">
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
                        <small>{s.choices.includes(i) ? '✧  ' + en : en}</small>
                      </button>
                    ))}
                  </div>
                  <p className="choice-count">
                    {s.choices.length} / 3{' '}
                    <span>
                      {s.replay
                        ? '带着上次的愿望，再走一遍。'
                        : '愿望没有正确答案。'}
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
                        s.choices.map((i) => NOUNS[i][2]),
                        2,
                      )
                    }
                  >
                    让它们，随我同行 <ArrowRight size={16} />
                  </button>
                </>
              )}
              {s.stage === 2 && (
                <>
                  <div
                    className={'prism-scene ' + (aligned ? 'aligned' : '')}
                    style={
                      {
                        '--spectrum': color,
                        '--prism-angle': (prism - 50) * 0.6 + 'deg',
                      } as CSSProperties
                    }
                    onPointerDown={(e) => {
                      prismDrag.current = e.clientX;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (prismDrag.current === null) return;
                      adjustPrism(
                        prism + (e.clientX - prismDrag.current!) * 0.32,
                      );
                      prismDrag.current = e.clientX;
                    }}
                    onPointerUp={() => {
                      prismDrag.current = null;
                      if (aligned) tap();
                    }}
                    onPointerCancel={() => (prismDrag.current = null)}
                  >
                    <svg
                      viewBox="0 0 600 360"
                      role="img"
                      aria-label="转动的棱镜，把白光分解成彩色光谱"
                    >
                      <defs>
                        <linearGradient id="prismGlass">
                          <stop stopColor="#abc6e4" stopOpacity=".03" />
                          <stop
                            offset="1"
                            stopColor="#dce0ff"
                            stopOpacity=".24"
                          />
                        </linearGradient>
                        <linearGradient id="pinkBeam">
                          <stop stopColor={color} stopOpacity=".65" />
                          <stop offset="1" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 184 264 184"
                        stroke="#f0eafa"
                        strokeWidth="1"
                      />
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <path
                          key={n}
                          d={
                            'M320 180 L600 ' +
                            (110 + n * 28 + (prism - 68) * 1.5)
                          }
                          stroke={
                            aligned
                              ? PINK
                              : [
                                  '#96a9ff',
                                  '#ab95ed',
                                  '#ce95e7',
                                  '#efa3d7',
                                  '#f1b7b0',
                                  '#d8d5a6',
                                ][n]
                          }
                          strokeOpacity=".3"
                        />
                      ))}
                      <path
                        d="M320 180 600 138 600 235Z"
                        fill="url(#pinkBeam)"
                      />
                      <g className="prism-body">
                        <path
                          d="M300 65 205 242 395 242Z"
                          fill="url(#prismGlass)"
                          stroke="#d3dcf8"
                          strokeWidth="1"
                        />
                        <path
                          d="M300 65 306 216 205 242M306 216 395 242"
                          stroke="#d3dcf8"
                          strokeOpacity=".4"
                          fill="none"
                        />
                      </g>
                    </svg>
                  </div>
                  <p className="spectrum-value">
                    <i style={{ background: color }} />
                    {aligned ? '#ffb3de' : '寻找那一束粉色'}
                    <small>{prism.toFixed(0)}°</small>
                  </p>
                  <div className="spectrum-slider">
                    <Slider
                      aria-label="棱镜转角"
                      value={[prism]}
                      min={0}
                      max={100}
                      onValueChange={(v) =>
                        adjustPrism(Array.isArray(v) ? v[0] : v)
                      }
                    />
                  </div>
                  <button
                    className="continue"
                    disabled={!aligned}
                    onClick={() => {
                      tap();
                      patch({ color: true });
                      go(
                        [
                          '原来，你喜欢的颜色，也能被星光记住。',
                          '愿这抹粉色，温柔地落在你每一个日常。',
                        ],
                        3,
                      );
                    }}
                  >
                    留下这束光 <ArrowRight size={16} />
                  </button>
                </>
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
                        ? '你已点亮开头，余下的星光正在回应。'
                        : '一瞬成为点，停留成为线。'}
                  </p>
                </>
              )}
              {s.stage === 4 && (
                <>
                  {!s.stone ? (
                    <>
                      <div className="date-wheels">
                        <Dial
                          label="月"
                          value={s.month}
                          max={12}
                          onChange={(n) => {
                            patch({ month: n });
                            tap();
                          }}
                        />
                        <span className="date-dot">·</span>
                        <Dial
                          label="日"
                          value={s.day}
                          max={31}
                          onChange={(n) => {
                            patch({ day: n });
                            tap();
                          }}
                        />
                      </div>
                      <p className="date-whisper">
                        {s.month === 10 && s.day === 9
                          ? '10 月 9 日。就是这一天，世界多了一个你。'
                          : '时间转过四季，停在你到来的那天。'}
                      </p>
                      <button
                        className="continue"
                        disabled={s.month !== 10 || s.day !== 9}
                        onClick={() => {
                          tap();
                          patch({ stone: true });
                        }}
                      >
                        拾起这一天的星光 <ArrowRight size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className="gem-turn"
                        onPointerDown={(e) => {
                          gemDrag.current = { x: e.clientX, y: e.clientY };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!gemDrag.current) return;
                          const d = Math.hypot(
                            e.clientX - gemDrag.current.x,
                            e.clientY - gemDrag.current.y,
                          );
                          setS((p) => ({
                            ...p,
                            rotation: p.rotation + d * 0.8,
                          }));
                          gemDrag.current = { x: e.clientX, y: e.clientY };
                        }}
                        onPointerUp={() => (gemDrag.current = null)}
                        onPointerCancel={() => (gemDrag.current = null)}
                      >
                        <Sapphire rotation={s.rotation} />
                      </div>
                      <p className="gem-name">
                        粉色蓝宝石 <small>PINK SAPPHIRE</small>
                      </p>
                      <p className="gem-blessing" aria-live="polite">
                        {stoneQuotes[stoneSteps - 1]}
                      </p>
                      <div className="gem-progress">
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={n <= stoneSteps ? 'lit' : ''} />
                        ))}
                      </div>
                      <button
                        className="soft-button"
                        onClick={() => {
                          patch({ rotation: s.rotation + 50 });
                          tap();
                        }}
                      >
                        转动宝石，让另一道光经过
                      </button>
                      <button
                        className="continue"
                        disabled={s.rotation < 100}
                        onClick={() =>
                          go(
                            ['一枚属于你的诞生纪念，收藏了整片星空的祝福。'],
                            5,
                          )
                        }
                      >
                        带着它继续 <ArrowRight size={16} />
                      </button>
                    </>
                  )}
                </>
              )}
              {s.stage === 5 && (
                <>
                  {echoIntro && s.decoded < 3 ? (
                    <div className="echo-intro">
                      <Star on />
                      <p>刚才的星星，留下了一封信。</p>
                      <div className="press-lesson">
                        <span>
                          ·<small>轻按一下</small>
                        </span>
                        <span>
                          —<small>按住 1 秒</small>
                        </span>
                      </div>
                      <p>
                        先看一遍闪光，
                        <br />
                        再把相同的节奏，轻轻按回来。
                      </p>
                      <button
                        className="continue"
                        onClick={() => {
                          setEchoIntro(false);
                          setPlaying(true);
                        }}
                      >
                        我来回应它 <Play size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="letter-slots">
                        {['W', '2', '5'].map((l, i) => (
                          <span
                            key={l}
                            className={i < s.decoded ? 'solved' : ''}
                          >
                            {i < s.decoded ? l : '·'}
                          </span>
                        ))}
                      </div>
                      {s.decoded < 3 ? (
                        <>
                          <button
                            className={
                              'echo-pad ' +
                              (pulse ? 'pulsing ' : '') +
                              (hold >= 1 ? 'long-ready' : '')
                            }
                            style={{ '--hold': hold } as CSSProperties}
                            disabled={playing}
                            aria-label="回应星光：短按为点，按住至少一秒为划"
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.currentTarget.setPointerCapture(e.pointerId);
                              beginEcho(e.pointerId);
                            }}
                            onPointerUp={(e) => endEcho(e.pointerId)}
                            onPointerCancel={cancelHold}
                            onKeyDown={(e) => {
                              if (
                                (e.key === ' ' || e.key === 'Enter') &&
                                !e.repeat
                              ) {
                                e.preventDefault();
                                beginEcho(null);
                              }
                            }}
                            onKeyUp={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                endEcho(null);
                              }
                            }}
                          >
                            <Star on={pulse || hold > 0} />
                            <span>
                              {playing
                                ? '看星光停留多久'
                                : hold >= 1
                                  ? '长光已点亮，松手送出'
                                  : hold > 0
                                    ? '继续按住，直到 1 秒'
                                    : '用指尖回应'}
                            </span>
                          </button>
                          <div className="rhythm-draft" role="status">
                            {draft
                              .replaceAll('.', '· ')
                              .replaceAll('-', '— ') || '等待你的第一束光'}
                          </div>
                          <p className="live-message" role="status">
                            {message}
                          </p>
                          <div className="echo-actions">
                            <button
                              className="soft-button"
                              onClick={() => {
                                cancelHold();
                                setPlaying((v) => !v);
                                setSequence((n) => n + 1);
                              }}
                            >
                              {playing ? (
                                <Pause size={15} />
                              ) : (
                                <Play size={15} />
                              )}{' '}
                              {playing ? '暂停' : '再看一遍'}
                            </button>
                            <button
                              className="soft-button"
                              disabled={!draft || playing}
                              onClick={() => {
                                setDraft((v) => v.slice(0, -1));
                                setMessage('');
                              }}
                            >
                              <RotateCcw size={15} /> 撤回
                            </button>
                          </div>
                          <button
                            className="continue"
                            disabled={
                              draft !== MORSE_CODES[s.decoded] || playing
                            }
                            onClick={() => {
                              tap();
                              patch({ decoded: s.decoded + 1 });
                              setDraft('');
                              setMessage('');
                              if (s.decoded < 2) setPlaying(true);
                            }}
                          >
                            接通这一组 <ArrowRight size={16} />
                          </button>
                          <details className="rhythm-access">
                            <summary>换一种方式回应</summary>
                            <p>
                              第 {s.decoded + 1} 组：
                              {MORSE_CODES[s.decoded]
                                .replaceAll('.', '· ')
                                .replaceAll('-', '— ')}
                            </p>
                            <button
                              disabled={playing}
                              onClick={() => inputSymbol(100)}
                            >
                              短光 ·
                            </button>
                            <button
                              disabled={playing}
                              onClick={() => inputSymbol(1000)}
                            >
                              长光 —
                            </button>
                          </details>
                        </>
                      ) : (
                        <>
                          <p className="reveal-copy">
                            这门短与长的语言，叫摩尔斯电码。
                            <br />
                            W25，从来不只是答案。
                            <br />
                            它还是一份礼物的形状。
                          </p>
                          <button
                            className="continue"
                            onClick={() =>
                              go(
                                [
                                  '你已经见过它的每一部分。',
                                  '现在，让它们相遇。',
                                ],
                                6,
                              )
                            }
                          >
                            让星光成形 <ArrowRight size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {s.stage === 6 && (
                <>
                  <WireBracelet
                    onScatter={() => {
                      tap();
                      setModelBurst(true);
                    }}
                    onGem={() => {
                      cancelHold();
                      setEnding('scatter');
                      setS((p) => finish(p));
                    }}
                  />
                  <p className="model-whisper">
                    在那颗粉色蓝宝石上，留下你的指尖。
                  </p>
                  <a className="ar-option" rel="ar" href="models/bracelet.usdz">
                    <img src="model-poster.svg" alt="在身边查看真实手链模型" />
                    <span>也可以，让它来到现实中 ↗</span>
                  </a>
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
                        愿这些星光，往后的每一年都陪着你。
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
                          : '长按这句话 3 秒，让星光回到起点。'}
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
              <p
                key={bridgeIndex}
                style={
                  {
                    '--phrase-time':
                      blessingDuration(bridge.lines[bridgeIndex]) + 'ms',
                  } as CSSProperties
                }
              >
                {bridge.lines[bridgeIndex]}
              </p>
              <span className="passing-star" aria-hidden="true">
                ✧
              </span>
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
