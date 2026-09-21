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
    // The WebGL custom element is tested visually; keep its real slotted children here.
    if (url.endsWith('/model-surface.tsx')) return { format: 'module', shortCircuit: true,
      source: `import {createElement} from 'react';export function ModelSurface(p){return createElement('div',{'data-model':p.src},p.children)}` };
    if (url.endsWith('/jewelry-metadata.json')) return { format: 'module', shortCircuit: true,
      source: `export default ${readFileSync(new URL(url), 'utf8')}` };
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return next(url, context);
  },
});
const { PathClosure } = await import('../components/game/path-closure.tsx');
const { CLOSURE_START, CLOSURE_TARGET, closureTimeline } = await import('../lib/path-closure.ts');

async function scene(reduced, body) {
  const keys = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, completions = 0;
  const frames = new Map(), captured = new Set();
  const host = () => ({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
    setPointerCapture: (id) => captured.add(id), hasPointerCapture: (id) => captured.has(id), releasePointerCapture: (id) => captured.delete(id),
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const render = (paused = false) => React.createElement(PathClosure, { choices: [0, 3, 5], paused, onComplete: () => { completions++; } });
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  try {
    await act(() => { root = create(render(), { createNodeMock: host }); });
    await body({ root, advance, completions: () => completions, captured,
      pause: async (paused) => act(() => root.update(render(paused))),
      visibility: async (hidden) => act(() => { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); }),
      pointer: (point, pointerId = 1) => ({ clientX: point.x * 3, clientY: point.y * 3, pointerId,
        isPrimary: true, button: 0, currentTarget: host(), preventDefault() {} }),
    });
    await act(() => root.unmount()); root = null;
    assert.equal(frames.size, 0, 'leaving the closure must release the scene clocks');
  } finally {
    if (root) await act(() => root.unmount());
    for (const key of keys) if (original[key]) Object.defineProperty(globalThis, key, original[key]); else delete globalThis[key];
  }
}

test('closure requires a completed drag or accessible activation; misses, cancellation and help do not deliver', async () => {
  await scene(false, async ({ root, advance, pointer, pause, captured, completions }) => {
    const carried = () => root.root.findByProps({ className: 'closure-carried' });
    const target = () => root.root.findByProps({ 'aria-label': '接通最后一段星路' });
    await act(() => target().props.onClick());
    assert.equal(target().props.disabled, true, 'the path must finish pulling back before it can close');
    await advance(2400);
    await act(() => carried().props.onPointerDown(pointer(CLOSURE_START)));
    await act(() => carried().props.onPointerMove(pointer(CLOSURE_TARGET)));
    await act(() => carried().props.onPointerCancel());
    await act(() => carried().props.onPointerUp(pointer(CLOSURE_TARGET)));
    assert.equal(captured.size, 0);
    await act(() => carried().props.onPointerDown(pointer(CLOSURE_START)));
    await act(() => carried().props.onPointerUp(pointer({ x: 10, y: 20 })));
    assert.equal(root.root.findAllByProps({ className: 'closure-continue' }).length, 0);
    await act(() => carried().props.onPointerDown(pointer(CLOSURE_START)));
    await pause(true);
    await act(() => carried().props.onPointerUp(pointer(CLOSURE_TARGET)));
    await act(() => target().props.onClick());
    assert.equal(root.root.findAllByProps({ className: 'closure-continue' }).length, 0);
    await pause(false);
    await act(() => carried().props.onPointerDown(pointer(CLOSURE_START)));
    await act(() => carried().props.onPointerMove(pointer(CLOSURE_TARGET)));
    await act(() => carried().props.onPointerUp(pointer(CLOSURE_TARGET)));
    assert.equal(captured.size, 0);
    assert.equal(root.root.findByProps({ className: 'closure-continue' }).props.disabled, true);
    assert.equal(completions(), 0, 'closing starts the model interpretation instead of skipping it');
  });
});

test('real model groups remain inspectable and the handoff needs one explicit action after visible playback', async () => {
  await scene(false, async ({ root, advance, pause, visibility, completions }) => {
    await advance(2400);
    await act(() => root.root.findByProps({ className: 'closure-carried' }).props.onClick({ detail: 0 }));
    const next = () => root.root.findByProps({ className: 'closure-continue' });
    await act(() => next().props.onClick());
    assert.equal(completions(), 0);
    await advance(3000);
    await pause(true); await advance(25000);
    assert.equal(next().props.disabled, true);
    await pause(false); await visibility(true); await advance(25000);
    assert.equal(next().props.disabled, true);
    await visibility(false); await advance(closureTimeline().duration);
    assert.equal(completions(), 0, 'the player may stay with the revealed object for as long as they need');
    assert.equal(next().props.disabled, false);
    const second = root.root.findByProps({ 'aria-label': '查看手链上的 2，..---' });
    await act(() => second.props.onClick());
    assert.equal(second.props['aria-pressed'], true);
    const glowing = root.root.findAll((node) => typeof node.props.slot === 'string' && node.props.slot.startsWith('hotspot-morse') && node.props.className.includes('is-lit'));
    assert.equal(glowing.length, 11, 'two round diamonds and three actual triple-diamond bars light together');
    const finish = next().props.onClick;
    await act(() => { finish(); finish(); });
    assert.equal(completions(), 1);
  });
});

test('reduced motion retains all model groups and the same explicit completion gate', async () => {
  await scene(true, async ({ root, advance, completions }) => {
    const target = root.root.findByProps({ 'aria-label': '接通最后一段星路' });
    await act(() => target.props.onClick());
    await advance(closureTimeline(true).duration + 80);
    assert.equal(root.root.findByProps({ className: 'closure-continue' }).props.disabled, false);
    assert.equal(completions(), 0);
    await act(() => root.root.findByProps({ className: 'closure-continue' }).props.onClick());
    assert.equal(completions(), 1);
  });
});
