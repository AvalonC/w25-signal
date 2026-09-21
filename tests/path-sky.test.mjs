import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

// Exercise the real hub and gesture lifecycle against a bounded mobile host.
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
const { PathSky } = await import('../components/game/path-sky.tsx');

async function scene(initial, body) {
  const keys = ['document', 'window', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root;
  const captures = new Set(), visits = [];
  const host = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 500 }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  let props = { color: false, dateFound: false, choices: [0, 3, 5], paused: false, onVisit: (place) => visits.push(place), ...initial };
  const carrier = () => root.root.findAllByType('button').find((button) => button.props.className.startsWith('path-carrier'));
  const pointer = (x, y, pointerId = 1) => ({
    clientX: x, clientY: y, pointerId, isPrimary: true, pointerType: 'touch', button: 0, currentTarget: host,
  });
  const drag = async (x, y) => {
    const style = carrier().props.style;
    await act(() => carrier().props.onPointerDown(pointer(parseFloat(style.left) * 4, parseFloat(style.top) * 5)));
    await act(() => carrier().props.onPointerMove(pointer(x, y)));
  };
  try {
    await act(() => { root = create(React.createElement(PathSky, props), { createNodeMock: () => host }); });
    await body({ root, carrier, captures, visits, pointer, drag,
      update: async (next) => { props = { ...props, ...next }; await act(() => root.update(React.createElement(PathSky, props))); },
    });
  } finally {
    if (root) await act(() => root.unmount());
    for (const key of keys) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
}

test('carried light visits a destination only after an uncancelled release', async () => {
  await scene({}, async ({ carrier, captures, visits, pointer, drag }) => {
    await drag(92, 180);
    assert.deepEqual(visits, [], 'reaching the prism while holding must not enter it');
    assert.equal(captures.has(1), true);
    assert.match(carrier().props.className, /path-carrier-near/);
    await act(() => carrier().props.onPointerUp(pointer(92, 180)));
    assert.deepEqual(visits, ['prism']);
    assert.equal(captures.size, 0);
    await act(() => carrier().props.onPointerUp(pointer(92, 180)));
    assert.deepEqual(visits, ['prism'], 'a stale duplicate release cannot enter twice');
  });
});

test('pointer cancellation, capture loss, blur and a hidden document discard the pending visit', async () => {
  for (const interruption of ['cancel', 'capture', 'blur', 'hidden']) {
    await scene({}, async ({ carrier, captures, visits, pointer, drag }) => {
      await drag(92, 180);
      await act(() => {
        if (interruption === 'cancel') carrier().props.onPointerCancel(pointer(92, 180));
        else if (interruption === 'capture') carrier().props.onLostPointerCapture(pointer(92, 180));
        else if (interruption === 'blur') window.dispatchEvent(new Event('blur'));
        else { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
      });
      assert.equal(captures.size, 0, `${interruption} must release the captured pointer`);
      assert.doesNotMatch(carrier().props.className, /path-carrier-near/);
      assert.equal(carrier().props.style.left, '23%', 'the light keeps its actual position');
      assert.equal(carrier().props.style.top, '36%');
      document.hidden = false;
      await act(() => document.dispatchEvent(new Event('visibilitychange')));
      await act(() => carrier().props.onPointerUp(pointer(92, 180)));
      assert.deepEqual(visits, [], `${interruption} must prevent a stale release after returning`);
      await drag(304, 120);
      await act(() => carrier().props.onPointerUp(pointer(304, 120)));
      assert.deepEqual(visits, ['date'], 'a fresh gesture still works after interruption');
    });
  }
});

test('opening help cancels a pending visit and disabled tap alternatives respect pause', async () => {
  await scene({}, async ({ root, carrier, captures, visits, pointer, drag, update }) => {
    await drag(92, 180);
    await update({ paused: true });
    assert.equal(captures.size, 0);
    const prism = root.root.findAllByType('button').find((button) => button.props.className.includes('path-place-prism'));
    assert.equal(prism.props.disabled, true);
    await act(() => prism.props.onClick());
    await update({ paused: false });
    await act(() => carrier().props.onPointerUp(pointer(92, 180)));
    assert.deepEqual(visits, []);
  });
});

test('the sapphire needs both discoveries for dragging and direct touch', async () => {
  await scene({ dateFound: true }, async ({ root, carrier, visits, pointer, drag, update }) => {
    const sapphire = () => root.root.findAllByType('button').find((button) => button.props.className.includes('path-place-sapphire'));
    assert.equal(sapphire().props.disabled, true);
    await act(() => sapphire().props.onClick());
    await drag(248, 345);
    await act(() => carrier().props.onPointerUp(pointer(248, 345)));
    assert.deepEqual(visits, []);
    await update({ color: true });
    assert.equal(sapphire().props.disabled, false);
    await drag(248, 345);
    await act(() => carrier().props.onPointerUp(pointer(248, 345)));
    assert.deepEqual(visits, ['sapphire']);
  });
});
