import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightRoad,returnFlight,tracePoint,RETURN_FLIGHT_MS,RETURN_FLIGHT_REDUCED_MS} from '../lib/return-flight.ts';

void test('the retreat keeps its start and finish while the map appears before the close view disappears',()=>{
  for(const reduced of [false,true]){
    const duration=reduced?RETURN_FLIGHT_REDUCED_MS:RETURN_FLIGHT_MS;
    const start=returnFlight(0,reduced),finish=returnFlight(duration,reduced);
    assert.equal(start.star,0);assert.equal(start.camera,0);assert.equal(start.map,0);assert.equal(start.closeOpacity,1);assert.equal(start.done,false);
    assert.equal(finish.star,1);assert.equal(finish.camera,1);assert.equal(finish.map,1);assert.equal(finish.labels,1);assert.equal(finish.closeOpacity,0);assert.equal(finish.done,true);
    const middle=returnFlight(duration*.6,reduced);
    assert.ok(middle.map>.5);assert.equal(middle.closeOpacity,1,'the destinations emerge while the close scene still anchors the return');
    assert.equal(middle.copyOpacity,0,'old words clear before the map becomes interactive');
    const nearEnd=returnFlight(duration-1,reduced);
    assert.equal(nearEnd.done,false);assert.ok(Math.abs(nearEnd.labels-finish.labels)<.0002);
    assert.deepEqual(returnFlight(duration+500,reduced),finish);
  }
});

void test('the curved light path preserves exact screen endpoints and has no final step',()=>{
  for(const [from,to] of [[{x:.23,y:.72},{x:.23,y:.59}],[{x:.5,y:.4},{x:.76,y:.46}],[{x:.7,y:.1},{x:.2,y:.8}]]){
    assert.deepEqual(tracePoint(from,to,0),from);assert.deepEqual(tracePoint(from,to,1),to);
    assert.deepEqual(tracePoint(from,to,-10),from);assert.deepEqual(tracePoint(from,to,10),to);
    const before=tracePoint(from,to,1-.000001);
    assert.ok(Math.hypot(before.x-to.x,before.y-to.y)<.000002);
    for(let i=0;i<=20;i++){
      const point=tracePoint(from,to,i/20);assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
      assert.ok(point.y>=Math.min(from.y,to.y)-1e-12&&point.y<=Math.max(from.y,to.y)+1e-12);
    }
  }
});

void test('the next road presents its trace before its destination and verse in both motion modes',()=>{
  for(const reduced of [false,true]){
    const duration=reduced?300:2200;
    assert.deepEqual(lightRoad(0,reduced),{trace:0,destination:0,verse:0});
    const midway=lightRoad(duration*.5,reduced);
    assert.ok(midway.trace>0);assert.equal(midway.destination,0);assert.equal(midway.verse,0);
    const revealing=lightRoad(duration*.85,reduced);
    assert.ok(revealing.trace>revealing.destination);assert.ok(revealing.destination>revealing.verse);assert.ok(revealing.verse>0);
    assert.deepEqual(lightRoad(duration*1.2,reduced),{trace:1,destination:1,verse:1});
  }
});
