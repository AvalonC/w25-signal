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

test('real relay pauses under help, cancels interrupted holds, delivers once, and releases its clocks', async () => {
  const original = Object.fromEntries(['document','window','performance','requestAnimationFrame','cancelAnimationFrame'].map((key) => [key, globalThis[key]]));
  let now = 0, next = 0;
  const received = [];
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
    onDelivered: (wish) => received.push(wish), onTone() {}, onTouch() {} };
  const advance = async (ms) => {
    for (let i=0; i<ms; i+=40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((fn) => fn(now)));
    }
  };
  let root;
  const near = () => root.root.findAllByType('button').find((b) => b.props.className?.startsWith('relay-near'));
  const phase = () => root.root.findByType('section').props.className;
  const event = { key:' ', repeat:false, preventDefault() {} };
  try {
    await act(() => { root = create(React.createElement(EchoRelay, props)); });
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
    await act(() => near().props.onKeyDown(event));
    await advance(1200);
    await act(() => window.dispatchEvent(new Event('blur')));
    await act(() => near().props.onKeyUp(event));
    assert.match(phase(), /relay-answer/, 'blur must cancel rather than send a long pulse');
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
    await advance(6000);
    assert.deepEqual(received, [0], 'automatic arrival fires once, without a confirmation button');
    // Reproduce the screenshot: curiosity + wonder, on the reversed second shore.
    await act(() => root.update(React.createElement(EchoRelay, {
      ...props, key: 'hint-regression', choices: [5, 2, 4], delivered: [5],
    })));
    const wonder = root.root.findAllByType('button').find((b) => b.props['aria-label']?.startsWith('惊喜。'));
    await act(() => wonder.props.onClick());
    await advance(8000);
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
    await act(() => root.unmount());
    assert.equal(frames.size, 0);
  } finally {
    if (root) await act(() => root.unmount());
    for (const [key,value] of Object.entries(original)) Object.defineProperty(globalThis, key, { configurable:true, writable:true, value });
  }
});
