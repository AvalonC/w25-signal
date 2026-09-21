import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLOSURE_CODES, CLOSURE_GEM, CLOSURE_PARTS, CLOSURE_START, CLOSURE_TARGET,
  closureFrame, closureNear, closurePoint, closureTimeline } from '../lib/path-closure.ts';

void test('W25 marks map to the unchanged GLB round and triple-bar diamond centres in physical order', () => {
  const buffer = readFileSync(new URL('../public/models/bracelet-ring.glb', import.meta.url));
  const model = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const centre = (name: string) => {
    const node = model.nodes.find((node: { name: string }) => node.name === name);
    assert.ok(node, `The real bracelet must contain ${name}`);
    const bounds = model.meshes[node.mesh].primitives.map((p: { attributes: { POSITION: number } }) => model.accessors[p.attributes.POSITION]);
    return [0, 1, 2].map((i) => (Math.min(...bounds.map((a: { min: number[] }) => a.min[i])) +
      Math.max(...bounds.map((a: { max: number[] }) => a.max[i]))) / 2);
  };
  assert.equal(CLOSURE_PARTS.length, 13);
  assert.equal(CLOSURE_PARTS.flatMap((part) => part.stones).length, 23);
  for (const [group, code] of CLOSURE_CODES.entries())
    assert.equal(CLOSURE_PARTS.filter((part) => part.group === group).map((part) => part.symbol).join(''), code);
  let angle = 0;
  for (const part of CLOSURE_PARTS) {
    assert.equal(part.stones.length, part.symbol === '-' ? 3 : 1);
    for (const [i, stone] of part.stones.entries()) {
      assert.deepEqual(stone, centre(`${part.node} · ${part.symbol === '.' ? '2.0 mm diamond' : `1.3 mm diamond ${i + 1}`}`));
    }
    const point = part.stones[Math.floor(part.stones.length / 2)];
    const next = (Math.atan2(point[0], point[2]) * 180 / Math.PI + 360) % 360;
    assert.ok(next > angle, 'The reveal must travel along the physical chain instead of reordering its marks');
    angle = next;
  }
  assert.deepEqual(CLOSURE_GEM, centre('Pink oval · seated pink sapphire'));
});

void test('closure reveals one real mark at a time, retains completed groups, and settles at the sapphire', () => {
  for (const reduced of [false, true]) {
    const timeline = closureTimeline(reduced);
    assert.equal(closureFrame(0, reduced).lit.some(Boolean), false);
    for (const [index, frame] of timeline.frames.entries()) {
      const before = closureFrame(frame.start - 1, reduced), during = closureFrame(frame.start, reduced);
      assert.equal(before.lit[index], false);
      assert.equal(during.active, index);
      assert.equal(during.lit.filter(Boolean).length, index + 1);
      assert.equal(during.group, CLOSURE_PARTS[index].group);
      assert.equal(during.ready, false);
    }
    assert.equal(closureFrame(timeline.settle - 1, reduced).gemstone, 0);
    assert.equal(closureFrame(timeline.duration - 1, reduced).ready, false);
    const end = closureFrame(timeline.duration, reduced);
    assert.equal(end.gemstone, 1); assert.equal(end.solid, 1);
    assert.equal(end.join, 1); assert.equal(end.ready, true);
    assert.equal(end.lit.filter(Boolean).length, 13);
  }
});

void test('drop tolerance works on narrow phones without accepting the starting star or distant drops', () => {
  for (const size of [260, 284, 354, 480]) {
    assert.equal(closureNear(CLOSURE_TARGET, size, size), true);
    assert.equal(closureNear(CLOSURE_START, size, size), false);
    assert.equal(closureNear({ x: 50, y: 20 }, size, size), false);
  }
  for (const part of CLOSURE_PARTS) for (const stone of part.stones) {
    const point = closurePoint(stone);
    assert.ok(point.x >= 5 && point.x <= 95 && point.y >= 5 && point.y <= 95);
  }
});
