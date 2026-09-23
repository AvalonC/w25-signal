import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {act,create} from 'react-test-renderer';
const repo=fileURLToPath(new URL('../',import.meta.url));
registerHooks({
 resolve(specifier,context,next){const url=specifier.startsWith('@/')?pathToFileURL(repo+specifier.slice(2)).href:specifier.startsWith('./')||specifier.startsWith('../')?new URL(specifier,context.parentURL).href:null;if(url)for(const ext of ['.ts','.tsx'])if(existsSync(fileURLToPath(url+ext)))return next(url+ext,context);return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+readFileSync(new URL(url),'utf8')};if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};return next(url,context);}
});
const {useBraceletDelivery}=await import('../components/game/model.tsx');
test('the real bracelet delivery preserves the clicked origin and cannot finish while hidden, blurred or paused',async()=>{
 const keys=['document','window','performance','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];const originals=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let now=0,id=0,root,delivery;const frames=new Map(),arrivals=[],touches=[];
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.document=Object.assign(new EventTarget(),{hidden:false,hasFocus:()=>true});globalThis.window=Object.assign(new EventTarget(),{innerWidth:400,innerHeight:800});
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now,mark(){},measure(){},clearMarks(){},clearMeasures(){}}});
 globalThis.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 const view={theta:0,phi:1,radius:.12,fov:30,target:[0,0,0],left:50,top:100,width:300,height:300};
 const props={paused:false,enabled:true,reduced:false,onGem:a=>arrivals.push(a),onScatter:()=>touches.push('start'),viewer:{current:{camera:()=>view}},surface:{current:{getBoundingClientRect:()=>({left:50,top:100,width:300,height:300})}}};
 function Harness(p){const value=useBraceletDelivery(p);React.useLayoutEffect(()=>{delivery=value;},[value]);return React.createElement('span');}
 const advance=async ms=>{for(let t=0;t<ms;t+=40){now+=40;const callbacks=[...frames.values()];frames.clear();await act(()=>callbacks.forEach(cb=>cb(now)));}};
 try{
  await act(()=>{root=create(React.createElement(Harness,props));});
  const origin={x:.73,y:.38};await act(()=>delivery.depart(origin));assert.equal(delivery.view,view);assert.deepEqual(touches,['start']);
  delivery.positions.current=[{x:24,y:38},{x:145,y:207}];
  await advance(800);const frozen=delivery.clock;await act(()=>window.dispatchEvent(new Event('blur')));await advance(8000);assert.equal(delivery.clock,frozen);assert.deepEqual(arrivals,[]);
  await act(()=>window.dispatchEvent(new Event('focus')));await act(()=>root.update(React.createElement(Harness,{...props,paused:true})));await advance(8000);assert.equal(delivery.clock,frozen);assert.deepEqual(arrivals,[]);
  await act(()=>root.update(React.createElement(Harness,props)));document.hidden=true;await advance(8000);assert.equal(delivery.clock,frozen);assert.deepEqual(arrivals,[]);
  document.hidden=false;await advance(3000);assert.equal(arrivals.length,1);assert.deepEqual(arrivals[0].origin,origin);assert.deepEqual(arrivals[0].viewport,{width:400,height:800});assert.equal(arrivals[0].points.length,2);
  await act(()=>delivery.depart({x:.1,y:.1}));await advance(5000);assert.equal(arrivals.length,1);assert.deepEqual(touches,['start']);
  await act(()=>root.unmount());root=null;assert.equal(frames.size,0);
 }finally{if(root)await act(()=>root.unmount());for(const k of keys)if(originals[k])Object.defineProperty(globalThis,k,originals[k]);else delete globalThis[k];}
});
