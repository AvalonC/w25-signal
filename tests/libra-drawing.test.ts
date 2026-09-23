import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRA_GEOMETRY, projectLibraPoint } from '../lib/libra-drawing.ts';

const mirror = (point: readonly [number, number]) => [-point[0], point[1]];
const pairs = (value: unknown): [number, number][] => {
  if (!Array.isArray(value)) return [];
  if (value.length === 2 && value.every((entry) => typeof entry === 'number')) return [value as [number, number]];
  return value.flatMap(pairs);
};

void test('both pans attach to the horizontal beam and balance symmetrically', () => {
  const { beam, hangers, panRims, panBowls } = LIBRA_GEOMETRY;
  assert.equal(beam[0][1], beam[1][1]);
  assert.deepEqual(mirror(beam[0]), beam[1]);
  assert.deepEqual(hangers[0][0], beam[0]);
  assert.deepEqual(hangers[1][0], beam[0]);
  assert.deepEqual(hangers[2][0], beam[1]);
  assert.deepEqual(hangers[3][0], beam[1]);
  assert.deepEqual([hangers[0][1], hangers[1][1]], panRims[0]);
  assert.deepEqual([hangers[2][1], hangers[3][1]], panRims[1]);
  assert.deepEqual(panBowls[0].map(mirror).reverse(), panBowls[1]);
  assert.deepEqual(panRims[0].map(mirror).reverse(), panRims[1]);
});

void test('the center column connects through two widening pedestal tiers to the bottom arc', () => {
  const { axis, stem, upperStep, lowerStep, baseFoot } = LIBRA_GEOMETRY;
  assert.deepEqual(axis.at(-1), stem[0]);
  assert.equal(stem[2][1], upperStep[0][1]);
  assert.ok(Math.abs(stem[2][0]) < Math.abs(upperStep[0][0]));
  assert.deepEqual(upperStep[2], lowerStep[1]);
  assert.deepEqual(upperStep[3], lowerStep[0]);
  assert.deepEqual(lowerStep[2], baseFoot[2]);
  assert.deepEqual(lowerStep[3], baseFoot[0]);
  assert.ok(Math.abs(lowerStep[2][0]) > Math.abs(upperStep[2][0]));
});

void test('all scale marks and support points fit a 320px screen even during rotation', () => {
  const all = pairs(Object.values(LIBRA_GEOMETRY));
  for (let step = 0; step <= 60; step++) {
    const rotation = step / 60 * Math.PI * 2;
    for (const point of all) {
      const projected = projectLibraPoint(point, 160, 230, 320 * .3, rotation);
      assert.ok(projected.x >= 40 && projected.x <= 280);
      assert.ok(Number.isFinite(projected.y));
    }
  }
});

void test('a full rotation lands on the reference without resizing or offsetting the pedestal', () => {
  for (const point of pairs(Object.values(LIBRA_GEOMETRY))) {
    const reference = projectLibraPoint(point, 195, 260, 117);
    const fullTurn = projectLibraPoint(point, 195, 260, 117, Math.PI * 2);
    assert.ok(Math.abs(reference.x - fullTurn.x) < 1e-10);
    assert.ok(Math.abs(reference.y - fullTurn.y) < 1e-10);
  }
});
