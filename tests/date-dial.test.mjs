import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import React,{useState} from 'react';
import {act,create} from 'react-test-renderer';
const repo=fileURLToPath(new URL('../',import.meta.url));
registerHooks({
 resolve(specifier,context,next){
  const url=specifier.startsWith('@/')?pathToFileURL(repo+specifier.slice(2)).href:specifier.startsWith('./')||specifier.startsWith('../')?new URL(specifier,context.parentURL).href:null;
  if(url)for(const ext of ['.ts','.tsx'])if(existsSync(fileURLToPath(url+ext)))return next(url+ext,context);
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.endsWith('.tsx'))return{format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
  return next(url,context);
 },
});
const {DateDial}=await import('../components/game/date-dial.tsx');

async function scene(kind,value,body){
 const originals=Object.fromEntries(['document','window','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const captures=new Set(),changes=[];
 const host={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 globalThis.document=Object.assign(new EventTarget(),{hidden:false});globalThis.window=new EventTarget();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let root;
 function Harness({paused=false}){
  const [current,setCurrent]=useState(value);
  return React.createElement(DateDial,{kind,value:current,max:kind==='month'?12:31,label:kind==='month'?'月':'日',paused,onChange:next=>{changes.push(next);setCurrent(next);}});
 }
 try{
  await act(()=>{root=create(React.createElement(Harness),{createNodeMock:()=>host});});
  await body({root,changes,captures,dial:()=>root.root.findByProps({role:'slider'}),
   pause:paused=>act(()=>root.update(React.createElement(Harness,{paused}))),
   visibility:hidden=>act(()=>{document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));}),
   pointer:(clientX,clientY,pointerId=1)=>({clientX,clientY,pointerId,isPrimary:true,button:0,currentTarget:host}),
  });
 }finally{
  if(root)await act(()=>root.unmount());
  for(const [key,descriptor] of Object.entries(originals))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
}

test('large month and day readings stay two digit numbers with only two secondary ring labels',async()=>{
 for(const [kind,value,expected] of [['month',12,'12'],['day',31,'31'],['day',1,'01']])await scene(kind,value,async({root,dial})=>{
  assert.deepEqual(root.root.findByType('strong').children,[expected]);
  assert.equal(root.root.findAllByType('text').length,2,'the ring does not crowd the central reading');
  assert.equal(root.root.findAllByType('line').length,kind==='month'?12:31,'the full physical tick scale remains');
  assert.equal(dial().props['aria-valuenow'],value);assert.equal(dial().props['aria-valuetext'],value+(kind==='month'?'月':'日'));
  assert.equal(root.root.findAllByProps({className:'dial-zodiac'}).length,kind==='month'?1:0);
 });
});

test('large readouts preserve single tick wrapping in both directions and keyboard semantics',async()=>{
 for(const [kind,max] of [['month',12],['day',31]])await scene(kind,max,async({root,dial,changes})=>{
  const label=kind==='month'?'月':'日',rotation=()=>Number(root.root.findByProps({className:'dial-scale'}).props.style.transform.match(/rotate\(([^)]+)deg\)/)[1]);
  await act(()=>root.root.findByProps({'aria-label':label+'加一'}).props.onClick());
  assert.equal(dial().props['aria-valuenow'],1);assert.ok(Math.abs(rotation()+360+360/max)<1e-9);
  await act(()=>dial().props.onKeyDown({key:'ArrowLeft',preventDefault(){}}));
  assert.equal(dial().props['aria-valuenow'],max);assert.equal(rotation(),-360);assert.deepEqual(changes,[1,max]);
 });
});

test('touch turning still changes the value and a cancelled pointer never resumes its drag',async()=>{
 await scene('month',1,async({dial,pointer,changes,captures})=>{
  await act(()=>dial().props.onPointerDown(pointer(200,100)));assert.equal(captures.has(1),true);
  await act(()=>dial().props.onPointerMove(pointer(100,200)));assert.deepEqual(changes,[4]);
  await act(()=>dial().props.onPointerCancel());assert.equal(captures.size,0);
  await act(()=>dial().props.onPointerMove(pointer(0,100)));assert.deepEqual(changes,[4]);
 });
});

test('help and hidden tabs cancel pointer capture and keep arrow alternatives disabled',async()=>{
 await scene('day',31,async({root,dial,pointer,changes,captures,pause,visibility})=>{
  await act(()=>dial().props.onPointerDown(pointer(200,100)));await pause(true);assert.equal(captures.size,0);
  const add=()=>root.root.findByProps({'aria-label':'日加一'});
  assert.equal(add().props.disabled,true);await act(()=>add().props.onClick());assert.deepEqual(changes,[]);
  await pause(false);await visibility(true);await act(()=>add().props.onClick());await act(()=>dial().props.onKeyDown({key:'ArrowRight',preventDefault(){}}));
  assert.deepEqual(changes,[]);assert.equal(dial().props.tabIndex,-1);
  await visibility(false);await act(()=>add().props.onClick());assert.deepEqual(changes,[1]);
 });
});
