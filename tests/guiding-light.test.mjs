import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

const repo = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    const url = specifier.startsWith('@/') ? pathToFileURL(repo + specifier.slice(2)).href
      : specifier.startsWith('./') || specifier.startsWith('../') ? new URL(specifier, context.parentURL).href : null;
    if (url) for (const ext of ['.ts', '.tsx']) if (existsSync(fileURLToPath(url + ext))) return next(url + ext, context);
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
const { GuidingLight } = await import('../components/game/guiding-light.tsx');

async function scene(initial, body) {
  const keys = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, arrived = 0;
  const frames = new Map(), captures = new Set(), feedback = [];
  const carrier = () => root.root.findByProps({ className: 'guiding-carrier' });
  const carrierHost = {
    setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => {
      captures.delete(id);
      carrier().props.onLostPointerCapture({ pointerId: id });
    },
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: !!initial.reduced, addEventListener() {}, removeEventListener() {} });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const render = (paused = false) => React.createElement(GuidingLight, {
    paused, onArrive: () => arrived++, onFeedback: (symbol) => feedback.push(symbol),
  });
  const advance = async (ms) => {
    for (let remaining = ms; remaining > 0;) {
      const step = Math.min(40, remaining); remaining -= step; now += step;
      const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  const pointer = (extra = {}) => ({ clientX: 108, clientY: 296, pointerId: 1,
    isPrimary: true, button: 0, currentTarget: carrierHost, preventDefault() {}, ...extra });
  const key = (value = ' ', extra = {}) => ({ key: value, repeat: false, preventDefault() {}, ...extra });
  const event = async (name, value = {}) => act(() => carrier().props[name](value));
  const phase = () => root.root.findByType('section').props['data-phase'];
  const progress = () => carrier().props.style['--lesson-charge'];
  const caption = () => root.root.findByType('output').children.join('');
  const start = async () => { await advance(initial.reduced ? 200 : 1800); assert.equal(phase(), 'tap'); };
  const tap = async () => {
    await event('onPointerDown', pointer()); await advance(80); await event('onPointerUp', pointer());
    assert.equal(phase(), 'tap-reply');
  };
  const toHold = async () => {
    await start(); await tap(); await advance(1000); assert.equal(phase(), 'hold');
  };
  const signal = async (name) => act(() => window.dispatchEvent(new Event(name)));
  const hidden = async (value) => {
    document.hidden = value; await act(() => document.dispatchEvent(new Event('visibilitychange')));
  };
  try {
    await act(() => { root = create(render(), { createNodeMock: (node) => node.props.className === 'guiding-carrier' ? carrierHost : {} }); });
    await body({ root, carrier, event, advance, pointer, key, phase, progress, caption, start, tap, toHold,
      signal, hidden, captures, feedback, arrived: () => arrived,
      pause: async (paused) => act(() => root.update(render(paused))),
    });
    await act(() => root.unmount()); root = null;
    assert.equal(frames.size, 0, 'unmount cancels both scene and press animation frames');
  } finally {
    if (root) await act(() => root.unmount());
    for (const name of keys) {
      if (original[name]) Object.defineProperty(globalThis, name, original[name]); else delete globalThis[name];
    }
  }
}

test('opening requires a short tap after launch and visibly replies before teaching hold', async () => {
  await scene({}, async ({ root, carrier, event, advance, pointer, phase, caption, feedback, arrived, captures }) => {
    assert.equal(phase(), 'launch'); assert.equal(carrier().props.disabled, true);
    assert.equal(root.root.findAllByType('button').length, 1, 'the distant echo cannot skip the lesson');
    await event('onPointerDown', pointer()); await event('onClick', { detail: 0 });
    await advance(1760); assert.equal(phase(), 'launch'); assert.deepEqual(feedback, []);
    await advance(40); assert.equal(phase(), 'tap'); assert.match(caption(), /闪烁.*轻点/);
    await event('onClick', { detail: 1 }); assert.equal(phase(), 'tap', 'pointer compatibility click alone is not a gesture');
    await event('onPointerDown', pointer()); await advance(1000); await event('onPointerUp', pointer());
    assert.equal(phase(), 'tap', 'a long press does not teach the short tap'); assert.deepEqual(feedback, []);
    await event('onPointerDown', pointer()); await advance(120); await event('onPointerUp', pointer());
    assert.equal(phase(), 'tap-reply'); assert.match(caption(), /听见/); assert.deepEqual(feedback, ['.']);
    assert.equal(captures.size, 0); assert.equal(carrier().props.disabled, true);
    await event('onPointerDown', pointer()); await event('onClick', { detail: 0 });
    await advance(960); assert.equal(phase(), 'tap-reply');
    await advance(40); assert.equal(phase(), 'hold'); assert.match(caption(), /光圈.*按住/);
    assert.equal(arrived(), 0); assert.deepEqual(feedback, ['.']);
  });
});

test('hold requires one continuous second and cannot accumulate short presses', async () => {
  await scene({}, async ({ toHold, event, advance, pointer, phase, progress, caption, feedback, captures }) => {
    await toHold();
    await event('onPointerDown', pointer()); await advance(440); assert.equal(progress(), .44);
    await event('onPointerUp', pointer()); assert.equal(progress(), 0); assert.match(caption(), /再试一次/);
    await event('onPointerDown', pointer()); await advance(600); await event('onPointerUp', pointer());
    assert.equal(phase(), 'hold'); assert.deepEqual(feedback, ['.']);
    await event('onPointerDown', pointer()); await advance(999);
    assert.equal(phase(), 'hold'); assert.equal(progress(), .999);
    await advance(1); assert.equal(phase(), 'held'); assert.equal(progress(), 1);
    assert.deepEqual(feedback, ['.', '-']); assert.equal(captures.size, 0);
    await event('onPointerUp', pointer()); await event('onLostPointerCapture', pointer());
    await event('onBlur'); await event('onClick', { detail: 0 });
    assert.equal(phase(), 'held'); assert.equal(progress(), 1); assert.deepEqual(feedback, ['.', '-']);
  });
});

test('secondary pointers cannot start, finish, cancel or replace the active press', async () => {
  await scene({}, async ({ toHold, event, advance, pointer, phase, progress, captures, feedback }) => {
    await toHold();
    await event('onPointerDown', pointer({ isPrimary: false }));
    await event('onPointerDown', pointer({ button: 2 }));
    await advance(1200); assert.equal(phase(), 'hold'); assert.equal(captures.size, 0);
    await event('onPointerDown', pointer()); await advance(400);
    await event('onPointerDown', pointer({ pointerId: 2 }));
    await event('onPointerUp', pointer({ pointerId: 2 }));
    await event('onPointerCancel', pointer({ pointerId: 2 }));
    await event('onLostPointerCapture', pointer({ pointerId: 2 }));
    await event('onPointerMove', pointer({ pointerId: 2, clientX: 900 }));
    assert.equal(progress(), .4); assert.deepEqual([...captures], [1]);
    await advance(600); assert.equal(phase(), 'held'); assert.deepEqual(feedback, ['.', '-']);
  });
});

test('capture loss, cancellation, focus changes and movement cancel without retaining charge', async () => {
  await scene({}, async ({ toHold, carrier, event, advance, pointer, phase, progress, captures, feedback, signal, hidden, pause }) => {
    await toHold();
    const cases = [
      [async () => event('onPointerCancel', pointer()), async () => {}],
      [async () => event('onLostPointerCapture', pointer()), async () => {}],
      [async () => event('onBlur'), async () => {}],
      [async () => event('onPointerMove', pointer({ clientX: 141 })), async () => {}],
      [async () => signal('blur'), async () => signal('focus')],
      [async () => hidden(true), async () => hidden(false)],
      [async () => pause(true), async () => pause(false)],
    ];
    for (const [cancel, restore] of cases) {
      await event('onPointerDown', pointer()); await advance(800); assert.equal(progress(), .8);
      await cancel(); assert.equal(progress(), 0); assert.equal(captures.size, 0);
      await advance(1600); await event('onPointerUp', pointer()); assert.equal(phase(), 'hold');
      await restore(); assert.equal(carrier().props.disabled, false);
      await event('onPointerDown', pointer()); await advance(240); await event('onPointerUp', pointer());
      assert.equal(phase(), 'hold'); assert.deepEqual(feedback, ['.']);
    }
    await event('onPointerDown', pointer());
    await event('onPointerMove', pointer({ clientX: 140 }));
    await advance(1000); assert.equal(phase(), 'held', 'a small finger drift remains a hold');
  });
});

test('keyboard holds match their initiating key, ignore repeats and do not double-trigger native clicks', async () => {
  await scene({}, async ({ start, event, advance, key, phase, progress, feedback, arrived }) => {
    await start();
    await event('onKeyDown', key('Enter')); await advance(80);
    await event('onKeyUp', key('Enter')); await event('onClick', { detail: 0 });
    assert.equal(phase(), 'tap-reply'); assert.deepEqual(feedback, ['.']);
    await advance(1000); assert.equal(phase(), 'hold');
    await event('onClick', { detail: 0 }); assert.equal(phase(), 'hold', 'assistive click cannot pretend to hold');
    await event('onKeyDown', key('x')); await advance(1200); assert.equal(progress(), 0);
    await event('onKeyDown', key(' ')); await advance(400);
    await event('onKeyDown', key(' ', { repeat: true }));
    await event('onKeyUp', key('Enter')); assert.equal(progress(), .4);
    await advance(600); assert.equal(phase(), 'held'); assert.deepEqual(feedback, ['.', '-']);
    await event('onKeyUp', key(' ')); await event('onClick', { detail: 0 });
    assert.equal(phase(), 'held'); assert.equal(progress(), 1);
    await advance(2400); assert.equal(arrived(), 1); assert.deepEqual(feedback, ['.', '-']);
  });
});

test('a native keyboard or assistive activation can answer the initial tap', async () => {
  await scene({}, async ({ start, event, phase, feedback }) => {
    await start(); await event('onClick', { detail: 0 });
    assert.equal(phase(), 'tap-reply'); assert.deepEqual(feedback, ['.']);
  });
});

test('every automatic scene transition pauses while hidden, blurred or covered', async () => {
  await scene({}, async ({ carrier, event, advance, pointer, phase, pause, hidden, signal, tap, feedback, arrived }) => {
    await advance(800); await pause(true); await advance(6000); assert.equal(phase(), 'launch');
    await pause(false); await advance(1000); assert.equal(phase(), 'tap');
    await tap(); await advance(400); await hidden(true); await advance(6000);
    assert.equal(phase(), 'tap-reply'); await hidden(false); await advance(600); assert.equal(phase(), 'hold');
    await event('onPointerDown', pointer()); await advance(1000); assert.equal(phase(), 'held');
    await advance(400); await signal('blur'); await advance(6000); assert.equal(phase(), 'held');
    await signal('focus'); await advance(600); assert.equal(phase(), 'depart');
    await advance(400); await pause(true); await advance(6000); assert.equal(arrived(), 0);
    await pause(false); await hidden(true); await advance(6000); assert.equal(arrived(), 0);
    await hidden(false); await advance(960); assert.equal(arrived(), 0);
    await advance(40); assert.equal(arrived(), 1); assert.equal(carrier().props.disabled, true);
    await advance(5000); await event('onClick', { detail: 0 });
    assert.equal(arrived(), 1); assert.deepEqual(feedback, ['.', '-']);
  });
});

test('reduced motion shortens travel but still teaches a continuous one-second hold', async () => {
  await scene({ reduced: true }, async ({ toHold, carrier, event, advance, pointer, phase, feedback, arrived }) => {
    await toHold(); assert.equal(carrier().props.style['--launch'], 1);
    await event('onPointerDown', pointer()); await advance(960); assert.equal(phase(), 'hold');
    await advance(40); assert.equal(phase(), 'held');
    await advance(1000); assert.equal(phase(), 'depart');
    await advance(280); assert.equal(arrived(), 0);
    await advance(40); assert.equal(arrived(), 1); assert.deepEqual(feedback, ['.', '-']);
  });
});

test('unmount during a pending press cleans up its animation loop', async () => {
  await scene({}, async ({ toHold, event, advance, pointer, phase }) => {
    await toHold(); await event('onPointerDown', pointer()); await advance(320);
    assert.equal(phase(), 'hold');
  });
});
