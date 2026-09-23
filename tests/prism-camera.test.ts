import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prismEntranceFrame, PRISM_ENTRANCE_MS } from '../lib/light-infusion.ts';

void test('the mirror approach, camera orbit, straight input and dispersion happen in that order',()=>{
  const first=prismEntranceFrame(0);
  assert.equal(first.approach,0);assert.equal(first.turn,0);assert.equal(first.beam,0);assert.equal(first.spectrum,0);
  const approach=prismEntranceFrame(1000);
  assert.ok(approach.approach>.5);assert.equal(approach.turn,0);assert.equal(approach.beam,0);
  const orbit=prismEntranceFrame(2400);
  assert.equal(orbit.approach,1);assert.ok(orbit.turn>.5);assert.equal(orbit.beam,0);assert.equal(orbit.spectrum,0);
  const beam=prismEntranceFrame(3100);
  assert.equal(beam.turn,1);assert.ok(beam.beam>0);assert.equal(beam.spectrum,0);
  const disperse=prismEntranceFrame(3800);
  assert.equal(disperse.beam,1);assert.ok(disperse.spectrum>0);assert.equal(disperse.done,false);
  assert.equal(prismEntranceFrame(PRISM_ENTRANCE_MS-1).done,false);
  const complete=prismEntranceFrame(PRISM_ENTRANCE_MS);
  assert.equal(complete.done,true);assert.equal(complete.spectrum,1);
});

void test('camera interpolation is continuous, bounded and quiet under reduced motion',()=>{
  const properties=['approach','turn','beam','spectrum'] as const;
  let previous=prismEntranceFrame(0);
  for(let time=20;time<=5000;time+=20){
    const next=prismEntranceFrame(time);
    for(const key of properties){assert.ok(next[key]>=previous[key]&&next[key]<=1);assert.ok(next[key]-previous[key]<.04);}
    previous=next;
  }
  assert.equal(prismEntranceFrame(649,true).done,false);
  const quiet=prismEntranceFrame(650,true);
  assert.equal(quiet.done,true);assert.equal(quiet.spectrum,1);
});
