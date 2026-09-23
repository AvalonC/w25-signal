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
const { BlessingAscent } = await import('../components/game/blessing-ascent.tsx');
const { blessingDuration, blessingLines } = await import('../lib/blessing-ascent.ts');

async function setup(run, reduced = false) {
  const originals = Object.fromEntries(['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  const frames = new Map(); let now = 0, next = 0, exits = 0, feedback = 0, root;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {} } });
  globalThis.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const props = { choices: [0, 4, 5], origin: { x: .71, y: .63 }, paused: false, onExit() { exits++; }, onFeedback() { feedback++; } };
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((fn) => fn(now)));
    }
  };
  const node = { setPointerCapture() {}, hasPointerCapture() { return false; }, getBoundingClientRect() { return { left: 120, top: 70, width: 78, height: 78 }; } };
  const pointer = (id = 1, extra = {}) => ({ isPrimary: true, button: 0, pointerId: id, currentTarget: node, preventDefault() {}, ...extra });
  const key = (k = ' ', extra = {}) => ({ key: k, repeat: false, preventDefault() {}, ...extra });
  try {
    await act(() => { root = create(React.createElement(BlessingAscent, props)); });
    await run({ root, props, advance, pointer, key, star: () => root.root.findByProps({ className: 'blessing-main-star' }),
      phase: () => root.root.findByType('section').props['data-phase'], exits: () => exits, feedback: () => feedback,
      update: async (patch) => act(() => root.update(React.createElement(BlessingAscent, { ...props, ...patch }))),
      ready: async () => advance(blessingDuration(blessingLines(props.choices).length, reduced) + 100),
      hold: () => root.root.findByType('section').props.style['--blessing-hold'],
    });
  } finally {
    if (root) await act(() => root.unmount());
    for (const [key, value] of Object.entries(originals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
}

test('actual blessing pauses while covered, keeps its verses and unlocks only after settling', () => setup(async ({ root, star, phase, props, advance, pointer, key, update, ready, exits }) => {
  assert.equal(star().props.style.left, '71%');
  assert.equal(star().props.style.top, '63%');
  assert.equal(star().props.disabled, true);
  await act(() => { star().props.onPointerDown(pointer()); star().props.onKeyDown(key()); star().props.onClick({ detail: 0 }); });
  await advance(1600);
  assert.equal(exits(), 0, 'early input cannot exit');
  assert.equal(phase(), 'blessing');
  assert.ok(root.root.findByProps({ className: 'blessing-verses' }).props.style.top < '64%');
  await update({ paused: true });
  const frozen = star().props.style;
  await advance(8000);
  assert.deepEqual(star().props.style, frozen);
  await update({ paused: false });
  await act(() => window.dispatchEvent(new Event('blur')));
  const blurredStar = star().props.style;
  await advance(6000);
  assert.deepEqual(star().props.style, blurredStar, 'window blur pauses the ascent');
  await act(() => window.dispatchEvent(new Event('focus')));
  document.hidden = true;
  await act(() => document.dispatchEvent(new Event('visibilitychange')));
  await advance(8000);
  assert.deepEqual(star().props.style, frozen);
  document.hidden = false;
  await act(() => document.dispatchEvent(new Event('visibilitychange')));
  await ready();
  assert.equal(phase(), 'ready');
  assert.equal(star().props.disabled, false);
  const lines = root.root.findAll((n) => n.props.className?.split(' ').includes('blessing-verse'));
  assert.deepEqual(lines.map((n) => n.children.join('')), blessingLines(props.choices));
  assert.ok(lines.every((n) => n.props.style.opacity === 1));
  assert.doesNotMatch(JSON.stringify(root.toJSON()), /HANA|W25|N7A|解密/);
  const resting = star().props.style;
  await advance(10000);
  assert.deepEqual(star().props.style, resting);
  assert.equal(exits(), 0, 'there is no automatic exit');
  await act(() => star().props.onKeyUp(key()));
  assert.equal(exits(), 0, 'releasing an early key cannot exit later');
}));

test('continuous primary-pointer hold exits once; cancellation, movement, help and hidden time never accumulate', () => setup(async ({ star, advance, pointer, ready, hold, update, exits }) => {
  await ready();
  await act(() => { star().props.onPointerDown(pointer(2, { isPrimary: false })); star().props.onPointerDown(pointer(1, { button: 2 })); });
  await advance(3200);
  assert.equal(exits(), 0);
  await act(() => star().props.onPointerDown(pointer()));
  await advance(900);
  await act(() => star().props.onPointerUp(pointer(2)));
  assert.ok(hold() > 0, 'a different pointer cannot stop the primary hold');
  await act(() => star().props.onPointerCancel(pointer()));
  assert.equal(hold(), 0);
  await act(() => star().props.onClick({ detail: 1 }));
  assert.equal(exits(), 0, 'short mouse clicks cannot exit');
  for (const interrupt of [
    () => star().props.onLostPointerCapture(pointer()),
    () => star().props.onPointerMove(pointer(1, { clientX: 600, clientY: 700 })),
    () => window.dispatchEvent(new Event('blur')),
  ]) {
    await act(() => star().props.onPointerDown(pointer()));
    await advance(1200); await act(interrupt); await advance(2100);
    await act(() => window.dispatchEvent(new Event('focus')));
    assert.equal(hold(), 0); assert.equal(exits(), 0);
  }
  await act(() => star().props.onPointerDown(pointer()));
  await advance(1200); await update({ paused: true }); await advance(6000); await update({ paused: false });
  assert.equal(hold(), 0); assert.equal(exits(), 0);
  await act(() => star().props.onPointerDown(pointer()));
  await advance(1200);
  document.hidden = true; await act(() => document.dispatchEvent(new Event('visibilitychange'))); await advance(6000);
  document.hidden = false; await act(() => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(hold(), 0); assert.equal(exits(), 0);
  await act(() => star().props.onPointerDown(pointer()));
  await advance(2800); assert.equal(exits(), 0);
  await advance(240); assert.equal(exits(), 1);
  await act(() => { star().props.onPointerUp(pointer()); star().props.onClick({ detail: 0 }); });
  await advance(10000); assert.equal(exits(), 1);
}));

test('paired keyboard holds ignore repeat and mismatched releases; short keyboard clicks do not exit', () => setup(async ({ star, ready, key, advance, hold, exits }) => {
  await ready();
  await act(() => star().props.onKeyDown(key(' ', { repeat: true })));
  await advance(3200); assert.equal(exits(), 0);
  await act(() => star().props.onKeyDown(key()));
  await advance(120); await act(() => star().props.onKeyUp(key()));
  await act(() => star().props.onClick({ detail: 0 }));
  assert.equal(exits(), 0, 'the browser-generated keyboard click is suppressed');
  await act(() => star().props.onKeyDown(key('Enter')));
  await advance(1400); await act(() => star().props.onKeyUp(key(' ')));
  assert.ok(hold() > 0, 'release must match the held key');
  await act(() => star().props.onKeyDown(key('Enter', { repeat: true })));
  await advance(1400); assert.equal(exits(), 0);
  await advance(240); assert.equal(exits(), 1);
  await act(() => { star().props.onKeyUp(key('Enter')); star().props.onClick({ detail: 0 }); });
  assert.equal(exits(), 1);
}));

test('reduced motion and assistive activation preserve verses and offer a direct accessible exit', () => setup(async ({ star, ready, advance, exits }) => {
  const fixed = { left: star().props.style.left, top: star().props.style.top };
  await advance(2400);
  assert.deepEqual({ left: star().props.style.left, top: star().props.style.top }, fixed);
  await ready();
  assert.match(star().props['aria-label'], /直接返回星空/);
  await act(() => star().props.onClick({ detail: 0 }));
  assert.equal(exits(), 1);
}, true));



test('blur blocks input synchronously until focus and hidden RAF time cannot complete a hold', () => setup(async ({ star, advance, pointer, ready, hold, exits }) => {
  await ready();
  await act(() => {
    window.dispatchEvent(new Event('blur'));
    star().props.onPointerDown(pointer());
    star().props.onClick({ detail: 0 });
  });
  await advance(3400);
  assert.equal(hold(), 0);
  assert.equal(exits(), 0, 'the pre-render event handlers cannot bypass blur');
  await act(() => star().props.onPointerDown(pointer()));
  await advance(3400);
  assert.equal(exits(), 0, 'new gestures remain blocked until focus returns');
  await act(() => window.dispatchEvent(new Event('focus')));
  await act(() => star().props.onPointerDown(pointer()));
  await advance(2800);
  document.hidden = true;
  await advance(400);
  assert.equal(exits(), 0, 'document.hidden is checked by the RAF before visibility state commits');
  assert.equal(hold(), 0);
  await act(() => star().props.onClick({ detail: 0 }));
  assert.equal(exits(), 0, 'assistive activation also observes document.hidden immediately');
  document.hidden = false;
  await act(() => star().props.onPointerDown(pointer()));
  await advance(3040);
  assert.equal(exits(), 1);
}));
