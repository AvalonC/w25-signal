import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Exercise the real TSX controller without a browser, server, or generated files.
const repo = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    const url = specifier.startsWith('@/') ? pathToFileURL(repo + specifier.slice(2)).href
      : specifier.startsWith('./') || specifier.startsWith('../') ? new URL(specifier, context.parentURL).href : null;
    if (url) for (const ext of ['.ts', '.tsx']) if (existsSync(fileURLToPath(url + ext)))
      return next(url + ext, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return next(url, context);
  },
});
const { EchoRelay } = await import('../components/game/echo-relay.tsx');
const { RelayReveal } = await import('../components/game/relay-reveal.tsx');

test('real relay performs three different crossings, pauses clocks, visibly shares the final letter and delivers once', async () => {
  const original = Object.fromEntries(['document','window','performance','requestAnimationFrame','cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  let now = 0, next = 0;
  const received = [];
  const tones = [];
  const frames = new Map();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const props = { choices: [0, 3, 5], delivered: [], paused: false,
    onDelivered: (wish) => received.push(wish), onTone(ms) { tones.push(ms); }, onTouch() {} };
  const advance = async (ms) => {
    for (let i=0; i<ms; i+=40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((fn) => fn(now)));
    }
  };
  let root;
  const near = () => root.root.findAllByType('button').find((b) => b.props.className?.startsWith('relay-near'));
  const phase = () => root.root.findByType('section').props.className;
  const prefix = () => root.root.findByProps({ className: 'relay-footsteps' }).props['aria-label'];
  const wishButton = (name) => root.root.findAllByType('button').find((b) => b.props['aria-label']?.startsWith(name + '。'));
  const short = () => root.root.findAllByType('button').find((b) => b.children.join('') === '送出短光 ·');
  const event = { key:' ', repeat:false, preventDefault() {} };
  try {
    await act(() => { root = create(React.createElement(EchoRelay, props)); });
    assert.match(phase(), /relay-arrival/);
    const entryStart = near().props.style;
    await act(() => wishButton('勇气').props.onClick());
    assert.match(phase(), /relay-arrival/, 'a wish cannot skip the arrival');
    await advance(900);
    assert.notEqual(near().props.style.left, entryStart.left, 'the star follows the pink entry light');
    await act(() => root.update(React.createElement(EchoRelay, {...props, paused:true})));
    const frozenEntry = near().props.style.left;
    await advance(4000);
    assert.equal(near().props.style.left, frozenEntry);
    await act(() => root.update(React.createElement(EchoRelay, props)));
    await advance(2100);
    assert.match(phase(), /relay-choose/);
    const wish = root.root.findAllByType('button').find((b) => b.props['aria-label']?.startsWith('勇气。'));
    await act(() => wish.props.onClick());
    assert.match(phase(), /relay-listen/);
    await advance(1000);
    await act(() => root.update(React.createElement(EchoRelay, {...props, paused:true})));
    await advance(12000);
    assert.match(phase(), /relay-listen/);
    await act(() => root.update(React.createElement(EchoRelay, props)));
    globalThis.document.hidden = true;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(12000);
    assert.match(phase(), /relay-listen/);
    globalThis.document.hidden = false;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(6000);
    assert.match(phase(), /relay-answer/);
    await act(() => root.root.findAllByType('button').find((b) => b.props['aria-label'] === '回应方法与辅助按钮').props.onClick());
    assert.match(phase(), /is-paused/, 'help appears over the sky and pauses its clocks');
    assert.equal(root.root.findAllByType('details').length, 0, 'help cannot expand the page');
    await act(() => root.root.findAllByType('button').find((b) => b.props['aria-label'] === '关闭回应方法').props.onClick());
    await act(() => near().props.onKeyDown(event));
    await advance(1200);
    await act(() => window.dispatchEvent(new Event('blur')));
    await act(() => near().props.onKeyUp(event));
    assert.match(phase(), /relay-answer/, 'blur must cancel rather than send a long pulse');
    assert.equal(prefix(), '已经回应的节奏：', 'lead wishes never answer W for the player');
    await act(() => near().props.onKeyDown(event));
    await advance(120);
    await act(() => near().props.onKeyUp(event));
    await act(() => near().props.onClick({ detail: 0 }));
    assert.equal(prefix(), '已经回应的节奏：短 ', 'a keyboard-generated click never submits a duplicate pulse');
    const startPosition = near().props.style;
    for (let i=0;i<2;i++) {
      await act(() => near().props.onKeyDown(event));
      await advance(1040);
      await act(() => near().props.onKeyUp(event));
    }
    assert.match(phase(), /relay-cross/);
    await act(() => root.update(React.createElement(EchoRelay, {...props, paused:true})));
    await advance(4000);
    assert.deepEqual(received, []);
    await act(() => root.update(React.createElement(EchoRelay, props)));
    await advance(1200);
    assert.notEqual(near().props.style.left, startPosition.left, 'the main light itself crosses the route');
    await advance(6000);
    assert.deepEqual(received, [0], 'automatic arrival fires once, without a confirmation button');
    // Reproduce the screenshot: curiosity + wonder, on the reversed second shore.
    await act(() => root.update(React.createElement(EchoRelay, {
      ...props, key: 'hint-regression', choices: [5, 2, 4], delivered: [5],
    })));
    const wonder = wishButton('惊喜');
    await act(() => wonder.props.onClick());
    await advance(8000);
    assert.match(phase(), /relay-help/);
    assert.equal(near().props.disabled, true, 'an unclear letter requires the player to help the far shore');
    assert.equal(root.root.findAllByType('path').filter((p) => p.props.className?.includes('relay-route-complete')).length, 1, 'the first route stays repaired');
    await act(() => short().props.onClick());
    assert.match(phase(), /relay-help/, 'disabled helper input cannot skip the helping step');
    await act(() => wishButton('好奇').props.onClick());
    assert.match(phase(), /relay-listen/);
    await advance(6000);
    assert.match(phase(), /relay-answer/);
    assert.match(phase(), /relay-reversed/);
    for (let i=0; i<2; i++) {
      await act(() => near().props.onKeyDown(event));
      await advance(120);
      await act(() => near().props.onKeyUp(event));
    }
    const hint = root.root.findByProps({className: 'relay-next'});
    assert.equal(hint.children.join(''), '下一束：长光');
    assert.equal(root.root.findAllByProps({className: 'relay-glimpse'}).length, 0, 'No unlabelled dash floats in the sky');
    assert.equal(root.root.findAllByProps({className: 'relay-path-lit'}).length, 0, 'No solid progress strip stretches between the stars');
    const long = () => root.root.findAllByType('button').find((b) => b.children.join('') === '送出长光 —');
    for (let i=0; i<3; i++) await act(() => long().props.onClick());
    assert.match(phase(), /relay-cross/);
    await advance(3200);
    assert.deepEqual(received, [0, 2]);

    // The final 5 is far, near, far, near, far. Extra taps cannot play the far turns.
    const lastProps = { ...props, key: 'shared-final', choices: [0, 3, 5], delivered: [0, 3] };
    await act(() => root.update(React.createElement(EchoRelay, lastProps)));
    assert.equal(root.root.findAllByType('path').filter((p) => p.props.className?.includes('relay-route-complete')).length, 2);
    await act(() => wishButton('好奇').props.onClick());
    assert.match(phase(), /relay-echo/);
    for (let i=0; i<7; i++) await act(() => short().props.onClick());
    assert.equal(prefix(), '已经回应的节奏：');
    await advance(700);
    const far = () => root.root.findAllByType('div').find((d) => d.props.className?.startsWith('relay-far'));
    assert.match(far().props.className, /is-speaking/, 'the automatic far-shore pulse must be visible');
    assert.ok(tones.length > 0);
    await act(() => root.update(React.createElement(EchoRelay, {...lastProps, paused:true})));
    await advance(12000);
    assert.equal(prefix(), '已经回应的节奏：', 'a paused echo never advances');
    await act(() => root.update(React.createElement(EchoRelay, lastProps)));
    await advance(1100);
    assert.match(phase(), /relay-answer/);
    assert.equal(prefix(), '已经回应的节奏：短 ');
    await act(() => short().props.onClick());
    assert.match(phase(), /relay-echo/);
    assert.equal(prefix(), '已经回应的节奏：短 短 ');
    for (let i=0; i<5; i++) await act(() => short().props.onClick());
    assert.equal(prefix(), '已经回应的节奏：短 短 ');
    globalThis.document.hidden = true;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(12000);
    assert.equal(prefix(), '已经回应的节奏：短 短 ');
    globalThis.document.hidden = false;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(1900);
    assert.equal(prefix(), '已经回应的节奏：短 短 短 ');
    await act(() => short().props.onClick());
    assert.match(phase(), /relay-echo/, 'the last pulse belongs to the far shore');
    await advance(750);
    assert.match(far().props.className, /is-speaking/);
    await advance(5000);
    assert.deepEqual(received, [0, 2, 5]);
    await advance(3000);
    assert.deepEqual(received, [0, 2, 5], 'the final shared crossing also delivers only once');
    assert.equal(root.root.findAllByType('line').filter((line) => line.props.className === 'relay-sent-mark').length, 13, 'all thirteen completed pulses remain for the reveal');

    let proceeded = 0;
    const revealProps = { choices: props.choices, paused: false, onContinue() { proceeded++; } };
    await act(() => root.update(React.createElement(RelayReveal, revealProps)));
    const revealButton = () => root.root.findAllByType('button').find((b) => b.props.className === 'relay-reveal-continue');
    await act(() => revealButton().props.onClick());
    assert.equal(proceeded, 0, 'the light must finish forming before the player continues');
    const line = () => root.root.findAllByType('line')[0];
    const lineStart = line().props.x1;
    await advance(1700);
    assert.notEqual(line().props.x1, lineStart, 'the actual previous light positions move into letter strokes');
    await act(() => root.update(React.createElement(RelayReveal, {...revealProps, paused:true})));
    const frozenLine = line().props.x1;
    await advance(6000);
    assert.equal(line().props.x1, frozenLine);
    await act(() => root.update(React.createElement(RelayReveal, revealProps)));
    globalThis.document.hidden = true;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(6000);
    assert.equal(line().props.x1, frozenLine);
    globalThis.document.hidden = false;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(4600);
    assert.equal(revealButton().props.disabled, false);
    const returnedStar = root.root.findByProps({className:'relay-returned-control'});
    assert.equal(returnedStar.props.style.opacity, 1, 'the star and companions return after W25 is formed');
    assert.equal(proceeded, 0, 'forming W25 never automatically changes chapter');
    await act(() => revealButton().props.onClick());
    await act(() => revealButton().props.onClick());
    assert.equal(proceeded, 1);

    globalThis.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    await act(() => root.update(React.createElement(EchoRelay, {...props, key:'reduced-arrival'})));
    await advance(480);
    assert.match(phase(), /relay-choose/, 'reduced motion has a short, non-travelling arrival');
    await act(() => root.update(React.createElement(RelayReveal, {...revealProps, key:'reduced-reveal'})));
    await advance(1100);
    assert.equal(revealButton().props.disabled, false, 'reduced motion completes the reveal without a long flight');
    await act(() => root.unmount());
    assert.equal(frames.size, 0);
  } finally {
    if (root) await act(() => root.unmount());
    for (const [key,value] of Object.entries(original)) Object.defineProperty(globalThis, key, { configurable:true, writable:true, value });
  }
});
