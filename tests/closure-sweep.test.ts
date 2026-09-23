import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSURE_GEM, CLOSURE_PARTS, closureTimeline } from '../lib/path-closure.ts';
import { CLOSURE_SWEEP_START, closureSweep, closureSweepPath } from '../lib/closure-sweep.ts';
import type { Vec3 } from '../lib/bracelet-transition.ts';

const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closeTo = (actual: Vec3, expected: Vec3, message: string) => {
  assert.ok(distance(actual, expected) < 1e-10, `${message}: ${actual.join(",")} != ${expected.join(",")}`);
};

void test('the sweep waits for the ring to close, then reaches each actual diamond in physical order', () => {
  for (const reduced of [false, true]) {
    const { frames, settle } = closureTimeline(reduced);
    const start = closureSweep(reduced ? 200 : 1100, reduced);
    closeTo(start.position, CLOSURE_SWEEP_START, 'The star begins at the joined end');
    assert.equal(start.index, -1);
    for (const [index, frame] of frames.entries()) {
      const stones = CLOSURE_PARTS[index].stones;
      const first = closureSweep(frame.start, reduced);
      const middle = closureSweep((frame.start + frame.end) / 2, reduced);
      const last = closureSweep(frame.end - .000001, reduced);
      assert.equal(first.index, index);
      closeTo(first.position, stones[0], 'The first diamond is reached when its mark begins');
      closeTo(middle.position, stones[Math.floor(stones.length / 2)], 'The midpoint follows the real centre diamond');
      closeTo(last.position, stones[stones.length - 1], 'The final diamond is reached before leaving a bar');
      assert.equal(first.stoneStrengths[index][0], 1);
      assert.ok(middle.stoneStrengths[index][Math.floor(stones.length / 2)] > .999999);
    }
    const end = closureSweep(settle, reduced);
    closeTo(end.position, CLOSURE_GEM, 'The final destination is the right-hand star setting');
    assert.equal(end.index, -1);
    assert.equal(end.progress, 1);
    assert.ok(end.angle > 460 && end.angle < 465, 'The star completes the clasp arc rather than reversing');
  }
});

void test('ordinary motion is continuous at every mark boundary and travels around the ring without crossing its centre', () => {
  const timeline = closureTimeline();
  let previousAngle = 20;
  for (let ms = 0; ms <= timeline.settle; ms += 5) {
    const sweep = closureSweep(ms);
    assert.ok(sweep.angle >= previousAngle - 1e-7, 'The star must keep travelling forward');
    assert.ok(Math.hypot(sweep.position[0], sweep.position[2]) > .0228);
    assert.ok(sweep.position.every(Number.isFinite));
    previousAngle = sweep.angle;
  }
  for (const time of [1100, ...timeline.frames.flatMap((frame) => [frame.start, frame.end]), timeline.settle]) {
    const before = closureSweep(time - .001), at = closureSweep(time), after = closureSweep(time + .001);
    assert.ok(distance(before.position, at.position) < 1e-8, `Continuous arrival at ${time}`);
    assert.ok(distance(after.position, at.position) < 1e-8, `Continuous departure at ${time}`);
  }
  for (const [index, frame] of timeline.frames.entries()) {
    closeTo(closureSweep(frame.end).position, CLOSURE_PARTS[index].stones.at(-1)!, 'A gap begins where its diamond ends');
    assert.equal(closureSweep(frame.end).index, -1);
  }
});

void test('reflection is mapped to the nearest physical diamond instead of illuminating an entire Morse bar at once', () => {
  const { frames } = closureTimeline();
  for (const [index, frame] of frames.entries()) {
    for (const fraction of [0, .15, .35, .5, .65, .85, .999]) {
      const sweep = closureSweep(frame.start + (frame.end - frame.start) * fraction);
      const flattened = CLOSURE_PARTS.flatMap((part, partIndex) => part.stones.map((stone, stoneIndex) => ({
        distance: distance(stone, sweep.position), strength: sweep.stoneStrengths[partIndex][stoneIndex],
      })));
      const nearest = flattened.reduce((closest, stone) => stone.distance < closest.distance ? stone : closest);
      assert.equal(nearest.strength, Math.max(...flattened.map((stone) => stone.strength)));
      assert.ok(nearest.strength > .75);
    }
    if (CLOSURE_PARTS[index].stones.length === 3) {
      const first = closureSweep(frame.start).stoneStrengths[index];
      const middle = closureSweep((frame.start + frame.end) / 2).stoneStrengths[index];
      assert.ok(first[0] > first[1] && first[1] > first[2]);
      assert.ok(middle[1] > middle[0] && middle[1] > middle[2]);
    }
  }
});

void test('the travelled path includes each reached stone and shares its endpoint with the travelling star', () => {
  const { frames, settle } = closureTimeline();
  const path = closureSweepPath(settle);
  let previous = -1;
  for (const stone of CLOSURE_PARTS.flatMap((part) => part.stones)) {
    const index = path.findIndex((point, index) => index > previous && distance(point, stone) < 1e-12);
    assert.ok(index > previous, 'Every real diamond must occur in physical traversal order');
    previous = index;
  }
  closeTo(path.at(-1)!, CLOSURE_GEM, 'The completed light path ends on the gemstone');
  for (let index = 1; index < path.length; index++) {
    const midpoint = path[index].map((value, axis) => (value + path[index - 1][axis]) / 2) as Vec3;
    assert.ok(Math.hypot(midpoint[0], midpoint[2]) > .0228, 'Rendered path segments cannot cut across the ring');
  }
  for (const frame of frames) for (const ms of [frame.start - 50, frame.start, (frame.start + frame.end) / 2, frame.end + 50]) {
    closeTo(closureSweepPath(ms).at(-1)!, closureSweep(ms).position, 'The reflected trail must meet the star without a gap');
  }
});

void test('completed diamonds keep only a soft memory, and reduced motion shows the mapped sequence without a flying cursor', () => {
  for (const reduced of [false, true]) {
    const { frames, settle, duration } = closureTimeline(reduced);
    const completed = closureSweep(duration, reduced);
    closeTo(completed.position, CLOSURE_GEM, 'The star remains settled after the animation');
    assert.equal(completed.starOpacity, 0);
    assert.equal(completed.trailOpacity, 0);
    assert.ok(completed.stoneStrengths.flat().every((strength) => strength === .16));
    if (reduced) for (const frame of frames) {
      const state = closureSweep(frame.start + 90, true);
      assert.equal(state.starOpacity, 0);
      assert.equal(state.trailOpacity, 0);
      assert.ok(state.stoneStrengths[state.index].some((strength) => strength > .99));
    }
    for (const ms of [-Infinity, -1, 0, NaN, settle, Infinity]) {
      const state = closureSweep(ms, reduced);
      assert.ok([...state.position, state.angle, state.progress, ...state.stoneStrengths.flat()].every(Number.isFinite));
    }
  }
});
