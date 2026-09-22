/* oxlint-disable react/react-compiler */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React, { useState } from 'react';
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
const { WishSky } = await import('../components/game/wish-sky.tsx');

async function scene(initial, body) {
  const keys = ['document', 'window', 'ResizeObserver', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root, now = 0, frameId = 0, current = [], completions = 0;
  const frames = new Map(), observers = new Set(), chosen = [], fields = [];
  const host = { getBoundingClientRect: () => ({ left: 20, top: 100, width: 320, height: 500 }),
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}, getContext: () => null };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: !!initial.reduced, addEventListener() {}, removeEventListener() {} });
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  function Harness({ paused = false }) {
    const [choices, setChoices] = useState(initial.choices ?? []); current = choices;
    return React.createElement(WishSky, { choices, paused,
      onChoose: (i) => { chosen.push(i); setChoices((old) => old.includes(i) || old.length >= 3 ? old : [...old, i]); },
      onField: (field) => fields.push(field), onDone: () => { completions++; },
    });
  }
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const pending = [...frames.values()]; frames.clear();
      await act(() => pending.forEach((callback) => callback(now)));
    }
  };
  try {
    await act(() => { root = create(React.createElement(Harness), { createNodeMock: () => host }); });
    await body({ root, advance, chosen, fields, choices: () => current, completions: () => completions,
      star: (i) => root.root.findAllByType('button').filter((node) => node.props.className.startsWith('wish-star'))[i],
      pause: async (paused) => act(() => root.update(React.createElement(Harness, { paused }))),
      visibility: async (hidden) => act(() => { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); }),
      pointer: (pointerId = 1, clientX = 100, clientY = 150) => ({ pointerId, clientX, clientY, button: 0, isPrimary: true, currentTarget: host }),
    });
  } finally {
    if (root) await act(() => root.unmount());
    assert.equal(frames.size, 0, 'leaving the wish sky clears both scene clocks');
    assert.equal(observers.size, 0, 'leaving the wish sky disconnects its layout observer');
    assert.equal(fields.at(-1), null, 'the shared starfield must release its wish overlay');
    for (const key of keys) if (original[key]) Object.defineProperty(globalThis, key, original[key]); else delete globalThis[key];
  }
}

test('wishes support an ordinary pointer tap, a dragged release and native keyboard activation', async () => {
  await scene({}, async ({ star, pointer, choices, chosen, fields, advance, completions }) => {
    await act(() => star(0).props.onPointerDown(pointer()));
    assert.deepEqual(choices(), [], 'a held star is not selected before release');
    await act(() => star(0).props.onPointerUp(pointer()));
    await act(() => star(0).props.onClick({ detail: 1 }));
    await act(() => star(3).props.onPointerDown(pointer(2, 71, 320)));
    await act(() => star(3).props.onPointerUp(pointer(2, 172, 490)));
    await advance(6000);
    assert.equal(completions(), 0, 'two wishes must never start the departure');
    await act(() => star(5).props.onClick({ detail: 0 }));
    assert.deepEqual(choices(), [0, 3, 5]); assert.deepEqual(chosen, [0, 3, 5]);
    for (let i = 0; i < 8; i++) assert.equal(star(i).props.disabled, true);
    await act(() => star(1).props.onClick({ detail: 0 }));
    assert.deepEqual(chosen, [0, 3, 5], 'a fourth wish cannot join a full carrier');
    const field = fields.at(-1);
    assert.equal(field.nodes.length, 8);
    assert.deepEqual(field.nodes.filter((node) => node.selected).map((node) => [node.word, node.order]), [['勇气', 0], ['平静', 1], ['好奇', 2]]);
    assert.equal(field.departing, false);
  });
});

test('three wishes orbit before flying to the next scene and hand off only once', async () => {
  await scene({ choices: [0, 3, 5] }, async ({ fields, advance, completions }) => {
    await advance(2000);
    assert.equal(fields.at(-1).departing, false); assert.equal(completions(), 0);
    assert.deepEqual(fields.at(-1).carrier, { x: 180, y: 485 });
    await advance(160);
    assert.equal(fields.at(-1).departing, true); assert.equal(completions(), 0);
    await advance(720);
    const middle = fields.at(-1).carrier;
    assert.ok(middle.x < 180 && middle.x > 103.2 && middle.y < 485, 'flight bends upward while travelling to the star-path entry');
    assert.equal(completions(), 0);
    await advance(1000);
    assert.equal(completions(), 1);
    assert.ok(Math.abs(fields.at(-1).carrier.x - 103.2) < 1e-10);
    assert.equal(fields.at(-1).carrier.y, 490);
    await advance(5000); assert.equal(completions(), 1);
  });
});

test('help and a hidden document pause the orbit and flight instead of skipping either phase', async () => {
  await scene({ choices: [0, 3, 5] }, async ({ fields, pause, visibility, advance, completions }) => {
    await advance(1000); await pause(true); await advance(9000);
    assert.equal(fields.at(-1).departing, false);
    await pause(false); await visibility(true); await advance(9000);
    assert.equal(fields.at(-1).departing, false);
    await visibility(false); await advance(1200);
    assert.equal(fields.at(-1).departing, true);
    await advance(400); const before = fields.at(-1).carrier;
    await pause(true); await advance(9000);
    assert.deepEqual(fields.at(-1).carrier, before); assert.equal(completions(), 0);
    await pause(false); await visibility(true); await advance(9000);
    assert.deepEqual(fields.at(-1).carrier, before); assert.equal(completions(), 0);
    await visibility(false); await advance(1300);
    assert.equal(completions(), 1);
  });
});

test('cancelled, lost, interrupted and mismatched gestures never choose a wish on a stale release', async () => {
  for (const reason of ['cancel', 'capture', 'blur', 'hidden', 'help', 'mismatched']) {
    await scene({}, async ({ star, pointer, choices, pause, visibility }) => {
      await act(() => star(2).props.onPointerDown(pointer()));
      if (reason === 'cancel') await act(() => star(2).props.onPointerCancel());
      if (reason === 'capture') await act(() => star(2).props.onLostPointerCapture());
      if (reason === 'blur') await act(() => window.dispatchEvent(new Event('blur')));
      if (reason === 'hidden') { await visibility(true); await visibility(false); }
      if (reason === 'help') { await pause(true); await pause(false); }
      await act(() => star(2).props.onPointerUp(pointer(reason === 'mismatched' ? 2 : 1)));
      assert.deepEqual(choices(), [], reason + ' must not select');
    });
  }
});

test('keyboard choice respects help and visibility and reduced motion still preserves orbit before departure', async () => {
  await scene({ reduced: true }, async ({ star, pause, visibility, advance, fields, completions }) => {
    await pause(true); await act(() => star(0).props.onClick({ detail: 0 }));
    assert.equal(star(0).props['aria-pressed'], false);
    await pause(false); await visibility(true); await act(() => star(0).props.onClick({ detail: 0 }));
    assert.equal(star(0).props['aria-pressed'], false);
    await visibility(false);
    for (const i of [0, 3, 5]) await act(() => star(i).props.onClick({ detail: 0 }));
    await advance(320); assert.equal(fields.at(-1).departing, false);
    await advance(80); assert.equal(fields.at(-1).departing, true); assert.equal(completions(), 0);
    await advance(320); assert.equal(completions(), 1);
  });
});
