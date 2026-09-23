import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@google/model-viewer') return { url: 'test:model-viewer', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:model-viewer') return { format: 'module', shortCircuit: true, source: 'export {};' };
    if (url.endsWith('/model-surface.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return next(url, context);
  },
});
const { ModelSurface } = await import('../components/game/model-surface.tsx');

class Viewer extends EventTarget {
  loaded = false;
  isConnected = true;
  rect = { left: 24, top: 80, width: 360, height: 360 };
  orbit = { theta: .2, phi: .3, radius: .12 };
  target = { x: 0, y: .01, z: -.02 };
  fov = 32;
  updateComplete = Promise.resolve();
  listeners = new Map();
  writes = [];
  jumps = 0;
  getBoundingClientRect() { return { ...this.rect }; }
  getCameraOrbit() { return { ...this.orbit }; }
  getCameraTarget() { return { ...this.target }; }
  getFieldOfView() { return this.fov; }
  setAttribute(...args) { this.writes.push(args); }
  jumpCameraToGoal() { this.jumps++; }
  addEventListener(type, listener, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    this.listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  listenerCount() { return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0); }
}

async function scene(body) {
  const keys = ['ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const viewers = [], observers = [], views = [], ready = [], handle = React.createRef();
  let root, props = { src: 'bracelet-a.glb', poster: 'bracelet.webp', label: '手链', interactive: false,
    onViewChange: (view) => views.push(view), onReady: (value) => ready.push(value), viewerRef: handle };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    disconnected = false;
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  };
  const change = async (patch) => {
    props = { ...props, ...patch };
    await act(async () => { root.update(React.createElement(ModelSurface, props)); });
  };
  const dispatch = async (viewer, event) => act(async () => { viewer.dispatchEvent(new Event(event)); });
  const load = async (viewer = viewers.at(-1)) => { viewer.loaded = true; await dispatch(viewer, 'load'); };
  const unmount = async () => { if (root) { await act(() => root.unmount()); root = null; } };
  try {
    await act(async () => {
      root = create(React.createElement(ModelSurface, props), { createNodeMock: (element) => {
        if (element.type !== 'model-viewer') return {};
        const viewer = new Viewer(); viewers.push(viewer); return viewer;
      } });
    });
    await act(async () => { await new Promise((resolve) => setImmediate(resolve)); });
    await body({ viewers, observers, views, ready, handle, change, dispatch, load, unmount, root: () => root });
  } finally {
    await unmount();
    for (const key of keys) if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key];
  }
}

test('model projection updates are read-only, deduplicated, and use the latest callback without resubscribing', async () => {
  await scene(async ({ viewers, observers, views, handle, load, dispatch, change }) => {
    assert.deepEqual(views, [null], 'unloaded geometry must not keep an old projection');
    const viewer = viewers.at(-1);
    await load(viewer);
    assert.deepEqual(views.at(-1), { ...viewer.orbit, target: [0, .01, -.02], fov: 32, ...viewer.rect });
    assert.equal(views.length, 2);
    await dispatch(viewer, 'camera-change');
    await dispatch(viewer, 'camera-change');
    assert.equal(views.length, 2, 'unchanged camera events must not cause parent renders');
    assert.deepEqual(viewer.writes, []);
    assert.equal(viewer.jumps, 0);
    const nextViews = [], observerCount = observers.length, listenerCount = viewer.listenerCount();
    await change({ onViewChange: (view) => nextViews.push(view) });
    assert.equal(observers.length, observerCount, 'callback identity changes must keep the active observer');
    assert.equal(viewer.listenerCount(), listenerCount);
    viewer.orbit.phi = .5;
    await dispatch(viewer, 'camera-change');
    assert.equal(nextViews.length, 1);
    assert.equal(nextViews[0].phi, .5);
    assert.equal(views.length, 2);
    assert.deepEqual(viewer.writes, [], 'observing a camera must never set camera-orbit');
    assert.equal(viewer.jumps, 0);
    const capture = handle.current.camera();
    await act(async () => { await viewer.updateComplete; });
    assert.equal(capture.phi, .5);
    assert.deepEqual(viewer.writes, [['camera-orbit', '0.2rad 0.5rad 0.12m']]);
    assert.equal(viewer.jumps, 1, 'the explicit capture API still freezes a handoff camera');
  });
});

test('viewer resize publishes both its measured box and the field of view settled by updateComplete', async () => {
  await scene(async ({ viewers, observers, views, load, dispatch }) => {
    const viewer = viewers.at(-1);
    await load(viewer);
    let settle;
    viewer.updateComplete = new Promise((resolve) => { settle = resolve; });
    viewer.rect = { left: 16, top: 70, width: 280, height: 280 };
    await act(() => observers.at(-1).callback());
    assert.equal(views.at(-1).width, 280);
    assert.equal(views.at(-1).fov, 32);
    viewer.fov = 41;
    await act(async () => { settle(); await viewer.updateComplete; });
    assert.equal(views.at(-1).fov, 41, 'read again after model-viewer adjusts its framing');
    viewer.fov = Number.NaN;
    await dispatch(viewer, 'camera-change');
    assert.equal(views.at(-1), null, 'invalid projection cannot place stars offscreen');
    viewer.fov = 41;
    await dispatch(viewer, 'camera-change');
    assert.equal(views.at(-1).width, 280);
    assert.deepEqual(viewer.writes, []);
  });
});

test('model failure, source replacement, and unmount clear stale projections and detach every observer', async () => {
  await scene(async ({ viewers, observers, views, ready, load, dispatch, change, root, unmount }) => {
    const first = viewers.at(-1);
    await load(first);
    await dispatch(first, 'error');
    assert.equal(views.at(-1), null);
    assert.equal(ready.at(-1), false);
    assert.equal(root().root.findAllByType('img').length, 1, 'a failed model returns to its poster');
    const afterFailure = views.length;
    first.orbit.theta = .7;
    await dispatch(first, 'camera-change');
    assert.equal(views.length, afterFailure, 'failed WebGL geometry cannot restore a stale view');
    await load(first);
    let settle;
    first.updateComplete = new Promise((resolve) => { settle = resolve; });
    const oldObserver = observers.at(-1);
    await act(() => oldObserver.callback());
    await change({ src: 'bracelet-b.glb' });
    assert.equal(views.at(-1), null);
    assert.equal(oldObserver.disconnected, true);
    assert.equal(first.listenerCount(), 0);
    const second = viewers.at(-1);
    assert.notEqual(first, second);
    const sourceResetCount = views.length;
    first.fov = 55;
    await act(async () => { settle(); await first.updateComplete; });
    await dispatch(first, 'load');
    assert.equal(views.length, sourceResetCount, 'late work from the old source cannot overwrite the new source');
    await load(second);
    assert.equal(views.at(-1).fov, 32);
    const beforeUnmount = views.length;
    await unmount();
    assert.equal(second.listenerCount(), 0);
    assert.equal(observers.every((observer) => observer.disconnected), true);
    await dispatch(second, 'camera-change');
    await act(() => observers.at(-1).callback());
    assert.equal(views.length, beforeUnmount);
  });
});


test('scripted camera movement temporarily disables damping and restores the actual viewer default',async()=>{
  await scene(async({root,change})=>{
    const element=()=>root().root.findByType('model-viewer');
    assert.equal(element().props['interpolation-decay'],50);
    await change({interpolationDecay:0});assert.equal(element().props['interpolation-decay'],0);
    await change({interpolationDecay:undefined,interactive:true});assert.equal(element().props['interpolation-decay'],50);
    assert.equal(element().props['camera-controls'],'');
  });
});
