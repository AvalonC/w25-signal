import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceDialRotation } from '../lib/dial-motion.ts';

void test('month and date wraps travel one tick in either direction', () => {
  assert.equal(advanceDialRotation(-360, 12, 1, 12), -390);
  assert.equal(advanceDialRotation(-30, 1, 12, 12), 0);
  assert.ok(Math.abs(advanceDialRotation(-360, 31, 1, 31) + 360 + 360 / 31) < 1e-10);
  assert.ok(Math.abs(advanceDialRotation(-360 / 31, 1, 31, 31)) < 1e-10);
});

void test('repeated turns retain direction while direct changes use the nearest angle', () => {
  let angle = -30;
  let previous = 1;
  for (let i = 0; i < 36; i++) {
    const next = previous === 12 ? 1 : previous + 1;
    angle = advanceDialRotation(angle, previous, next, 12);
    previous = next;
  }
  assert.equal(angle, -1110);
  assert.equal(advanceDialRotation(-30, 1, 10, 12), 60);
  assert.equal(advanceDialRotation(60, 10, 10, 12), 60);
});
