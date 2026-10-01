import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
const { DestinationDrawing } = await import('../components/game/path-destinations.tsx');
const drawing = (place, progress, reduced = false) => DestinationDrawing({place,progress,reduced});
function nodes(element, hidden = false) {
  if (!React.isValidElement(element)) return [];
  const invisible = hidden || element.props.visibility === 'hidden';
  return [{type:element.type, ...element.props, hidden:invisible}, ...React.Children.toArray(element.props.children).flatMap(child=>nodes(child,invisible))];
}
const find = (tree, className) => nodes(tree).find(node=>node.className?.split(' ').includes(className));
const points = d => d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number).reduce((all,n,i,list)=>i%2?all:[...all,[n,list[i+1]]],[]);
const area = d => {
  const [a,b,c] = points(d);
  return Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
};
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);

test('destination birth has no detached points or full edges at its zero frame', () => {
  for (const place of ['prism','date']) for (const reduced of [false,true]) {
    const tree = drawing(place,0,reduced);
    assert.equal(nodes(tree).filter(node=>['path','circle'].includes(node.type)&&!node.hidden).length,0);
    assert.equal(tree.props.opacity,undefined,'the SVG never relies on a whole-icon fade');
    assert.doesNotMatch(renderToStaticMarkup(tree),/NaN|Infinity/);
  }
  assert.equal(nodes(drawing('prism',.5)).filter(node=>node.type==='circle').length,0,'the prism is built from attached faces, not arriving star dots');
});

test('prism faces unfold on one ridge before its rays are released', () => {
  for (const progress of [.22,.45,.7,1]) {
    const tree = drawing('prism',progress);
    const left = find(tree,'path-prism-fold-left'), right = find(tree,'path-prism-fold-right');
    const [a,c,b] = points(left.d), [otherA,otherB] = points(right.d);
    assert.deepEqual(a,otherA);assert.deepEqual(b,otherB,'both moving faces stay on the same ridge');
    assert.deepEqual(points(find(tree,'path-prism-ridge').d),[a,b]);
    assert.ok(c.every(Number.isFinite));
  }
  assert.ok(area(find(drawing('prism',.6),'path-prism-fold-left').d)>area(find(drawing('prism',.3),'path-prism-fold-left').d)*2,'the silhouette opens geometrically');
  const ready = drawing('prism',1);
  assert.deepEqual(points(find(ready,'path-prism-outline').d),[[22,74],[49,18],[78,69],[60,84]],'the existing four silhouette corners are preserved');
  assert.equal(find(drawing('prism',.72),'path-prism-input').visibility,'hidden');
  assert.ok(find(drawing('prism',.82),'path-prism-input').strokeDashoffset<1);
  assert.equal(find(drawing('prism',.82),'path-prism-ray-ice').visibility,'hidden','the split light follows the incident beam');
  assert.equal(find(ready,'path-prism-ray-ice').strokeDashoffset,0);
});

test('date arcs counterwind while ticks unfold on their ring and the hand grows from its axis', () => {
  const first = drawing('date',.35), later = drawing('date',.65), ready = drawing('date',1);
  assert.notEqual(find(first,'path-date-ring-outer').d,find(later,'path-date-ring-outer').d);
  assert.match(find(first,'path-date-ring-outer').d,/A36 36 0 [01] 1 /);
  assert.match(find(first,'path-date-ring-inner').d,/A24 24 0 [01] 0 /);
  const initialTicks = nodes(first).filter(node=>node.className==='path-date-tick');
  assert.equal(initialTicks[0].hidden,false);assert.equal(initialTicks.at(-1).hidden,true,'marks open in sequence around the dial');
  for (const progress of [.2,.45,.7,1]) for (const tick of nodes(drawing('date',progress)).filter(node=>node.className==='path-date-tick')) {
    const [anchor,tip] = points(tick.d);
    assert.ok(Math.abs(distance(anchor,[50,50])-36)<1e-10,'each tick stays attached to its own ring');
    assert.ok(distance(anchor,tip)<=5+1e-10,'ticks unfold locally instead of arriving from outside the dial');
  }
  assert.equal(find(ready,'path-date-axis').visibility,'hidden','the construction axis retracts after the rings form');
  assert.ok(find(ready,'path-date-outer'));assert.ok(find(ready,'path-date-inner'));assert.ok(find(ready,'path-date-needle'));
  const earlyTip = points(find(drawing('date',.69),'path-date-needle-growing').d)[2];
  const finalTip = points(find(ready,'path-date-needle').d)[2];
  assert.ok(distance(earlyTip,[50,50])<distance(finalTip,[50,50])*.3);
  assert.deepEqual(finalTip,[62,33]);
});

test('one progress value renders one exact state and reduced motion only draws settled geometry', () => {
  for (const place of ['prism','date']) {
    assert.equal(renderToStaticMarkup(drawing(place,.58)),renderToStaticMarkup(drawing(place,.58)),'pausing the parent clock freezes every construction element');
    assert.equal(renderToStaticMarkup(drawing(place,-1)),renderToStaticMarkup(drawing(place,0)));
    assert.equal(renderToStaticMarkup(drawing(place,2)),renderToStaticMarkup(drawing(place,1)));
    const quiet = drawing(place,.7,true);
    for (const node of nodes(quiet)) if(node.transform) assert.equal(node.transform,'rotate(0 50 50)');
    assert.doesNotMatch(renderToStaticMarkup(quiet),/animate|transition|scale\(/,'there are no independent construction clocks or zooms');
  }
  assert.equal(find(drawing('prism',.6,true),'path-prism-outline').d,find(drawing('prism',1,true),'path-prism-outline').d);
  assert.equal(find(drawing('date',.8,true),'path-date-needle-growing').d,find(drawing('date',1,true),'path-date-needle').d);
});
