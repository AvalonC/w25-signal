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
  const frames = new Map(), captures = new Set();
  const height = initial.compact ? 152 : 400;
  const carrierHost = {
    setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const host = (node) => node.props.className === 'guiding-carrier' ? carrierHost : {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height }),
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
    compact: initial.compact, choices: initial.compact ? [0, 3, 5] : [], paused, onArrive: () => arrived++,
  });
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  const carrier = () => root.root.findByProps({ className: 'guiding-carrier' });
  const target = () => root.root.findAllByType('button').find((button) => button.props.className.startsWith('guiding-target'));
  const at = (x, y, pointerId = 1) => ({ clientX: x * 4, clientY: y / 100 * height, pointerId,
    button: 0, currentTarget: carrierHost, preventDefault() {} });
  const origin = initial.compact ? [20, 64] : [27, 74];
  const destination = initial.compact ? [80, 30] : [72, 27];
  try {
    await act(() => { root = create(render(), { createNodeMock: host }); });
    await body({ root, carrier, target, advance, at, origin, destination, captures,
      arrived: () => arrived, pause: async (paused) => act(() => root.update(render(paused))),
      hidden: async (value) => { document.hidden = value; await act(() => document.dispatchEvent(new Event('visibilitychange'))); },
    });
    await act(() => root.unmount()); root = null;
    assert.equal(frames.size, 0, 'unmount cancels the arrival clock');
  } finally {
    if (root) await act(() => root.unmount());
    for (const name of keys) {
      if (original[name]) Object.defineProperty(globalThis, name, original[name]); else delete globalThis[name];
    }
  }
}

test('only an uncancelled release at the destination joins the lights', async () => {
  await scene({}, async ({ carrier, target, advance, at, origin, destination, captures, arrived }) => {
    await act(() => carrier().props.onPointerDown(at(...origin)));
    await act(() => carrier().props.onPointerMove(at(...destination)));
    assert.match(target().props.className, /is-near/);
    await advance(5000); assert.equal(arrived(), 0, 'dragging near the destination is not delivery');
    await act(() => carrier().props.onPointerUp(at(...destination, 2)));
    assert.equal(arrived(), 0, 'another pointer cannot finish the gesture');
    await act(() => carrier().props.onPointerCancel());
    await act(() => carrier().props.onPointerUp(at(...destination)));
    await advance(3000); assert.equal(arrived(), 0); assert.equal(captures.size, 0);
    await act(() => carrier().props.onPointerDown(at(...origin)));
    await act(() => carrier().props.onPointerUp(at(10, 88)));
    await advance(3000); assert.equal(arrived(), 0, 'dropping far away leaves the journey waiting');
    await act(() => carrier().props.onPointerDown(at(...origin)));
    await act(() => carrier().props.onPointerMove(at(...destination)));
    await act(() => carrier().props.onPointerUp(at(...destination)));
    assert.equal(carrier().props.disabled, true);
    await advance(1200); assert.equal(arrived(), 0);
    await advance(240); assert.equal(arrived(), 1);
    await advance(5000); assert.equal(arrived(), 1);
  });
});

test('help, hidden tabs, blur and lost capture cancel pending compact drags', async () => {
  await scene({ compact: true }, async ({ carrier, target, advance, at, origin, destination, captures, arrived, pause, hidden }) => {
    const begin = async () => {
      await act(() => carrier().props.onPointerDown(at(...origin)));
      await act(() => carrier().props.onPointerMove(at(...destination)));
    };
    const release = async () => act(() => carrier().props.onPointerUp(at(...destination)));
    await begin(); await pause(true); await release();
    await act(() => target().props.onClick());
    await act(() => carrier().props.onClick({ detail: 0 }));
    await advance(3000); assert.equal(arrived(), 0); assert.equal(captures.size, 0);
    await pause(false); await begin(); await hidden(true); await release();
    await act(() => target().props.onClick()); await advance(3000); assert.equal(arrived(), 0);
    await hidden(false); await begin(); await act(() => window.dispatchEvent(new Event('blur')));
    await release(); await advance(3000); assert.equal(arrived(), 0);
    await begin(); await act(() => carrier().props.onLostPointerCapture());
    await release(); await advance(3000); assert.equal(arrived(), 0); assert.equal(captures.size, 0);
    await act(() => carrier().props.onClick({ detail: 1 })); await advance(2000);
    assert.equal(arrived(), 0, 'a pointer click on the carrier is not the keyboard alternative');
  });
});

test('direct destination touches arrive once and both help and background pause their animation', async () => {
  await scene({}, async ({ target, carrier, advance, arrived, pause, hidden }) => {
    const click = target().props.onClick;
    await act(() => { click(); click(); carrier().props.onClick({ detail: 0 }); });
    await advance(400); assert.equal(arrived(), 0);
    await pause(true); await advance(8000); assert.equal(arrived(), 0);
    await pause(false); await hidden(true); await advance(8000); assert.equal(arrived(), 0);
    await hidden(false); await advance(800); assert.equal(arrived(), 0);
    await advance(240); assert.equal(arrived(), 1);
    await act(() => click()); await advance(3000); assert.equal(arrived(), 1);
  });
});

test('the carrier accepts a native keyboard click and reduced motion completes quietly', async () => {
  await scene({ compact: true, reduced: true }, async ({ carrier, advance, arrived }) => {
    // Native Enter/Space activation on a button dispatches a click with detail 0.
    await act(() => carrier().props.onClick({ detail: 0 }));
    assert.equal(carrier().props.style.left, '80%');
    assert.equal(carrier().props.style.top, '30%');
    await advance(240); assert.equal(arrived(), 0);
    await advance(80); assert.equal(arrived(), 1);
    await advance(3000); assert.equal(arrived(), 1);
  });
});
