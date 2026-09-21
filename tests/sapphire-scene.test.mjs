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
const { SapphireScene } = await import('../components/game/sapphire-scene.tsx');

async function scene(initial, body) {
  const keys = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, saved = initial.rotation ?? 0, done = 0;
  const frames = new Map(), progress = [];
  const host = () => ({ getContext: () => null, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 500 }),
    closest: () => ({ querySelectorAll: () => [] }), style: { setProperty() {} } });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const render = (paused = false, key = 'scene') => React.createElement(SapphireScene, {
    key, rotation: saved, paused, fromPath: true,
    onProgress: (value) => { saved = value; progress.push(value); }, onDone: () => done++, onTap() {},
  });
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  const painting = () => root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
  const sky = () => root.root.findByProps({ className: 'sapphire-sky' });
  const key = async (name, count = 1) => {
    for (let i = 0; i < count; i++) await act(() => sky().props.onKeyDown({ key: name, preventDefault() {} }));
  };
  try {
    await act(() => { root = create(render(), { createNodeMock: host }); });
    await body({
      root, sky, painting, advance, key, progress, done: () => done,
      pause: async (paused) => act(() => root.update(render(paused))),
      reload: async () => act(() => root.update(render(false, 'restored'))),
      pointer: (clientX, pointerId = 1) => ({ clientX, pointerId, button: 0, currentTarget: host(), preventDefault() {} }),
    });
    await act(() => root.unmount()); root = null;
    assert.equal(frames.size, 0, 'unmount releases every visible clock');
  } finally {
    if (root) await act(() => root.unmount());
    for (const name of keys) {
      if (original[name]) Object.defineProperty(globalThis, name, original[name]); else delete globalThis[name];
    }
  }
}

test('shaking around the entry pose and passing a sight without resting cannot unlock it', async () => {
  await scene({}, async ({ key, advance, painting, progress, root, done }) => {
    assert.equal(painting().props.angle, .32);
    assert.equal(painting().props.tint, 1);
    assert.equal(painting().props.libra, true);
    for (let i = 0; i < 12; i++) { await key('ArrowRight'); await key('ArrowLeft'); }
    await advance(5000);
    assert.deepEqual(progress, []);
    await key('ArrowRight', 4); await advance(400); await key('ArrowRight', 5); await advance(5000);
    assert.deepEqual(progress, [], 'crossing the broad window is not enough');
    assert.equal(root.root.findAllByProps({ className: 'sapphire-exit-light' }).length, 0);
    assert.equal(done(), 0);
  });
});

test('stationary alignment pauses for help and hidden tabs, then saves once', async () => {
  await scene({}, async ({ key, advance, progress, pause, reload, painting }) => {
    await key('ArrowRight', 3); await advance(400);
    await pause(true); await advance(8000); assert.deepEqual(progress, []);
    await pause(false);
    document.hidden = true; await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(8000); assert.deepEqual(progress, []);
    document.hidden = false; await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(520); assert.deepEqual(progress, [50]);
    await advance(5000); assert.deepEqual(progress, [50]);
    await reload(); assert.equal(painting().props.discovery.found, 0);
    assert.equal(painting().props.angle, .32, 'restored discoveries preserve the shared entry pose');
    await advance(6000); assert.deepEqual(progress, [50], 'refresh never repeats a reveal');
  });
});

test('a cancelled or blurred pointer gesture restores its starting angle', async () => {
  await scene({}, async ({ sky, advance, progress, pointer, painting }) => {
    await act(() => sky().props.onPointerDown(pointer(0)));
    await act(() => sky().props.onPointerMove(pointer(35)));
    await act(() => sky().props.onPointerMove(pointer(70)));
    await advance(4000); assert.deepEqual(progress, [], 'holding the drag does not count as a settled sight');
    await act(() => sky().props.onPointerCancel());
    assert.equal(painting().props.angle, .32);
    await act(() => sky().props.onPointerUp(pointer(70))); await advance(2000);
    assert.deepEqual(progress, []);
    await act(() => sky().props.onPointerDown(pointer(0)));
    await act(() => sky().props.onPointerMove(pointer(35)));
    await act(() => sky().props.onPointerMove(pointer(70)));
    await act(() => window.dispatchEvent(new Event('blur')));
    assert.equal(painting().props.angle, .32);
    await act(() => window.dispatchEvent(new Event('focus'))); await advance(2000);
    assert.deepEqual(progress, []);
  });
});

test('three different sights reveal in order and wait indefinitely for the exit light', async () => {
  await scene({}, async ({ key, advance, progress, root, done, pause }) => {
    await key('ArrowRight', 3); await advance(1000); assert.deepEqual(progress, [50]);
    await key('ArrowRight', 7); await advance(1000); assert.deepEqual(progress, [50], 'the first meaning remains readable');
    await advance(1000); assert.deepEqual(progress, [50, 100]);
    await key('ArrowRight', 8); await advance(2000); assert.deepEqual(progress, [50, 100, 150]);
    await advance(30000); assert.equal(done(), 0, 'all discoveries do not automatically change scenes');
    const exit = () => root.root.findByProps({ className: 'sapphire-exit-light' });
    await pause(true); await act(() => exit().props.onClick()); await advance(4000); assert.equal(done(), 0);
    await pause(false);
    const click = exit().props.onClick;
    await act(() => { click(); click(); }); await advance(800);
    await pause(true); await advance(5000); assert.equal(done(), 0);
    await pause(false); await advance(1200); assert.equal(done(), 1);
    await advance(5000); assert.equal(done(), 1);
  });
});

test('fully discovered legacy progress restores a usable exit without another forced turn', async () => {
  await scene({ rotation: 150 }, async ({ root, done, advance, progress }) => {
    await advance(5000); assert.equal(done(), 0); assert.deepEqual(progress, []);
    await act(() => root.root.findByProps({ className: 'sapphire-exit-light' }).props.onClick());
    await advance(2000); assert.equal(done(), 1);
  });
});
