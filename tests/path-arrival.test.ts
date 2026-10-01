import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inViewport,inSky,pathArrival,pathReturn,PATH_ENTRY_MS,PATH_ENTRY_REDUCED_MS,PATH_RETURN_MS} from '../lib/path-arrival.ts';

void test('viewport handoff preserves the same screen pixel across different scene rectangles',()=>{
  const oldBox={left:18,top:62,width:354,height:756},newBox={left:12,top:54,width:366,height:778};
  const viewport=inViewport({x:26,y:78},oldBox,390,844),mapped=inSky(viewport,newBox,390,844);
  assert.ok(Math.abs(newBox.left+mapped.x*newBox.width/100-(oldBox.left+oldBox.width*.26))<1e-8);
  assert.ok(Math.abs(newBox.top+mapped.y*newBox.height/100-(oldBox.top+oldBox.height*.78))<1e-8);
});

void test('the main star stays at the handoff while both destinations build and companions only orbit nearby',()=>{
  const start={x:50,y:77},companions=[{x:54,y:76},{x:46,y:78},{x:50,y:75}];
  const width=354,height=740;
  const first=pathArrival(0,false,start,companions,2.1,width,height);
  assert.deepEqual(first.main,start);assert.deepEqual(first.companions,companions);
  assert.equal(first.prism,0);assert.equal(first.date,0);assert.equal(first.route,0);
  const initialRadius=companions.map(p=>Math.hypot((p.x-start.x)*width/100,(p.y-start.y)*height/60));
  for(let elapsed=0;elapsed<=PATH_ENTRY_MS+1000;elapsed+=40){
    const frame=pathArrival(elapsed,false,start,companions,2.1,width,height);
    assert.deepEqual(frame.main,start,'neither icon creation nor interaction unlock moves the main star');
    frame.companions.forEach((p,i)=>{
      const radius=Math.hypot((p.x-start.x)*width/100,(p.y-start.y)*height/60);
      assert.ok(Math.abs(radius-initialRadius[i])<1e-8,'the received orbit radius is never replaced with a smaller one');
      assert.ok(p.y>70,'no companion travels to the distant icons');
    });
  }
  const during=pathArrival(1000,false,start,companions,2.1,width,height);
  assert.ok(during.prism>during.date&&during.date>0);assert.equal(during.done,false);
  const last=pathArrival(PATH_ENTRY_MS,false,start,companions,2.1,width,height);
  assert.equal(last.prism,1);assert.equal(last.date,1);assert.equal(last.route,1);assert.equal(last.done,true);
  for(const elapsed of [0,240,480,2000])assert.deepEqual(pathArrival(elapsed,true,start,companions,2.1,width,height).companions,companions,'reduced motion retains the actual companion positions');
});

void test('reduced motion and a discovery return keep the first frame and complete without an extended expedition',()=>{
  const start={x:50,y:42},companions=[{x:48,y:40},{x:53,y:42},{x:49,y:43}];
  assert.deepEqual(pathReturn(0,false,start,companions,0,390,844,{x:23,y:59}).companions,companions);
  const returned=pathReturn(PATH_RETURN_MS,false,start,companions,0,390,844,{x:23,y:59});
  assert.deepEqual(returned.main,{x:23,y:59});assert.equal(returned.done,true);
  const reduced=pathArrival(PATH_ENTRY_REDUCED_MS,true,start,companions,2,390,844);
  assert.equal(reduced.phase,2);assert.equal(reduced.done,true);
});
