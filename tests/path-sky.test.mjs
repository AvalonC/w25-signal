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
  const keys = ['document', 'window', 'ResizeObserver', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root, now = 0, frameId = 0;
  const captures = new Set(), visits = [], transfers=[], fields=[], frames = new Map(), observers=new Set();
  let bounds={left:0,top:0,width:400,height:500,...initial.bounds};
  const host = {
    getBoundingClientRect: () => bounds,
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  window.innerWidth=initial.viewport?.width??400; window.innerHeight=initial.viewport?.height??500;
  window.matchMedia = () => ({ matches: !!initial.reduced, addEventListener() {}, removeEventListener() {} });
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.ResizeObserver=class {
    constructor(callback){this.callback=callback;}
    observe(){observers.add(this);}
    disconnect(){observers.delete(this);}
  };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark() {}, measure() {}, clearMarks() {}, clearMeasures() {},
  } });
  globalThis.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const advance = async (ms) => {
    for (let i=0; i<ms; i+=40) {
      now += 40; const callbacks = [...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((callback) => callback(now)));
    }
  };
  let props = { color: false, dateFound: false, choices: [0, 3, 5], paused: false,
    onVisit: (place,handoff) => {visits.push(place);transfers.push(handoff);}, onField:field=>fields.push(field), ...initial };
  const carrier = () => root.root.findAllByType('button').find((button) => button.props.className.startsWith('path-carrier'));
  const pointer = (x, y, pointerId = 1) => ({
    clientX: x, clientY: y, pointerId, isPrimary: true, pointerType: 'touch', button: 0, currentTarget: host,
  });
  const drag = async (x, y) => {
    const style = carrier().props.style;
    await act(() => carrier().props.onPointerDown(pointer(bounds.left+parseFloat(style.left)*bounds.width/100,bounds.top+parseFloat(style.top)*bounds.height/100)));
    await act(() => carrier().props.onPointerMove(pointer(x, y)));
  };
  try {
    await act(() => { root = create(React.createElement(PathSky, props), { createNodeMock: () => host }); });
    await body({ root, carrier, captures, visits, transfers, fields, pointer, drag, advance,
      resize:async(next)=>{bounds={...bounds,...next};await act(()=>observers.forEach(observer=>observer.callback()));},
      visibility:async(hidden)=>{await act(()=>{document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));});},
      update: async (next) => { props = { ...props, ...next }; await act(() => root.update(React.createElement(PathSky, props))); },
    });
  } finally {
    if (root) await act(() => root.unmount());
    assert.equal(frames.size, 0, 'unmount clears the approach clock');
    assert.equal(observers.size,0,'unmount releases sky measurements');
    for (const key of keys) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else delete globalThis[key];
    }
  }
}

test('carried light visits a destination only after an uncancelled release', async () => {
  await scene({}, async ({ carrier, captures, visits, pointer, drag, advance }) => {
    await drag(92, 180);
    assert.deepEqual(visits, [], 'reaching the prism while holding must not enter it');
    assert.equal(captures.has(1), true);
    assert.match(carrier().props.className, /path-carrier-near/);
    await act(() => carrier().props.onPointerUp(pointer(92, 180)));
    assert.deepEqual(visits, [], 'the star first travels above the prism');
    await advance(960);
    assert.deepEqual(visits, ['prism']);
    assert.equal(carrier().props.style.top, '20%');
    assert.equal(captures.size, 0);
    await act(() => carrier().props.onPointerUp(pointer(92, 180)));
    assert.deepEqual(visits, ['prism'], 'a stale duplicate release cannot enter twice');
  });
});

test('pointer cancellation, capture loss, blur and a hidden document discard the pending visit', async () => {
  for (const interruption of ['cancel', 'capture', 'blur', 'hidden']) {
    await scene({}, async ({ carrier, captures, visits, pointer, drag, advance }) => {
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
      await advance(960);
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
  await scene({ dateFound: true }, async ({ root, carrier, visits, pointer, drag, update, advance }) => {
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
    await advance(960);
    assert.deepEqual(visits, ['sapphire']);
  });
});

test('the approach pauses for help and hidden tabs and cannot be redirected by another tap', async () => {
  await scene({}, async ({ root, advance, visits, update }) => {
    const place = (name) => root.root.findAllByType('button').find((button) => button.props.className.includes('path-place-'+name));
    await act(() => place('prism').props.onClick()); await advance(320);
    await act(() => place('date').props.onClick());
    await update({paused:true}); await advance(5000); assert.deepEqual(visits, []);
    await update({paused:false}); document.hidden=true;
    await act(() => document.dispatchEvent(new Event('visibilitychange'))); await advance(5000);
    assert.deepEqual(visits, []);
    document.hidden=false; await act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(640); assert.deepEqual(visits, ['prism']);
    await advance(2000); assert.deepEqual(visits, ['prism']);
  });
});

test('returning from the prism starts on the left and returning from the date starts on the right', async () => {
  await scene({anchor:'prism'}, async ({carrier}) => {
    assert.equal(carrier().props.style.left,'23%'); assert.equal(carrier().props.style.top,'59%');
  });
  await scene({anchor:'date'}, async ({carrier}) => {
    assert.equal(carrier().props.style.left,'76%'); assert.equal(carrier().props.style.top,'46%');
  });
});

const handoff={main:{x:.27,y:.81},companions:[{x:.29,y:.82},{x:.25,y:.8},{x:.27,y:.79}],orbit:2.4};
test('wish handoff starts at the exact viewport point and reveals the destinations before enabling them',async()=>{
  await scene({handoff,viewport:{width:390,height:844},bounds:{left:18,top:64,width:354,height:740}},async({root,carrier,fields,advance,visits})=>{
    assert.ok(Math.abs(18+parseFloat(carrier().props.style.left)*3.54-handoff.main.x*390)<1e-8);
    assert.ok(Math.abs(64+parseFloat(carrier().props.style.top)*7.4-handoff.main.y*844)<1e-8);
    const first=fields.at(-1);
    for(let i=0;i<3;i++){
      assert.ok(Math.abs(first.companions[i].x-handoff.companions[i].x*390)<1e-8);
      assert.ok(Math.abs(first.companions[i].y-handoff.companions[i].y*844)<1e-8);
    }
    const prism=()=>root.root.findAllByType('button').find(button=>button.props.className.includes('path-place-prism'));
    const drawing=()=>root.root.findAll(node=>node.type?.name==='DestinationDrawing'&&node.props.place==='prism')[0];
    assert.equal(carrier().props.disabled,true);assert.equal(drawing().props.progress,0);
    await act(()=>prism().props.onClick());assert.deepEqual(visits,[]);
    await advance(2000);assert.ok(drawing().props.progress>0&&drawing().props.progress<1);
    assert.ok(fields.at(-1).companions[0].y<first.companions[0].y-200,'a wish flies ahead to uncover the prism');
    await advance(1840);assert.equal(carrier().props.disabled,false);assert.equal(drawing().props.progress,1);
    assert.equal(carrier().props.style.left,'26%');assert.equal(carrier().props.style.top,'78%');
    assert.equal(root.root.findAll(node=>node.props.className==='path-companion-orbit').length,0,'the shared canvas keeps the same wishes after arrival');
  });
});

test('arrival waits through help and hidden tabs without restarting the wish flight',async()=>{
  await scene({handoff},async({root,fields,advance,update,visibility,carrier})=>{
    await advance(1200);const before=fields.at(-1);
    await update({paused:true});await advance(4000);assert.deepEqual(fields.at(-1),before);
    await update({paused:false});await visibility(true);await advance(4000);assert.deepEqual(fields.at(-1),before);
    await visibility(false);await advance(2640);assert.equal(carrier().props.disabled,false);
    assert.doesNotMatch(root.root.findByType('section').props.className,/path-arriving/);
  });
});

test('a returning light keeps its viewport position then settles at the discovered anchor without replaying the expedition',async()=>{
  await scene({handoff:{...handoff,kind:'return'},anchor:'prism',color:true},async({fields,carrier,advance})=>{
    assert.ok(Math.abs(fields.at(-1).carrier.x-handoff.main.x*400)<1e-8);
    assert.ok(Math.abs(fields.at(-1).carrier.y-handoff.main.y*500)<1e-8);
    await advance(960);assert.equal(carrier().props.disabled,false);
    assert.equal(carrier().props.style.left,'23%');assert.equal(carrier().props.style.top,'59%');
  });
});

test('reduced motion preserves the handoff and enables choices after a short restrained reveal',async()=>{
  await scene({handoff,reduced:true},async({fields,carrier,advance})=>{
    assert.equal(fields.at(-1).orbit,handoff.orbit);
    assert.equal(carrier().props.disabled,true);
    await advance(520);assert.equal(carrier().props.disabled,false);
    assert.equal(fields.at(-1).orbit,handoff.orbit);
  });
});

test('a presented map stays inert and leaves particles alone until it becomes the active sky',async()=>{
  await scene({anchor:'prism',color:true,presentation:{progress:0,labels:0,carrierHidden:true}},async({root,carrier,fields,visits,advance,update,pointer,captures})=>{
    const section=root.root.findByType('section'),mask=root.root.findByType('mask').props.id;
    const date=()=>root.root.findAllByType('button').find(node=>node.props.className.includes('path-place-date'));
    const drawing=()=>root.root.findAll(node=>node.type?.name==='DestinationDrawing'&&node.props.place==='date')[0];
    assert.deepEqual(fields,[]);assert.equal(carrier().props.disabled,true);assert.equal(carrier().props.style.visibility,'hidden');
    assert.equal(drawing().props.progress,0);
    await act(()=>date().props.onClick());await act(()=>carrier().props.onPointerDown(pointer(92,295)));
    await act(()=>carrier().props.onKeyDown({key:'ArrowUp',preventDefault(){}}));
    assert.equal(captures.size,0);assert.deepEqual(visits,[]);assert.equal(carrier().props.style.top,'59%');
    await update({presentation:{progress:.7,labels:.2,carrierHidden:true}});await advance(2400);
    assert.equal(drawing().props.progress,.7);assert.deepEqual(fields,[]);assert.equal(carrier().props.disabled,true);
    await update({presentation:undefined});
    assert.equal(root.root.findByType('section'),section);assert.equal(root.root.findByType('mask').props.id,mask);
    assert.equal(drawing().props.progress,1);assert.equal(carrier().props.disabled,false);assert.equal(carrier().props.style.visibility,undefined);
    assert.deepEqual(fields.at(-1).carrier,{x:92,y:295});
    await act(()=>date().props.onClick());await advance(960);assert.deepEqual(visits,['date']);
  });
});
