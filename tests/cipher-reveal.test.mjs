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
const { CipherReveal } = await import('../components/game/cipher-reveal.tsx');

async function scene(reduced, body) {
  const keys = ['document', 'window', 'matchMedia', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root, now = 0, frameId = 0, completions = 0;
  const frames = new Map();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.window = new EventTarget();
  globalThis.matchMedia = window.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const render = (paused = false) => React.createElement(CipherReveal, { paused, onDone: () => { completions++; } });
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const pending = [...frames.values()]; frames.clear();
      await act(() => pending.forEach((callback) => callback(now)));
    }
  };
  try {
    await act(() => { root = create(render(), { createNodeMock: () => ({ getContext: () => null }) }); });
    await body({ root, advance, completions: () => completions,
      key: () => root.root.findByProps({ 'aria-label': '用 HANA 唤醒藏在粉点中的名字' }),
      next: () => root.root.findByProps({ className: 'cipher-continue' }),
      pause: async (paused) => act(() => root.update(render(paused))),
      visibility: async (hidden) => act(() => { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); }),
    });
  } finally {
    if (root) await act(() => root.unmount());
    assert.equal(frames.size, 0, 'unmount clears the reveal clock');
    for (const key of keys) if (original[key]) Object.defineProperty(globalThis, key, original[key]); else delete globalThis[key];
  }
}

test('the cipher needs HANA, a complete reveal, and one explicit continue action', async () => {
  await scene(false, async ({ root, key, next, advance, completions }) => {
    await advance(12000);
    assert.equal(next().props.disabled, true, 'waiting alone cannot reveal the name');
    await act(() => next().props.onClick()); assert.equal(completions(), 0);
    assert.match(root.root.findByType('canvas').props['aria-label'], /Project N7A-3914/);
    await act(() => key().props.onClick());
    assert.equal(key().props.disabled, true);
    await advance(7960);
    assert.equal(next().props.disabled, true);
    await act(() => next().props.onClick()); assert.equal(completions(), 0);
    await advance(40);
    assert.equal(next().props.disabled, false);
    assert.equal(root.root.findByType('canvas').props['aria-label'], 'W25');
    await advance(6000); assert.equal(completions(), 0, 'the birthday letter waits for the player');
    const finish = next().props.onClick;
    await act(() => { finish(); finish(); });
    assert.equal(completions(), 1);
  });
});

test('help and background tabs pause the reveal and help blocks the final button', async () => {
  await scene(false, async ({ key, next, advance, pause, visibility, completions }) => {
    await act(() => key().props.onClick()); await advance(2000);
    await pause(true); await advance(14000);
    assert.equal(next().props.disabled, true);
    await pause(false); await visibility(true); await advance(14000);
    assert.equal(next().props.disabled, true);
    await visibility(false); await advance(5960);
    assert.equal(next().props.disabled, true);
    await advance(40); assert.equal(next().props.disabled, false);
    await pause(true); await act(() => next().props.onClick()); assert.equal(completions(), 0);
    await pause(false); await act(() => next().props.onClick()); assert.equal(completions(), 1);
  });
});

test('reduced motion still requires HANA and a deliberate handoff after its quiet reveal', async () => {
  await scene(true, async ({ key, next, advance, completions }) => {
    await advance(2000); assert.equal(next().props.disabled, true);
    await act(() => key().props.onClick()); await advance(960);
    assert.equal(next().props.disabled, true); assert.equal(completions(), 0);
    await advance(40); assert.equal(next().props.disabled, false);
    assert.equal(completions(), 0);
    await act(() => next().props.onClick()); assert.equal(completions(), 1);
  });
});

test('a paused HANA key cannot be activated while disabled, then unlocks only after resume', async () => {
  await scene(true, async ({ key, next, pause, advance }) => {
    await pause(true);
    assert.equal(key().props.disabled, true);
    // React's host would not dispatch an activation to a disabled control;
    // invoke the resume path only after asserting the disabled boundary.
    await pause(false);
    assert.equal(key().props.disabled, false);
    await act(() => key().props.onClick());
    await advance(960);
    assert.equal(key().props.disabled, true);
    assert.equal(next().props.disabled, true);
  });
});
