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

async function scene(reduced, body, fromRelay = false, dimensions = {width:300,height:300}) {
  const keys = ['document', 'window', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, completions = 0;
  const frames = new Map(), captured = new Set();
  const side=Math.min(dimensions.width,dimensions.height);
  const host = (element) => ({
    getBoundingClientRect: () => ({ left: 0, top: 0, ...(element?.props?.className==='closure-world'?dimensions:{width:side,height:side}) }),
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
  const render = (paused = false) => React.createElement(PathClosure, { choices: [0, 3, 5], paused, fromRelay, onComplete: () => { completions++; } });
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
      pointer: (point, pointerId = 1) => ({ clientX: point.x * side/100, clientY: point.y * side/100, pointerId,
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


test('the onward star arrives at the ring before the last gap becomes playable', async () => {
  for (const reduced of [false,true]) await scene(reduced, async ({root,advance,pause,visibility,completions}) => {
    const carried=()=>root.root.findByProps({className:'closure-carried'});
    const target=()=>root.root.findByProps({'aria-label':'接通最后一段星路'});
    const first=carried().props.style;
    assert.equal(target().props.disabled,true);
    await act(()=>target().props.onClick());
    assert.equal(root.root.findAllByProps({className:'closure-continue'}).length,0);
    await advance(reduced?120:600);
    if(!reduced) {
      assert.ok(parseFloat(carried().props.style.left)>parseFloat(first.left));
      assert.ok(parseFloat(carried().props.style.top)<parseFloat(first.top));
    }
    await pause(true);
    const frozen=carried().props.style;
    await advance(4000);
    assert.deepEqual(carried().props.style,frozen);
    assert.equal(target().props.disabled,true);
    await pause(false);await visibility(true);await advance(4000);
    assert.deepEqual(carried().props.style,frozen);
    await visibility(false);await advance(2400);
    assert.equal(carried().props.style.left, `${CLOSURE_START.x}%`);
    assert.equal(carried().props.style.top, `${CLOSURE_START.y}%`);
    assert.equal(target().props.disabled,false);
    assert.equal(completions(),0,'the flight only opens the next chapter; the player still closes the gap');
    await act(()=>target().props.onClick());
    assert.equal(root.root.findByProps({className:'closure-continue'}).props.disabled,true);
  },true);
});


test('a non-square viewport uses one square stage and the closing star follows the drawn arc', async () => {
  await scene(false,async({root,advance})=>{
    const stage=()=>root.root.findByProps({className:'closure-stage'});
    const carried=()=>root.root.findByProps({className:'closure-carried'});
    const target=()=>root.root.findByProps({'aria-label':'接通最后一段星路'});
    assert.equal(stage().props.style.width,320);
    assert.equal(stage().props.style.height,320);
    await advance(1840);
    assert.equal(target().props.disabled,true,'the common zoom must finish before input unlocks');
    await advance(400);
    await act(()=>target().props.onClick());
    await advance(520);
    const drawn=root.root.findByProps({className:'closure-join'}).props.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(Math.abs(parseFloat(carried().props.style.left)-drawn.at(-2))<1e-9);
    assert.ok(Math.abs(parseFloat(carried().props.style.top)-drawn.at(-1))<1e-9);
    assert.ok(parseFloat(carried().props.style.top)>Math.max(CLOSURE_START.y,CLOSURE_TARGET.y),'the star follows the bottom arc instead of its chord');
  },false,{width:320,height:520});
});

test('the travelling star, reflected route and real diamond hotspots share one mapped signal and pause together', async () => {
  await scene(false,async({root,advance,pause,visibility})=>{
    await advance(2400);
    await act(()=>root.root.findByProps({'aria-label':'接通最后一段星路'}).props.onClick());
    await advance(1560);
    const star=()=>root.root.findByProps({className:'closure-sweep-star'});
    const tail=()=>root.root.findByProps({className:'closure-sweep-thread'});
    const lights=()=>root.root.findAll(n=>typeof n.props.slot==='string'&&n.props.slot.startsWith('hotspot-morse')).map(n=>n.props.style['--mapped-light']);
    const endpoint=()=>tail().props.d.match(/-?\d+(?:\.\d+)?/g).map(Number).slice(-2);
    assert.ok(Math.abs(parseFloat(star().props.style.left)-endpoint()[0])<1e-9);
    assert.ok(Math.abs(parseFloat(star().props.style.top)-endpoint()[1])<1e-9);
    const initial=lights();
    assert.ok(initial[0]>.99,'the first real diamond reflects the star at its own position');
    assert.ok(initial.slice(1).every(n=>n<.2),'unvisited diamonds must not glow together');
    const reflections=root.root.findAllByProps({className:'closure-reflection'});
    reflections.forEach((node,i)=>assert.equal(node.props.style['--mapped-light'],initial[i]));
    await pause(true);const frozenStar=star().props.style,frozenTail=tail().props.d;
    await advance(3000);assert.deepEqual(star().props.style,frozenStar);assert.equal(tail().props.d,frozenTail);assert.deepEqual(lights(),initial);
    await pause(false);await visibility(true);await advance(3000);
    assert.deepEqual(star().props.style,frozenStar);assert.deepEqual(lights(),initial);
    await visibility(false);await advance(1080);
    assert.notDeepEqual(lights(),initial,'the reflection moves to the next real diamond');
    assert.ok(Math.abs(parseFloat(star().props.style.left)-endpoint()[0])<1e-9);
    await advance(closureTimeline().duration);
    assert.equal(star().props.style.opacity,0);
    assert.equal(root.root.findAll(n=>n.props.slot==='hotspot-closure-gem')[0].props.style.opacity,1,'the travelling light settles on the right-hand star setting');
  });
});
