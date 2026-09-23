import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATE_NEBULA_CENTER, DATE_NEBULA_TIMING, nebulaCloudPoint, nebulaFrame, nebulaParticlePoint, nebulaSeed } from '../lib/date-nebula.ts';

void test('dial light detaches before a nebula forms and the sapphire emerges from that nebula', () => {
  const initial = nebulaFrame(0);
  assert.equal(initial.dialOpacity, 1);
  assert.equal(initial.formation, 0);
  assert.equal(initial.nebula, 0);
  const release = nebulaFrame(1200);
  assert.ok(release.dialOpacity < .5);
  assert.equal(release.formation, 0);
  const nebula = nebulaFrame(4300);
  assert.equal(nebula.dialOpacity, 0);
  assert.equal(nebula.nebula, 1);
  assert.equal(nebula.formation, 0);
  const forming = nebulaFrame(6600);
  assert.ok(forming.formation > .5 && forming.formation < 1);
  assert.ok(forming.nebula < 1 && forming.nebula > .15);
  assert.equal(nebulaFrame(DATE_NEBULA_TIMING.total - 1).done, false);
  const complete = nebulaFrame(DATE_NEBULA_TIMING.total);
  assert.equal(complete.done, true);
  assert.equal(complete.formation, 1);
  assert.ok(complete.nebula > .1, 'a little cloud remains around the newly born stone');
});

void test('the reduced-motion timeline completes in 1800ms with the same final composition', () => {
  assert.equal(nebulaFrame(DATE_NEBULA_TIMING.reduced - 1, true).done, false);
  assert.deepEqual(nebulaFrame(DATE_NEBULA_TIMING.reduced, true), nebulaFrame(DATE_NEBULA_TIMING.total));
  assert.equal(nebulaFrame(-100).dialOpacity, 1);
});

void test('each dust path starts at its measured dial and ends at the sapphire center for every screen shape', () => {
  for (const source of [{ x: .23, y: .26 }, { x: .77, y: .65 }, { x: .5, y: .47 }]) {
    for (const aspect of [.55, 1, 1.85]) {
      for (let seed = 0; seed < 360; seed += 9) {
        assert.deepEqual(nebulaParticlePoint(source, 0, seed, aspect), source);
        assert.deepEqual(nebulaParticlePoint(source, 1, seed, aspect), DATE_NEBULA_CENTER);
        let previous = source;
        for (let step = 1; step <= 100; step++) {
          const point = nebulaParticlePoint(source, step / 100, seed, aspect);
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
          assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < .08, 'flow cannot jump across the stage');
          previous = point;
        }
      }
    }
  }
});

void test('dust has width and arrives on a curved trajectory instead of a straight line', () => {
  const source = { x: .2, y: .47 };
  const midpoints = Array.from({ length: 80 }, (_, seed) => nebulaParticlePoint(source, .48, seed));
  const xs = midpoints.map((p) => p.x), ys = midpoints.map((p) => p.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > .055);
  assert.ok(Math.max(...ys) - Math.min(...ys) > .07);
  assert.ok(midpoints.some((p) => Math.abs(p.y - source.y) > .1));
});

void test('the cloud is deterministic and layered at several radii around the shared center', () => {
  const points = Array.from({ length: 220 }, (_, i) => nebulaCloudPoint(i));
  const radii = points.map((p) => Math.hypot(p.x - .5, (p.y - .47) / .64));
  assert.ok(Math.min(...radii) < .05);
  assert.ok(Math.max(...radii) > .19);
  assert.deepEqual(nebulaCloudPoint(18, .6), nebulaCloudPoint(18, .6));
  for (let i = 0; i < 220; i++) assert.ok(nebulaSeed(i) >= 0 && nebulaSeed(i) < 1);
});
