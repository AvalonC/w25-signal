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
import { StarPathJourney } from './star-path-journey';
import { CompanionLight } from './path-sky';
import { GuidingLight } from './guiding-light';
import { PathClosure } from './path-closure';
import { freshPath } from '@/lib/star-path';
import { EchoRelay } from './echo-relay';
import { deliveredWishes } from '@/lib/echo-relay';
import { PassingMeteor } from './passing-meteor';
import { MOTION, MOTION_STYLE } from '@/lib/motion';
import type { StarArrival } from '@/lib/bracelet-transition';
import {
  fresh,
  readSave,
  restart,
  revisitJourney,
  finish,
  MORSE_CODES,
  NOUNS,
  PINK,
  morseTimeline,
  type Journey,
  blessingDuration,
  endingPhase,
} from '@/lib/journey';
import { switchTap, tone, feedback, silence, playBirthday } from '@/lib/feedback';
const HEADINGS = [
  '',
  '想带走的，留在心里。',
  '光里，有你喜欢的颜色。',
  '有的光一闪，有的多留一会。',
  '这一天，你来到世上。',
  '路在这里断开，光却还在回应。',
  '原来，是为了来到你身边。',
];
const NOTES = [
  '',
  '轻轻拖动散落的光，留下三个愿望。',
  '慢慢转动，看看光会在哪里停留。',
  '循着闪光，看看它要去哪里。',
  '转动星盘，找回十月八日的星光。',
  '把三个愿望，送到星海的那一边。',
  '星星、长短的光，还有你喜欢的粉色。',
];
const HINTS = [
  '',
  '按住词的星光并拖动，让它聚拢。选满三个继续。键盘可用 Enter 聚拢并选择。',
  '拖动同行的星，或轻触远处的棱镜、星盘，先去你想去的地方。找到粉色与十月八日后，把粉光带进宝石。左上角的伴星会带你回到星路。',
  '跟随闪光触碰前三颗星，组成 W。后面的 2 和 5 会自动接续，随后进入下一幕。',
  '将星盘转到十月八日，把找到的粉光带入宝石。转到光相遇的角度并稍作停留，切面、天秤、粉色会依次出现；也可轻触转动。最后触碰出口的光，继续接路。',
  '先选一颗同行的愿望星。第一段照着对岸回应；第二段光变暗时，请伴星帮忙；第三段与你轮流亮起。轻按是点，按住一秒是划，错误保留已点亮的部分。可重听，也可展开短光、长光按钮。',
  '把主星带到缺口另一端，或直接轻触终点，让星路合拢。接着看看手链怎样回应 W25；模型出现后可旋转、进入 AR，或触碰粉色宝石读完这封信。',
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
    [words, setWords] = useState<number[]>(Array(8).fill(0));
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
    try { setSound(localStorage.getItem('w25-sound') === 'on'); } catch {}
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem('w25-sound', sound ? 'on' : 'off'); } catch {}
  }, [sound, ready]);
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
    setS((p) => restart(p, replay));
    setRevisit(false);
  };
  const revisitAt = (stage: 6 | 7) => {
    tap(); setStarArrival(null); setEnding('project'); setRevisit(false);
    setS((p) => revisitJourney(p, stage));
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
          {s.stage === 0 && !s.completed ? <>
            <GuidingLight onArrive={open} paused={help || !!bridge} />
            {!sound && <button className="journey-sound-invite" onClick={() => { setSound(true); tone(180); }}>
              <Volume2 size={16} /> 让星光有声音
            </button>}
          </> : s.stage === 0 ? (
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
              className={'scene scene-' + s.stage + (s.stage === 2 ? ' scene-path' : '')}
            >
              {s.stage < 7 && s.stage !== 2 && !(s.stage === 6 && !s.pathClosed) && (
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
                  {s.choices.length === 3 && <GuidingLight compact choices={s.choices}
                    paused={help || !!bridge} onArrive={() => patch({stage: 2})} />}
                </>
              )}
              {s.stage === 2 && (
                <StarPathJourney path={s.path ?? freshPath()} choices={s.choices}
                  month={s.month} day={s.day} rotation={s.rotation} paused={help || !!bridge || boot}
                  onPath={(path) => patch({ path, color: path.color })}
                  onDate={(month, day) => patch({ month, day })}
                  onRotation={(rotation) => patch({ rotation })} onTap={tap}
                  onComplete={() => setS((p) => ({
                    ...p, color: true, stars: 13, stone: true, rotation: 150, stage: 5,
                  }))} />
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
                    三段回应，留下了 W25。
                  </p>
                  <div className="journey-wishes"><CompanionLight choices={s.choices} pink compact />
                    {s.choices.map((i) => NOUNS[i][0]).join(' · ')}</div>
                  <button className="continue" onClick={() => { patch({ pathClosed: false }); go([], 6); }}>
                    循着光，走完最后一段 <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {s.stage === 6 && !s.pathClosed && <PathClosure choices={s.choices} paused={help || !!bridge}
                onComplete={() => { tap(); patch({ pathClosed: true }); }} />}
              {s.stage === 6 && s.pathClosed && (
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
                  {s.completed && <nav className="journey-revisit" aria-label="重访星间来信">
                    <button onClick={() => { setStarArrival(null); setEnding('project'); setS((p) => finish(p)); }}>读生日回信</button>
                    <button onClick={() => patch({stage: 0})}>回到星空</button>
                  </nav>}
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
                        onLostPointerCapture={cancelHold}
                        onBlur={cancelHold}
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
              <button className="continue" onClick={() => revisitAt(6)}>看看手链与现实中的光</button>
              <button className="soft-button" onClick={() => revisitAt(7)}>读生日回信</button>
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
              <DialogDescription>{HINTS[s.stage === 2 && s.path?.place === 'sapphire' ? 4 : s.stage]}</DialogDescription>
              <DialogClose className="continue">继续寻找</DialogClose>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
