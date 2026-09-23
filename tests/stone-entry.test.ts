import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STONE_LIGHT_ORIGIN,isStoneEntry,stoneEntry} from '../lib/stone-entry.ts';

void test('the light begins above the actual projected upper table for short and tall screens',()=>{
 assert.deepEqual(STONE_LIGHT_ORIGIN,{x:50,y:10});
 for(const [width,height] of [[284,350],[366,630],[402,720],[760,540]]){
  const entry=stoneEntry(width,height);
  assert.equal(entry.x,50);assert.ok(entry.y>STONE_LIGHT_ORIGIN.y&&entry.y<47);
  const projectedPixels=height*.47-.330827*Math.min(width*.3,height*.29);
  assert.ok(Math.abs(entry.y*height/100-projectedPixels)<1e-10);
  assert.equal(isStoneEntry(entry,width,height),true);
  assert.equal(isStoneEntry(STONE_LIGHT_ORIGIN,width,height),false,'the waiting star cannot already count as delivered');
 }
});

void test('the hit area uses a bounded physical radius and rejects drops on the lower half',()=>{
 for(const [width,height] of [[200,350],[390,640],[760,550]]){
  const entry=stoneEntry(width,height),radius=Math.max(28,Math.min(48,width*.12));
  assert.equal(isStoneEntry({x:50+(radius-.01)/width*100,y:entry.y},width,height),true);
  assert.equal(isStoneEntry({x:50+(radius+.01)/width*100,y:entry.y},width,height),false);
  assert.equal(isStoneEntry({x:50,y:entry.y+(radius+.01)/height*100},width,height),false);
  assert.equal(isStoneEntry({x:50,y:75},width,height),false);
 }
});
