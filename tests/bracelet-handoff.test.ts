import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handoffFrame, HANDOFF_DURATION, HANDOFF_REDUCED_DURATION, HANDOFF_CAMERA_START, HANDOFF_CAMERA_END } from '../lib/bracelet-handoff.ts';

void test('presentation holds the overview until its copy clears, then lifts the same camera before unlocking', () => {
  const initial = handoffFrame(0);
  assert.equal(initial.cameraProgress, 0);
  assert.equal(initial.orbit, '0deg 12deg calc(0.12m + 0%)');
  assert.equal(initial.closureOpacity, 1);
  assert.equal(initial.actionsOpacity, 0);
  assert.equal(initial.arOpacity, 0);
  assert.equal(initial.ready, false);
  assert.equal(handoffFrame(HANDOFF_CAMERA_START).cameraProgress, 0);
  assert.equal(handoffFrame(HANDOFF_CAMERA_START).closureOpacity, 0);
  assert.equal(handoffFrame((HANDOFF_CAMERA_START + HANDOFF_CAMERA_END) / 2).cameraProgress, .5);
  const settled = handoffFrame(HANDOFF_CAMERA_END);
  assert.equal(settled.orbit, '52deg 60deg calc(0m + 115%)');
  assert.equal(settled.ready, false, 'Camera settles before the controls become operable');
  assert.equal(handoffFrame(HANDOFF_DURATION - 1).ready, false);
  const complete = handoffFrame(HANDOFF_DURATION);
  assert.equal(complete.cameraProgress, 1);
  assert.equal(complete.actionsOpacity, 1);
  assert.equal(complete.arOpacity, 1);
  assert.equal(complete.ready, true);
});

void test('new controls and AR appear in sequence after the closure HUD has disappeared', () => {
  for (const reduced of [false, true]) {
    const duration = reduced ? HANDOFF_REDUCED_DURATION : HANDOFF_DURATION;
    let previous = handoffFrame(0, reduced);
    for (let ms = 0; ms <= duration; ms += 5) {
      const frame = handoffFrame(ms, reduced);
      assert.ok(frame.cameraProgress >= previous.cameraProgress);
      assert.ok(frame.closureOpacity <= previous.closureOpacity);
      assert.ok(frame.actionsOpacity >= previous.actionsOpacity);
      assert.ok(frame.arOpacity >= previous.arOpacity);
      if (frame.actionsOpacity > 0 || frame.arOpacity > 0) assert.equal(frame.closureOpacity, 0);
      if (frame.arOpacity > 0) assert.ok(frame.actionsOpacity > 0);
      for (const value of [frame.cameraProgress, frame.closureOpacity, frame.actionsOpacity, frame.arOpacity]) {
        assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      }
      previous = frame;
    }
  }
  assert.equal(handoffFrame(1900).actionsOpacity, 0);
  assert.ok(handoffFrame(2000).actionsOpacity > 0);
  assert.equal(handoffFrame(2200).arOpacity, 0);
  assert.ok(handoffFrame(2400).arOpacity > 0);
});

void test('reduced motion keeps a static final pose and completes its short HUD handoff before input is enabled', () => {
  for (const ms of [0, 100, 180, 240, 340, 399, 400]) {
    const frame = handoffFrame(ms, true);
    assert.equal(frame.cameraProgress, 1);
    assert.equal(frame.orbit, '52deg 60deg calc(0m + 115%)');
    assert.equal(frame.duration, HANDOFF_REDUCED_DURATION);
    assert.equal(frame.ready, ms >= HANDOFF_REDUCED_DURATION);
  }
  assert.equal(handoffFrame(0, true).closureOpacity, 1);
  assert.equal(handoffFrame(HANDOFF_REDUCED_DURATION, true).actionsOpacity, 1);
  assert.equal(handoffFrame(HANDOFF_REDUCED_DURATION, true).arOpacity, 1);
});

void test('the camera radius expression is finite, bounded and clamped at both timeline edges', () => {
  for (const reduced of [false, true]) {
    const start = handoffFrame(0, reduced);
    const end = handoffFrame(Infinity, reduced);
    assert.deepEqual(handoffFrame(NaN, reduced), start);
    assert.deepEqual(handoffFrame(-Infinity, reduced), start);
    assert.deepEqual(handoffFrame(-200, reduced), start);
    assert.deepEqual(handoffFrame(1e9, reduced), end);
    for (const ms of [NaN, -Infinity, -1, 0, 301, 1234, 2099, 2600, Infinity]) {
      const frame = handoffFrame(ms, reduced);
      const values = frame.orbit.match(/^([^ ]+)deg ([^ ]+)deg calc\(([^ ]+)m \+ ([^ ]+)%\)$/);
      assert.ok(values, 'The orbit must preserve model-viewer calc syntax');
      const [theta, phi, meters, percentage] = values.slice(1).map(Number);
      assert.ok([theta, phi, meters, percentage].every(Number.isFinite));
      assert.ok(theta >= 0 && theta <= 52);
      assert.ok(phi >= 12 && phi <= 60);
      assert.ok(meters >= 0 && meters <= .12);
      assert.ok(percentage >= 0 && percentage <= 115);
      assert.ok(Math.abs(meters / .12 + percentage / 115 - 1) < 1e-12);
    }
  }
});
