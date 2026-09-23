import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

registerHooks({
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return next(url, context);
  },
});
const { Starfield } = await import('../components/game/particles.tsx');

test('bracelet particles stay in their final sky, fade on visible time and survive resizing without forming text', async () => {
  const keys = ['document','window','innerWidth','innerHeight','devicePixelRatio','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
  const original = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map(), letters = [];
  let now = 0, next = 0, resized, draws = [], clearCount = 0, root;
  let pending;
  const g = {
    globalAlpha: 1, fillStyle: '',
    setTransform() {}, beginPath() {}, fillRect() {},
    clearRect() { draws = []; clearCount++; },
    arc(x,y,r) { pending = {x,y,r}; },
    fill() { draws.push({...pending, alpha:this.globalAlpha, color:this.fillStyle}); },
  };
  const canvas = { clientWidth:390, clientHeight:844, width:0, height:0, getContext:() => g };
  const offscreen = () => {
    const c = {width:0,height:0};
    c.getContext = () => ({ fillText(text) {letters.push(text);}, getImageData() {
      const data = new Uint8ClampedArray(c.width*c.height*4);
      for (let i=3; i<data.length; i+=4) data[i] = 255;
      return {data};
    }});
    return c;
  };
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT:true,
    window:{matchMedia:() => ({matches:false})},
    document:{hidden:false,createElement:offscreen},
    innerWidth:390,innerHeight:844,devicePixelRatio:2,
    ResizeObserver:class {constructor(fn) {resized=fn;} observe() {} disconnect() {}},
    requestAnimationFrame(fn) {frames.set(++next,fn);return next;},
    cancelAnimationFrame(id) {frames.delete(id);},
  });
  const advance = async (ms) => {
    for (let i=0;i<ms;i+=40) {
      now+=40; const callbacks=[...frames.values()]; frames.clear();
      await act(() => callbacks.forEach((fn) => fn(now)));
    }
  };
  const points = Array.from({length:1050},(_,i) => ({x:20+i%350,y:30+i%700}));
  const arrival = {id:0,points,viewport:{width:390,height:844}};
  const render = (props={}) => React.createElement(Starfield,{arrival,...props});
  try {
    await act(() => {root=create(render(),{createNodeMock:() => canvas});});
    await advance(40);
    assert.equal(draws.length,1050,'the handoff retains every bracelet particle, not only the ambient 231');
    for (let i=0;i<points.length;i++) {
      assert.equal(draws[i].x,points[i].x); assert.equal(draws[i].y,points[i].y);
      assert.equal(draws[i].color,i%11===0?'#ffb3de':'#fff0fa');
      assert.equal(draws[i].r,i%29===0?1.45:.68+(i%5)*.12);
      assert.ok(draws[i].alpha>=.56&&draws[i].alpha<=.78);
    }
    assert.deepEqual(letters,[],'no hidden Project/W25/HBD glyph is formed');
    await advance(400);
    const beforePause=draws[0].alpha, beforeClears=clearCount;
    await act(() => root.update(render({paused:true})));
    await advance(4000);
    assert.equal(clearCount,beforeClears);
    await act(() => root.update(render()));
    await advance(40);
    assert.ok(Math.abs(draws[0].alpha-beforePause)<.03,'pause time cannot consume the fade');
    await advance(2000);
    assert.equal(draws.length,1050);
    assert.ok(draws.every((point) => point.alpha>=.2&&point.alpha<=.32),'all particles remain softly visible after settling');
    assert.deepEqual(draws.map(({x,y}) => ({x,y})),points,'particles do not travel to unrelated ambient positions');
    canvas.clientWidth=780; canvas.clientHeight=422;
    resized(); await advance(40);
    assert.equal(draws.length,1050);
    assert.deepEqual(draws.map(({x,y}) => ({x,y})),points.map(({x,y}) => ({x:x*2,y:y/2})));
    assert.deepEqual(letters,[]);

    await act(() => root.update(render({arrival:{id:2,points}})));
    await advance(40);
    assert.deepEqual(draws.map(({x,y}) => ({x,y})),points,'older pixel-only arrivals use the current viewport');
    canvas.clientWidth=390; canvas.clientHeight=844;
    resized(); await advance(40);
    assert.deepEqual(draws.map(({x,y}) => ({x,y})),points.map(({x,y}) => ({x:x/2,y:y*2})));

    await act(() => root.update(render({arrival:null,burst:true})));
    await advance(40);
    assert.equal(draws.length,2300,'the return burst resumes the existing full starfield');
    await act(() => root.update(render({arrival:null,text:'Project\nN7A-3914'})));
    await advance(40);
    assert.deepEqual(letters,['Project','N7A-3914'],'the opening keeps its original text constellation');
    assert.equal(draws.length,2080);

    const companions=[{x:100,y:160},{x:180,y:170},{x:260,y:160}];
    const wishes={nodes:Array.from({length:8},(_,i) => ({word:String(i),x:40+i*40,y:250,selected:i<3,order:i})),
      carrier:{x:180,y:170},departing:false,companions};
    await act(() => root.update(render({arrival:null,wishes})));
    await advance(40);
    assert.equal(draws.length,780,'three selected wish companions retain their existing particle groups');
    for (let i=0;i<draws.length;i++) {
      const center=companions[Math.floor(i/260)];
      assert.ok(Math.hypot(draws[i].x-center.x,draws[i].y-center.y)<=4.71,'each wish stays attached to its returning companion');
    }
  } finally {
    if(root)await act(() => root.unmount());
    for(const key of keys) {
      const descriptor=original.get(key);
      if(descriptor)Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
    }
  }
});
