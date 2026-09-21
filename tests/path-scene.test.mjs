import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';

// Mount the actual scenes and their clocks; only canvas painting and host DOM are absent.
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
const { StarPathJourney } = await import('../components/game/star-path-journey.tsx');
const { freshPath } = await import('../lib/star-path.ts');

async function scene(initial, body) {
  const keys = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, current;
  const frames = new Map(), discoveries = [];
  const host = () => ({
    getContext: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 500 }),
    closest: () => ({ querySelectorAll: () => [] }),
    style: { setProperty() {} },
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {},
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: !!initial.reduced, addEventListener() {}, removeEventListener() {} });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  function Harness({ paused = false }) {
    const [path, setPath] = useState(initial.path);
    const [date, setDate] = useState({ month: initial.month ?? 1, day: initial.day ?? 1 });
    current = { path, ...date };
    return React.createElement(StarPathJourney, {
      path, ...date, paused, choices: [0, 3, 5], rotation: 0,
      onPath: (next) => { discoveries.push(next); setPath(next); },
      onDate: (month, day) => setDate({ month, day }),
      onRotation() {}, onComplete() {}, onTap() {},
    });
  }
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40;
      const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  try {
    await act(() => { root = create(React.createElement(Harness), { createNodeMock: host }); });
    await body({
      root, advance, discoveries, current: () => current,
      pause: async (paused) => act(() => root.update(React.createElement(Harness, { paused }))),
      pointer: (clientX, clientY, pointerId = 1) => ({
        clientX, clientY, pointerId, isPrimary: true, pointerType: 'touch', button: 0,
        currentTarget: host(), preventDefault() {},
      }),
    });
    await act(() => root.unmount()); root = null;
    assert.equal(frames.size, 0, 'leaving the journey must release every scene clock');
  } finally {
    if (root) await act(() => root.unmount());
    for (const key of keys) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
}

test('finding pink needs a continuous pause at the right angle; cancelled drags and help do not finish it', async () => {
  await scene({ path: { ...freshPath(), place: 'prism' } }, async ({ root, advance, current, discoveries, pause, pointer }) => {
    const prism = () => root.root.findByProps({ className: 'prism-light' });
    const key = async (name) => act(() => prism().props.onKeyDown({ key: name, preventDefault() {} }));
    await act(() => prism().props.onPointerDown(pointer(0, 0)));
    await act(() => prism().props.onPointerMove(pointer(162.5, 0)));
    assert.equal(prism().props['aria-valuenow'], 68);
    await act(() => prism().props.onPointerCancel());
    await act(() => prism().props.onPointerMove(pointer(0, 0)));
    assert.equal(prism().props['aria-valuenow'], 68, 'a cancelled gesture no longer moves the glass');
    await advance(400);
    await key('ArrowLeft'); await key('ArrowLeft');
    await advance(1000);
    assert.equal(current().path.color, false);
    await key('ArrowRight'); await key('ArrowRight');
    await advance(400);
    assert.equal(prism().props['aria-disabled'], false, 'leaving the colour window resets its dwell');
    await advance(400);
    assert.equal(prism().props['aria-disabled'], true, 'the player has found the angle and light is spreading');
    await pause(true); await advance(8000);
    assert.equal(current().path.color, false, 'help pauses the light-spreading animation');
    await pause(false); await advance(4000);
    assert.equal(current().path.color, true);
    assert.equal(current().path.place, 'prism', 'the player decides when to bring the light home');
    await advance(5000);
    assert.equal(discoveries.length, 1);
  });
});

test('October eighth gathers the dials once, retains its place, and pauses when the player leaves the tab', async () => {
  await scene({ path: { ...freshPath(), place: 'date' }, month: 10, day: 7 }, async ({ root, advance, current, discoveries }) => {
    await advance(1200);
    assert.equal(current().path.dateFound, false, 'a neighbouring date must not unlock the stone');
    await act(() => root.root.findByProps({ 'aria-label': '日加一' }).props.onClick());
    assert.equal(current().day, 8);
    await advance(800);
    assert.equal(root.root.findByProps({ className: 'date-wheels' }).props.inert, true);
    await advance(2000);
    document.hidden = true;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(14000);
    assert.equal(current().path.dateFound, false, 'time outside the game does not skip the gathering');
    document.hidden = false;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(7000);
    assert.equal(current().path.dateFound, true);
    assert.equal(current().path.place, 'date');
    await advance(12000);
    assert.equal(discoveries.length, 1);
    assert.equal(root.root.findAllByProps({ className: 'date-wheels' }).length, 0);
  });
});

test('pink light only enters the stone on a completed delivery; cancellation, a missed drop and help remain safe', async () => {
  await scene({ path: { place: 'sapphire', color: true, dateFound: true, infused: false } }, async ({ root, advance, current, discoveries, pause, pointer }) => {
    const carried = () => root.root.findByProps({ className: 'path-carried-light' });
    await act(() => carried().props.onPointerDown(pointer(96, 395)));
    await act(() => carried().props.onPointerMove(pointer(200, 235)));
    await act(() => carried().props.onPointerCancel());
    await act(() => carried().props.onPointerUp(pointer(200, 235)));
    assert.equal(current().path.infused, false);
    await act(() => carried().props.onPointerDown(pointer(96, 395)));
    await act(() => carried().props.onPointerUp(pointer(25, 460)));
    assert.equal(current().path.infused, false, 'dropping far away keeps the carried light');
    await act(() => carried().props.onPointerDown(pointer(96, 395)));
    await pause(true);
    await act(() => carried().props.onPointerUp(pointer(200, 235)));
    assert.equal(current().path.infused, false, 'opening help cancels the gesture');
    const target = () => root.root.findByProps({ className: 'path-stone-target' });
    await act(() => target().props.onClick());
    assert.equal(current().path.infused, false, 'the accessible tap alternative also respects help');
    await pause(false);
    const deliver = target().props.onClick;
    await act(() => { deliver(); deliver(); });
    assert.equal(current().path.infused, false, 'the stone stays on screen while light travels into it');
    assert.equal(target().props.disabled, true, 'another delivery cannot restart the arrival');
    await advance(1200);
    await pause(true); await advance(8000);
    assert.equal(current().path.infused, false, 'help pauses an arrival already in progress');
    await pause(false);
    document.hidden = true;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(8000);
    assert.equal(current().path.infused, false, 'leaving the tab must not skip facet illumination');
    document.hidden = false;
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(1900);
    assert.equal(current().path.infused, true, 'directly touching the stone remains a usable alternative to dragging');
    assert.equal(discoveries.length, 1, 'a double tap delivers exactly once');
    assert.equal(root.root.findAllByProps({ className: 'path-carried-light' }).length, 0);
    const canvas = root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
    assert.equal(canvas.props.formation, 1, 'handoff keeps the formed silhouette');
    assert.equal(canvas.props.tint, 1, 'handoff keeps the pink light');
    assert.equal(canvas.props.angle, .32, 'handoff keeps the view angle');
    assert.equal(canvas.props.libra, true, 'birthday orbit does not blink away');
    await advance(4000);
    assert.equal(discoveries.length, 1);
  });
});

test('reduced motion uses a short quiet arrival and still hands off exactly once', async () => {
  await scene({ reduced: true, path: { place: 'sapphire', color: true, dateFound: true, infused: false } },
    async ({ root, advance, current, discoveries }) => {
      await act(() => root.root.findByProps({ className: 'path-stone-target' }).props.onClick());
      await advance(600);
      assert.equal(current().path.infused, false);
      const painting = root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
      assert.equal(painting.props.radiance, 0, 'no bloom pulse when motion is reduced');
      await advance(600);
      assert.equal(current().path.infused, true);
      assert.equal(discoveries.length, 1);
    });
});
