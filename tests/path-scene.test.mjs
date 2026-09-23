import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React, { useLayoutEffect, useState } from 'react';
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
const { stoneEntry } = await import('../lib/stone-entry.ts');

async function scene(initial, body) {
  const keys = ['document', 'window', 'ResizeObserver', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let now = 0, frameId = 0, root, current;
  const frames = new Map(), discoveries = [], fields=[],captures=new Set();
  const host = (element) => ({
    getContext: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 500 }),
    querySelectorAll: element?.props?.className === 'path-date-stage' && initial.dialRects
      ? () => initial.dialRects.map((rect) => ({ getBoundingClientRect: () => rect })) : undefined,
    closest: () => ({ querySelectorAll: () => [] }),
    style: { setProperty() {} },
    setPointerCapture(id){captures.add(id);}, hasPointerCapture:id=>captures.has(id), releasePointerCapture(id){captures.delete(id);},
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
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
    useLayoutEffect(()=>{current={path,...date};},[path,date]);
    return React.createElement(StarPathJourney, {
      path, ...date, paused, choices: [0, 3, 5], rotation: 0,
      onPath: (next) => { discoveries.push(next); setPath(next); },
      onDate: (month, day) => setDate({ month, day }),
      onField:field=>fields.push(field),
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
      root, advance, discoveries, fields, captures, current: () => current,
      pause: async (paused) => act(() => root.update(React.createElement(Harness, { paused }))),
      visibility:async(hidden)=>act(()=>{document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));}),
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
    assert.equal(prism().props['aria-disabled'], true, 'the main light must enter before the prism responds');
    await advance(800); await pause(true); await advance(5000);
    assert.equal(prism().props['aria-disabled'], true, 'help pauses the incoming light');
    await pause(false); await advance(2200);
    assert.equal(prism().props['aria-disabled'],true,'camera reveal and input beam still precede player control');
    await key('ArrowRight'); assert.equal(prism().props['aria-valuenow'],16,'input cannot skip the reveal');
    await advance(1600);
    assert.equal(prism().props['aria-disabled'],false,'control returns only after the spectrum opens');
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
    await pause(false); await advance(3400);
    assert.equal(current().path.color, false, 'the pink main star must first fly out of the spectrum');
    assert.equal(root.root.findAllByProps({className:'prism-return-light'}).length, 1);
    await advance(1600);
    assert.equal(current().path.color, true);
    assert.equal(current().path.place, 'prism', 'the player decides when to bring the light home');
    await advance(5000);
    assert.equal(discoveries.length, 1);
    await act(() => root.root.findByProps({'aria-label':'带着粉光回到星路'}).props.onClick());
    assert.equal(current().path.place,'prism','click begins a return flight, not an immediate cut');
    await advance(500);await pause(true);await advance(5000);
    assert.equal(current().path.place,'prism','help pauses the return camera');
    await pause(false);await advance(1840);
    assert.equal(current().path.anchor,'prism');
    const carrier = root.root.findAllByType('button').find((button) => button.props.className.startsWith('path-carrier'));
    assert.equal(carrier.props.style.left,'23%');
    assert.equal(carrier.props.disabled,false,'the revealed map is immediately usable, without a second arrival');
  });
});

test('October eighth gathers the dials once, retains its place, and pauses when the player leaves the tab', async () => {
  await scene({ path: { ...freshPath(), place: 'date' }, month: 10, day: 7 }, async ({ root, advance, current, discoveries }) => {
    assert.equal(root.root.findAllByProps({className:'path-date-memory'}).length,0,'no birthday answer is printed below the dials');
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
    const stone = root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
    assert.equal(stone.props.tint,0,'date-first gathering remains white');
    await act(() => root.root.findByProps({'aria-label':'带着这一天的星光回到星路'}).props.onClick());
    assert.equal(current().path.place,'date');
    await advance(2320);
    assert.equal(current().path.anchor,'date');
  });
});

test('a birthday found after the colour gathers pink and reduced motion still preserves the discovery', async () => {
  await scene({reduced:true,path:{...freshPath(),place:'date',color:true},month:10,day:8},async({root,advance,current,discoveries})=>{
    await advance(800);
    const stone = () => root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
    assert.equal(stone().props.tint,1);
    assert.equal(current().path.dateFound,false);
    await advance(2000);
    assert.equal(current().path.dateFound,true); assert.equal(stone().props.tint,1);
    assert.equal(discoveries.length,1);
  });
});

test('the date place uses the live nebula clock, preserves the selected light, and returns the born star once', async () => {
  for (const pink of [false]) await scene({ path: { ...freshPath(), place: 'date', color: pink }, month: 10, day: 8 }, async ({ root, advance, current, pause, visibility, discoveries }) => {
    const nebulaNodes = () => root.root.findAll((node) => typeof node.type === 'function' && node.type.name === 'DateNebula');
    const nebula = () => root.root.find((node) => typeof node.type === 'function' && node.type.name === 'DateNebula');
    const stone = () => root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
    const stage = () => root.root.findByProps({ className: 'path-date-stage' });
    await advance(1080);
    assert.equal(nebulaNodes().length, 0, 'the matching date cannot bypass the 1100ms entry');
    assert.equal(root.root.findByProps({ className: 'date-wheels' }).props.inert, true);
    await advance(40);
    assert.equal(root.root.findByProps({ className: 'date-wheels' }).props.inert, false);
    await advance(640);
    assert.equal(nebulaNodes().length, 0, 'alignment still needs the full 650ms dwell after entry');
    await advance(40);
    assert.equal(root.root.findByProps({ className: 'date-wheels' }).props.inert, true);
    assert.equal(root.root.findAllByProps({ className: 'date-confluence' }).length, 0, 'the old straight-line SVG is gone');
    assert.equal(nebula().props.pink, pink, 'the nebula inherits the previously selected light');
    assert.deepEqual(nebula().props.sources, [{ x: .28, y: .29 }, { x: .72, y: .74 }], 'the measured dial fallback stays normalized');
    assert.equal(nebula().props.settled, false);
    assert.equal(stage().props['data-nebula-phase'], 'gathering');
    assert.equal(stone().props.formation, 0);
    await advance(2000);

    const held = nebula().props.elapsed;
    await pause(true); await advance(2600);
    assert.equal(nebula().props.elapsed, held, 'help freezes the gathering clock');
    await pause(false);
    await visibility(true); await advance(2600);
    assert.equal(nebula().props.elapsed, held, 'a hidden tab cannot advance the gathering');
    await visibility(false); await advance(2000);
    assert.equal(current().path.dateFound, false, 'the star is not born during the gathering');
    assert.ok(nebula().props.elapsed > held);
    assert.equal(nebula().props.settled, false);
    assert.equal(stage().props['data-nebula-phase'], 'nebula');
    assert.equal(stone().props.formation, 0, 'a visible cloud precedes the sapphire outline');
    assert.equal(root.root.findAllByProps({ className: 'date-confluence' }).length, 0);

    await advance(1600);
    assert.equal(current().path.dateFound, false, 'the formation phase still waits for the full nebula clock');
    assert.ok(stone().props.formation > 0 && stone().props.formation < 1, 'the nebula has begun to form the sapphire');
    assert.equal(stage().props['data-nebula-phase'], 'forming');
    await advance(2200);
    assert.equal(current().path.dateFound, true);
    const born = root.root.find((node) => typeof node.type === 'function' && node.type.name === 'StarSapphire');
    assert.equal(born.props.origin, 'nebula');
    assert.equal(born.props.libra, true);
    assert.equal(nebula().props.settled, true, 'the finished star keeps a quiet nebula around it');

    const returnStar = () => root.root.findByProps({ className: 'date-return-star' });
    assert.equal(returnStar().props.disabled, true, 'the return star waits for its flight');
    assert.equal(returnStar().props.style.top, '47%', 'the return light is born inside the sapphire');
    await act(() => returnStar().props.onClick());
    assert.equal(root.root.findAllByProps({ className: 'path-returning-carrier' }).length, 0, 'an early tap cannot skip the birth flight');
    await advance(640);
    const frozenBirth = { ...returnStar().props.style };
    await pause(true); await advance(5000);
    assert.deepEqual(returnStar().props.style, frozenBirth);
    await pause(false); await visibility(true); await advance(5000);
    assert.deepEqual(returnStar().props.style, frozenBirth, 'the star birth also freezes while the tab is hidden');
    await act(() => returnStar().props.onClick());
    assert.equal(root.root.findAllByProps({ className: 'path-returning-carrier' }).length, 0);
    await visibility(false); await advance(720);
    assert.equal(returnStar().props.disabled, true, '1360ms of visible birth time is still too early');
    await advance(40);
    assert.equal(returnStar().props.disabled, false, 'the star becomes clickable only after reaching the return point');
    assert.equal(returnStar().props.style.top, '86%');
    const clickReturn = returnStar().props.onClick;
    await act(() => { clickReturn(); clickReturn(); });
    const sky = () => root.root.find((node) => node.type === 'section' && node.props.className.startsWith('path-exploration'));
    const returningSky = sky();
    await advance(1200);
    assert.equal(current().path.place, 'date', 'return starts a flight instead of cutting to the map');
    await pause(true); await advance(3000); assert.equal(current().path.place, 'date', 'help freezes the return flight');
    await pause(false); await advance(1300);
    assert.equal(current().path.place, 'sky');
    assert.equal(current().path.anchor, 'date');
    assert.equal(sky(), returningSky, 'the return hands off to the already visible map');
    assert.equal(root.root.findAllByProps({ className: 'date-return-star' }).length, 0);
    assert.equal(discoveries.filter((path) => path.place === 'date' && path.dateFound).length, 1);
    assert.equal(discoveries.filter((path) => path.place === 'sky').length, 1, 'double tapping only returns once');
    await advance(5000);
    assert.equal(discoveries.filter((path) => path.place === 'sky').length, 1);
  });
});

test('the nebula sources use the rendered dial centers and reduced motion keeps the short return birth', async () => {
  await scene({ reduced: true, path: { ...freshPath(), place: 'date', color: false }, month: 10, day: 8,
    dialRects: [{ left: 40, top: 50, width: 120, height: 120 }, { left: 230, top: 280, width: 120, height: 120 }] },
  async ({ root, advance, current }) => {
    await advance(960);
    const nebula = root.root.find((node) => typeof node.type === 'function' && node.type.name === 'DateNebula');
    assert.deepEqual(nebula.props.sources, [{ x: .25, y: .22 }, { x: .725, y: .68 }]);
    assert.equal(nebula.props.reduced, true);
    assert.equal(nebula.props.pink, false);
    await advance(1800);
    assert.equal(current().path.dateFound, true);
    const returnStar = () => root.root.findByProps({ className: 'date-return-star' });
    assert.equal(returnStar().props.disabled, true);
    await advance(280);
    assert.equal(returnStar().props.disabled, true, 'the quiet birth still has a visible short interval');
    await advance(40);
    assert.equal(returnStar().props.disabled, false);
    await act(() => returnStar().props.onClick());
    await advance(400); assert.equal(current().path.place, 'date');
    await advance(40); assert.equal(current().path.place, 'sky');
    assert.equal(current().path.anchor, 'date');
  });
});

test('pink light only enters the stone on a completed delivery; cancellation, a missed drop and help remain safe', async () => {
  await scene({ path: { place: 'sapphire', color: true, dateFound: true, infused: false } }, async ({ root, advance, current, discoveries, pause, pointer,captures }) => {
    const carried = () => root.root.findByProps({ className: 'path-carried-light' });
    const entry=stoneEntry(400,500),entryY=entry.y*5;
    assert.equal(carried().props.style['--light-x'],'50%');assert.equal(carried().props.style['--light-y'],'10%');
    await act(() => carried().props.onPointerDown(pointer(200,50)));
    await act(() => carried().props.onPointerMove(pointer(200,entryY)));
    assert.equal(captures.has(1),true);
    await act(() => carried().props.onPointerCancel(pointer(200,entryY)));
    assert.equal(captures.size,0);assert.equal(carried().props.style['--light-x'],'50%');assert.equal(carried().props.style['--light-y'],'10%');
    await act(() => carried().props.onPointerUp(pointer(200,entryY)));
    assert.equal(current().path.infused, false);
    await act(() => carried().props.onPointerDown(pointer(200,50)));
    await act(() => carried().props.onPointerUp(pointer(25, 460)));
    assert.equal(current().path.infused, false, 'dropping far away keeps the carried light');
    assert.equal(carried().props.style['--light-y'],'10%');assert.equal(captures.size,0);
    await act(() => carried().props.onPointerDown(pointer(200,50)));
    await pause(true);
    await act(() => carried().props.onPointerUp(pointer(200,entryY)));
    assert.equal(captures.size,0);
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

test('the return reveals one persistent map, blocks background visits, and freezes all motion for help and hidden tabs',async()=>{
  await scene({path:{...freshPath(),place:'prism',color:true,dateFound:true,infused:true}},async({root,advance,current,pause,visibility,fields})=>{
    const sky=()=>root.root.find(node=>node.type==='section'&&node.props.className.startsWith('path-exploration'));
    const carrier=()=>root.root.findAllByType('button').find(node=>node.props.className.startsWith('path-carrier'));
    const place=name=>root.root.findAllByType('button').find(node=>node.props.className.includes('path-place-'+name));
    const returning=()=>root.root.findByProps({className:'path-returning-carrier'});
    const journey=()=>root.root.find(node=>node.type==='section'&&node.props.className.startsWith('star-path-journey'));
    await act(()=>root.root.findByProps({'aria-label':'带着粉光回到星路'}).props.onClick());
    const originalSky=sky(),mask=root.root.findByType('mask').props.id;
    assert.equal(carrier().props.style.left,'23%');assert.equal(carrier().props.style.top,'59%');
    assert.equal(carrier().props.style.visibility,'hidden');assert.equal(carrier().props.disabled,true);
    assert.equal(root.root.findByProps({className:'path-map-layer'}).props.inert,true);
    await act(()=>place('date').props.onClick());assert.equal(current().path.place,'prism');
    await advance(640);
    const before={star:{...returning().props.style},camera:{...journey().props.style},map:root.root.findAll(node=>node.type?.name==='PathSky')[0].props.presentation};
    await pause(true);await advance(5000);
    assert.deepEqual(returning().props.style,before.star);assert.deepEqual(journey().props.style,before.camera);
    await pause(false);await visibility(true);await advance(5000);
    assert.deepEqual(returning().props.style,before.star);assert.deepEqual(journey().props.style,before.camera);
    assert.deepEqual(root.root.findAll(node=>node.type?.name==='PathSky')[0].props.presentation,before.map);
    assert.equal(fields.filter(Boolean).length,0,'the background must not claim the active particle field');
    await visibility(false);await advance(1700);
    assert.equal(current().path.place,'sky');assert.equal(current().path.anchor,'prism');
    assert.equal(sky(),originalSky,'finishing the retreat keeps the same mounted map');
    assert.equal(root.root.findByType('mask').props.id,mask,'route masks also keep their identity');
    assert.equal(carrier().props.disabled,false);assert.equal(carrier().props.style.visibility,undefined);
    assert.ok(fields.filter(Boolean).length>0,'the existing map takes over particle output immediately');
    assert.equal(root.root.findAllByProps({className:'path-returning-carrier'}).length,0);
    await act(()=>place('date').props.onClick());await advance(960);
    assert.equal(current().path.place,'date','the first available click starts the next visit');
  });
});

test('a second discovery return gets a fresh clock instead of completing immediately',async()=>{
  await scene({path:{...freshPath(),place:'prism',color:true,dateFound:true,infused:true}},async({root,advance,current,discoveries})=>{
    const returnLight=name=>root.root.findByProps({'aria-label':name});
    const date=()=>root.root.findAllByType('button').find(node=>node.props.className.includes('path-place-date'));
    await act(()=>returnLight('带着粉光回到星路').props.onClick());await advance(2360);
    assert.equal(current().path.place,'sky');
    await act(()=>date().props.onClick());await advance(960);assert.equal(current().path.place,'date');
    await advance(3000);
    await act(()=>returnLight('带着这一天的星光回到星路').props.onClick());
    assert.equal(current().path.place,'date');
    await advance(1200);assert.equal(current().path.place,'date','the second flight still needs its own full duration');
    const carrier=root.root.findAllByType('button').find(node=>node.props.className.startsWith('path-carrier'));
    assert.equal(carrier.props.disabled,true);assert.equal(carrier.props.style.left,'76%');
    await advance(1160);assert.equal(current().path.place,'sky');assert.equal(current().path.anchor,'date');
    assert.equal(discoveries.filter(path=>path.place==='sky').length,2,'each return commits exactly once');
    await advance(3000);assert.equal(discoveries.filter(path=>path.place==='sky').length,2);
  });
});

test('the pink road draws first, then reveals the next destination and its nearby verse',async()=>{
  for(const dateFound of [false,true])await scene({path:{...freshPath(),place:'prism',color:true,dateFound,infused:dateFound}},async({root,advance,pause,visibility})=>{
    const road=()=>root.root.findByProps({className:'prism-road-core'});
    const copy=()=>root.root.findByProps({className:'prism-road-copy'});
    const icon=()=>root.root.find(node=>node.type?.name==='DestinationDrawing');
    assert.equal(road().props['data-progress'],0);assert.equal(copy().props.style.opacity,0);assert.equal(icon().props.progress,0);
    assert.equal(icon().props.place,dateFound?'sapphire':'date');
    assert.equal(root.root.findAllByProps({className:'path-prism-message'}).length,0,'the verse belongs to the emerging road');
    await advance(1000);
    assert.ok(road().props['data-progress']>0&&road().props['data-progress']<1);
    assert.equal(copy().props.style.opacity,0);assert.equal(icon().props.progress,0);
    const before=road().props['data-progress'];
    await pause(true);await advance(3000);assert.equal(road().props['data-progress'],before);
    await pause(false);await visibility(true);await advance(3000);assert.equal(road().props['data-progress'],before);
    await visibility(false);await advance(800);
    assert.ok(copy().props.style.opacity>0&&copy().props.style.opacity<1);
    assert.ok(icon().props.progress>0&&icon().props.progress<1);
    await advance(700);assert.equal(road().props['data-progress'],1);assert.equal(copy().props.style.opacity,1);assert.equal(icon().props.progress,1);
  });
});

test('both exploration orders automatically meet at the sapphire while leaving infusion to the player',async()=>{
  for(const last of ['date','prism'])await scene({path:{...freshPath(),place:last,color:last==='date',dateFound:last==='prism'},month:10,day:7},async({root,advance,current,discoveries,pause,visibility,pointer})=>{
    const meeting=()=>root.root.findAllByProps({className:'path-meeting-carrier'});
    const waitUntil=async(predicate)=>{for(let i=0;i<350&&!predicate();i++)await advance(40);assert.ok(predicate(),'the expected visible scene phase arrives');};
    if(last==='date'){
      await advance(1200);await act(()=>root.root.findByProps({'aria-label':'日加一'}).props.onClick());
    }else{
      await advance(4480);const prism=root.root.findByProps({className:'prism-light'});
      await act(()=>prism.props.onPointerDown(pointer(0,0)));await act(()=>prism.props.onPointerMove(pointer(162.5,0)));await act(()=>prism.props.onPointerUp());
    }
    await waitUntil(()=>current().path.color&&current().path.dateFound);
    assert.equal(current().path.place,last);assert.equal(current().path.infused,false);assert.equal(meeting().length,0);
    assert.equal(root.root.findByProps({className:'path-home'}).props.inert,true,'manual return cannot race the automatic meeting');
    await act(()=>root.root.findByProps({'aria-label':'带着光回到星路'}).props.onClick());
    assert.equal(root.root.findAllByProps({className:'path-returning-carrier'}).length,0);
    await advance(320);await pause(true);await advance(6000);assert.equal(meeting().length,0);
    await pause(false);await visibility(true);await advance(6000);assert.equal(meeting().length,0);
    await visibility(false);await waitUntil(()=>meeting().length===1);
    const light=()=>root.root.find(node=>node.type?.name==='LightIntoStone');
    const active=light(),container=root.root.findByProps({className:'path-meeting-layer'});
    const carried=()=>root.root.findByProps({className:'path-carried-light'}),target=()=>root.root.findByProps({className:'path-stone-target'});
    assert.equal(carried().props.disabled,true);assert.equal(carried().props.style.visibility,'hidden');assert.equal(target().props.disabled,true);
    await act(()=>target().props.onClick());await act(()=>carried().props.onClick({detail:0}));
    await act(()=>carried().props.onPointerDown(pointer(200,50)));await act(()=>carried().props.onPointerUp(pointer(200,200)));
    assert.equal(current().path.infused,false);
    await advance(480);const frozen={...meeting()[0].props.style};
    await pause(true);await advance(4000);assert.deepEqual(meeting()[0].props.style,frozen);
    await pause(false);await visibility(true);await advance(4000);assert.deepEqual(meeting()[0].props.style,frozen);
    await visibility(false);await waitUntil(()=>current().path.place==='sapphire');
    assert.equal(light(),active,'the background sapphire is handed over without remounting');
    assert.equal(root.root.findByProps({className:'path-meeting-layer'}),container);
    assert.equal(carried().props.disabled,false);assert.equal(carried().props.style.visibility,undefined);
    assert.equal(carried().props.style['--light-x'],'50%');assert.equal(carried().props.style['--light-y'],'10%');
    await advance(5000);assert.equal(current().path.infused,false,'arrival and idle guidance never deliver the light automatically');
    assert.equal(discoveries.filter(path=>path.place==='sapphire').length,1);
    assert.equal(discoveries.filter(path=>path.infused).length,0);
  });
});

test('a resumed sky with both discoveries meets once and respects a later voluntary return',async()=>{
  for(const reduced of [false,true])await scene({reduced,path:{...freshPath(),color:true,dateFound:true}},async({root,advance,current,discoveries})=>{
    const meeting=()=>root.root.findAllByProps({className:'path-meeting-carrier'});
    await advance(reduced?320:440);assert.equal(meeting().length,0);assert.equal(current().path.place,'sky');
    await advance(40);assert.equal(meeting().length,1);
    await advance(reduced?320:1440);assert.equal(current().path.place,'sky','the flight remains separate from its initial delay');
    await advance(reduced?40:80);assert.equal(current().path.place,'sapphire');assert.equal(current().path.infused,false);
    assert.equal(discoveries.length,1);
    await act(()=>root.root.findByProps({'aria-label':'带着光回到星路'}).props.onClick());
    await advance(reduced?480:2360);assert.equal(current().path.place,'sky');
    await advance(6000);assert.equal(current().path.place,'sky','returning after meeting never starts another automatic meeting');
    assert.equal(meeting().length,0);assert.equal(discoveries.filter(path=>path.place==='sapphire').length,1);
  });
});

test('downward guidance stops for help and backgrounding and only the primary uncancelled top-facet drop infuses',async()=>{
 await scene({path:{place:'sapphire',color:true,dateFound:true,infused:false}},async({root,advance,current,discoveries,pause,visibility,pointer,captures})=>{
   const carried=()=>root.root.findByProps({className:'path-carried-light'}),guide=()=>root.root.findByProps({className:'stone-entry-guide'});
   const entry=stoneEntry(400,500),targetY=entry.y*5;
   const dots=()=>guide().findAllByType('circle').map(node=>node.props.cy);
   const initial=dots();await advance(240);assert.ok(dots()[0]>initial[0],'the guide particles travel down toward the upper facet');
   const held=dots();await pause(true);await advance(3000);assert.deepEqual(dots(),held);
   await pause(false);await visibility(true);await advance(3000);assert.deepEqual(dots(),held);await visibility(false);
   await act(()=>carried().props.onPointerDown({...pointer(200,50),isPrimary:false}));assert.equal(captures.size,0);
   await act(()=>carried().props.onPointerUp(pointer(200,targetY)));assert.equal(current().path.infused,false);
   for(const reason of ['cancel','capture','blur','hidden']){
     await act(()=>carried().props.onPointerDown(pointer(200,50)));await act(()=>carried().props.onPointerMove(pointer(200,targetY)));
     if(reason==='cancel')await act(()=>carried().props.onPointerCancel(pointer(200,targetY)));
     else if(reason==='capture')await act(()=>carried().props.onLostPointerCapture(pointer(200,targetY)));
     else if(reason==='blur')await act(()=>window.dispatchEvent(new Event('blur')));
     else{await visibility(true);await visibility(false);}
     assert.equal(captures.size,0);assert.equal(carried().props.style['--light-y'],'10%');
     await act(()=>carried().props.onPointerUp(pointer(200,targetY)));assert.equal(current().path.infused,false);
   }
   await act(()=>carried().props.onPointerDown(pointer(200,50)));await act(()=>carried().props.onPointerMove(pointer(200,targetY)));
   await act(()=>carried().props.onPointerUp(pointer(200,targetY)));
   assert.equal(captures.size,0);assert.equal(carried().props.disabled,true);assert.equal(current().path.infused,false);
   await advance(2960);assert.equal(current().path.infused,false);
   await visibility(true);await advance(4000);assert.equal(current().path.infused,false);
   await visibility(false);await advance(80);assert.equal(current().path.infused,true);assert.equal(discoveries.length,1);
 });
});
