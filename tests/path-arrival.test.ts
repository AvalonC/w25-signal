import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inViewport,inSky,pathArrival,pathReturn,wishOrbit,PATH_ENTRY_MS,PATH_ENTRY_REDUCED_MS,PATH_RETURN_MS} from '../lib/path-arrival.ts';

void test('viewport handoff preserves the same screen pixel across different scene rectangles',()=>{
  const oldBox={left:18,top:62,width:354,height:756},newBox={left:12,top:54,width:366,height:778};
  const viewport=inViewport({x:26,y:78},oldBox,390,844),mapped=inSky(viewport,newBox,390,844);
  assert.ok(Math.abs(newBox.left+mapped.x*newBox.width/100-(oldBox.left+oldBox.width*.26))<1e-8);
  assert.ok(Math.abs(newBox.top+mapped.y*newBox.height/100-(oldBox.top+oldBox.height*.78))<1e-8);
});

void test('arrival carries the existing three wishes through two discoveries and returns each to its continuing orbit',()=>{
  const start={x:29,y:84},companions=[{x:31,y:83},{x:28,y:85},{x:29,y:81}];
  const first=pathArrival(0,false,start,companions,2.1,354,740);
  assert.deepEqual(first.main,start);assert.deepEqual(first.companions,companions);
  assert.equal(first.prism,0);assert.equal(first.date,0);assert.equal(first.route,0);
  const during=pathArrival(2200,false,start,companions,2.1,354,740);
  assert.deepEqual(during.companions[0],{x:23,y:26});assert.deepEqual(during.companions[1],{x:76,y:17});
  assert.ok(during.prism>during.date);assert.equal(during.done,false);
  const last=pathArrival(PATH_ENTRY_MS,false,start,companions,2.1,354,740);
  assert.deepEqual(last.main,{x:26,y:78});assert.equal(last.done,true);
  for(let i=0;i<3;i++){
    const offset=wishOrbit(last.phase,i,15);
    assert.ok(Math.abs((last.companions[i].x-last.main.x)*3.54-offset.x)<1e-8);
    assert.ok(Math.abs((last.companions[i].y-last.main.y)*7.4-offset.y)<1e-8);
  }
});

void test('reduced motion and a discovery return keep the first frame and complete without an extended expedition',()=>{
  const start={x:50,y:42},companions=[{x:48,y:40},{x:53,y:42},{x:49,y:43}];
  assert.deepEqual(pathReturn(0,false,start,companions,0,390,844,{x:23,y:59}).companions,companions);
  const returned=pathReturn(PATH_RETURN_MS,false,start,companions,0,390,844,{x:23,y:59});
  assert.deepEqual(returned.main,{x:23,y:59});assert.equal(returned.done,true);
  const reduced=pathArrival(PATH_ENTRY_REDUCED_MS,true,start,companions,2,390,844);
  assert.equal(reduced.phase,2);assert.equal(reduced.done,true);
});
