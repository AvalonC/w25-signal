import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISCOVERY_DWELL_MS, DISCOVERY_READ_MS, DISCOVERY_WINDOW, SAPPHIRE_DISCOVERIES,
  nextSapphireDiscovery, restoredSapphireDiscovery, sapphireAlignment, sapphireAngleDistance } from '../lib/sapphire-discovery.ts';

test('each discovery needs its own orientation and a settled view', () => {
  assert.equal(nextSapphireDiscovery(-1, .32, 10000), -1);
  assert.equal(nextSapphireDiscovery(-1, 30, 10000), -1, 'large movement is not a discovery');
  SAPPHIRE_DISCOVERIES.forEach(({ angle }, index) => {
    assert.equal(nextSapphireDiscovery(index - 1, angle, DISCOVERY_DWELL_MS - 1), index - 1);
    assert.equal(nextSapphireDiscovery(index - 1, angle, DISCOVERY_DWELL_MS), index);
    assert.equal(nextSapphireDiscovery(index - 1, angle + DISCOVERY_WINDOW + .01, 9000), index - 1);
  });
  assert.equal(nextSapphireDiscovery(0, SAPPHIRE_DISCOVERIES[1].angle, 9000, DISCOVERY_READ_MS - 1), 0);
  assert.equal(nextSapphireDiscovery(2, 0, 10000), 2);
});

test('full turns preserve alignment and distant angles do not produce light', () => {
  for (const { angle } of SAPPHIRE_DISCOVERIES) {
    assert.ok(sapphireAngleDistance(angle + Math.PI * 6, angle) < 1e-12);
  }
  assert.equal(sapphireAlignment(.92, 0).strength, 1);
  assert.equal(sapphireAlignment(.92 + Math.PI, 0).strength, 0);
  assert.equal(sapphireAlignment(NaN, 0).aligned, false);
  assert.equal(sapphireAlignment(1, -1).aligned, false);
});

test('existing 50/100/150 saves restore only the discoveries already made', () => {
  assert.deepEqual([0, 49, 50, 99, 100, 149, 150, 200].map(restoredSapphireDiscovery), [-1, -1, 0, 0, 1, 1, 2, 2]);
  assert.equal(restoredSapphireDiscovery(NaN), -1);
  assert.equal(restoredSapphireDiscovery(-50), -1);
});
