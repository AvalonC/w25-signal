import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATE_NEBULA_CENTER, DATE_NEBULA_TIMING, NEBULA_FACET_ANGLE, NEBULA_STAR_COUNT, nebulaCloudPoint, nebulaDialPoint, nebulaFacetPoint, nebulaFrame, nebulaParticlePoint, nebulaSeed, nebulaStarPoint } from '../lib/date-nebula.ts';
import { projectSapphire, SAPPHIRE_EDGES, SAPPHIRE_VERTICES, type GemVertex } from '../lib/sapphire-shape.ts';

void test('dial marks release in place and the same star cloud resolves before facet lines arrive', () => {
  const initial = nebulaFrame(0);
  assert.equal(initial.dialOpacity, 1);
  assert.equal(initial.formation, 0);
  assert.equal(initial.nebula, 0);
  const release = nebulaFrame(1200);
  assert.ok(release.dialOpacity < .5);
  assert.equal(release.formation, 0);
  for (const time of [0, 1200, 1800, 4300, 6600, 7800]) assert.equal(nebulaFrame(time).dialScale, 1);
  const stars = nebulaFrame(4300);
  assert.equal(stars.dialOpacity, 0);
  assert.ok(stars.nebula > 0 && stars.nebula <= .3, 'the cloud remains a light layer of individual stars');
  assert.ok(stars.resolve > 0, 'stars already trace the future gemstone before facet lines appear');
  assert.equal(stars.formation, 0);
  assert.equal(stars.etched, 0);
  const forming = nebulaFrame(6600);
  assert.equal(forming.resolve, 1);
  assert.ok(forming.formation > .5 && forming.formation < 1);
  assert.ok(forming.etched > 0);
  assert.equal(nebulaFrame(DATE_NEBULA_TIMING.total - 1).done, false);
  const complete = nebulaFrame(DATE_NEBULA_TIMING.total);
  assert.equal(complete.done, true);
  assert.equal(complete.formation, 1);
  assert.equal(complete.etched, 1);
  assert.equal(complete.nebula, 0, 'no unrelated cloud remains behind the finished stone');
});

void test('the reduced-motion timeline completes in 1800ms with the same final composition', () => {
  assert.equal(nebulaFrame(DATE_NEBULA_TIMING.reduced - 1, true).done, false);
  assert.deepEqual(nebulaFrame(DATE_NEBULA_TIMING.reduced, true), nebulaFrame(DATE_NEBULA_TIMING.total));
  assert.equal(nebulaFrame(-100).dialOpacity, 1);
  for (let index = 0; index < NEBULA_STAR_COUNT; index += 7) {
    const facet = nebulaFacetPoint(index, 390, 430);
    for (const elapsed of [0, 300, 700, 1200, 1800]) {
      const point = nebulaStarPoint(index, elapsed, { x: .2, y: .4 }, .18, 390, 430, true);
      assert.equal(point.x, facet.x);
      assert.equal(point.y, facet.y, 'reduced motion draws the stars in place without compressed high-speed orbits');
    }
  }
});

void test('dust follows shallow continuous arcs and retains precise source and arrival positions', () => {
  for (const source of [{ x: .23, y: .26 }, { x: .77, y: .65 }, { x: .5, y: .47 }]) {
    for (const aspect of [.55, 1, 1.85]) {
      for (let seed = 0; seed < 360; seed += 9) {
        assert.deepEqual(nebulaParticlePoint(source, 0, seed, aspect), source);
        assert.deepEqual(nebulaParticlePoint(source, 1, seed, aspect), DATE_NEBULA_CENTER);
        let previous = source;
        for (let step = 1; step <= 100; step++) {
          const point = nebulaParticlePoint(source, step / 100, seed, aspect);
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
          assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < .025, 'flow cannot jump across the stage');
          previous = point;
        }
      }
    }
  }
  const midpoint = nebulaParticlePoint({ x: .2, y: .47 }, .5, 12);
  assert.ok(midpoint.y > .49, 'the flow bends away from a straight connecting line');
  assert.ok(midpoint.y < .57, 'the bend is shallow, without a full orbit');
});

void test('every original dial star lands on the exact projected gemstone edge for each screen shape', () => {
  assert.equal(NEBULA_STAR_COUNT, SAPPHIRE_EDGES.length * 9);
  for (const [width, height] of [[320, 290], [390, 430], [1200, 660]]) {
    for (let index = 0; index < NEBULA_STAR_COUNT; index++) {
      const [a, b] = SAPPHIRE_EDGES[Math.floor(index / 9)];
      const t = index % 9 / 8;
      const vertex = SAPPHIRE_VERTICES[a].map((value, axis) => value + (SAPPHIRE_VERTICES[b][axis] - value) * t) as GemVertex;
      const expected = projectSapphire(vertex, NEBULA_FACET_ANGLE, width, height);
      const facet = nebulaFacetPoint(index, width, height);
      assert.deepEqual(facet, { x: expected.x, y: expected.y });
      const source = { x: index % 2 ? .73 : .27, y: index % 2 ? .57 : .38 };
      const radius = index % 2 ? .19 : .21;
      const origin = nebulaDialPoint(index, source, radius, width, height);
      const start = nebulaStarPoint(index, 0, source, radius, width, height);
      assert.equal(start.x, origin.x);
      assert.equal(start.y, origin.y);
      const distance = Math.hypot(origin.x - source.x * width, origin.y - source.y * height);
      assert.ok(distance >= radius * Math.min(width, height) * .869, 'light comes from the dial rings');
      assert.ok(distance <= radius * Math.min(width, height) * 1.001);
      for (const time of [6600, 7200, 7800]) {
        const landed = nebulaStarPoint(index, time, source, radius, width, height);
        assert.equal(landed.x, facet.x);
        assert.equal(landed.y, facet.y);
        if (time === 7800) assert.equal(landed.alpha, 0);
      }
    }
  }
});

void test('the same star moves continuously through release, cloud and facet settlement', () => {
  const width = 390, height = 430;
  for (let index = 0; index < NEBULA_STAR_COUNT; index += 3) {
    const source = { x: index % 2 ? .73 : .27, y: index % 2 ? .57 : .38 };
    let previous = nebulaStarPoint(index, 0, source, .21, width, height);
    for (let time = 40; time <= 7800; time += 40) {
      const point = nebulaStarPoint(index, time, source, .21, width, height);
      assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < 12, 'the cloud cannot swap to a different particle composition');
      assert.ok(point.alpha >= 0 && point.alpha <= 1);
      previous = point;
    }
  }
});

void test('the still microstar cloud remains deterministic with dark gaps between several density levels', () => {
  const points = Array.from({ length: NEBULA_STAR_COUNT }, (_, i) => nebulaCloudPoint(i));
  const radii = points.map((p) => Math.hypot(p.x - .5, (p.y - .47) / .72));
  assert.ok(Math.min(...radii) < .05);
  assert.ok(Math.max(...radii) > .27);
  assert.deepEqual(nebulaCloudPoint(18), nebulaCloudPoint(18));
  for (let i = 0; i < NEBULA_STAR_COUNT; i++) assert.ok(nebulaSeed(i) >= 0 && nebulaSeed(i) < 1);
});
