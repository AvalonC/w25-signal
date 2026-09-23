import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RELAY_DEPARTURE, relayDeparture } from '../lib/relay-departure.ts';
import { RELAY_SHORES, RELAY_WISHES } from '../lib/relay-motion.ts';

void test('departure begins at the last shore and never sends the main star back toward the player', () => {
  const start = relayDeparture(0), end = relayDeparture(RELAY_DEPARTURE.duration);
  assert.deepEqual(start.main, RELAY_SHORES[3]);
  assert.deepEqual(start.companions, RELAY_WISHES);
  assert.deepEqual(end.main, RELAY_DEPARTURE.end);
  assert.ok(end.main[0] > 340 && end.main[1] < 0);
  let previous = start;
  for (let ms = 40; ms <= RELAY_DEPARTURE.duration; ms += 40) {
    const current = relayDeparture(ms);
    assert.ok(current.main[0] >= previous.main[0] && current.main[1] <= previous.main[1], 'the main star only moves up and right');
    assert.ok(current.companions.every((point, i) => point[1] <= previous.companions[i][1]), 'all three wishes continue toward the upper sky');
    previous = current;
  }
  assert.equal(end.ready, true);
  assert.equal(relayDeparture(RELAY_DEPARTURE.duration - 1).ready, false);
  assert.deepEqual(relayDeparture(RELAY_DEPARTURE.duration + 500), end);
});

void test('the completed map fades while the wishes gather and all four lights depart together', () => {
  const start = relayDeparture(0), gathered = relayDeparture(RELAY_DEPARTURE.gatherMs), end = relayDeparture(RELAY_DEPARTURE.duration);
  assert.equal(start.routeOpacity, 1);
  assert.equal(start.mainOpacity, 1);
  assert.equal(start.companionOpacity, 1);
  assert.ok(relayDeparture(540).routeOpacity > 0 && relayDeparture(540).routeOpacity < 1);
  assert.equal(gathered.routeOpacity, 0);
  assert.ok(gathered.companions.every((point) => point[1] < 100), 'wishes catch up before the onward flight finishes');
  assert.equal(gathered.mainOpacity, 1, 'the main star stays present during the gathering');
  assert.ok(end.companions.every((point) => point[1] < 0));
  assert.equal(end.mainOpacity, 0);
  assert.equal(end.companionOpacity, 0);
  assert.equal(end.routeOpacity, 0);
});

void test('reduced motion fades in place without flying and completes in 400ms', () => {
  const start = relayDeparture(0, true), halfway = relayDeparture(RELAY_DEPARTURE.reduced / 2, true), end = relayDeparture(RELAY_DEPARTURE.reduced, true);
  assert.deepEqual(start.main, RELAY_SHORES[3]);
  assert.deepEqual(start.companions, RELAY_WISHES);
  assert.equal(start.routeOpacity, 1);
  assert.ok(halfway.routeOpacity > 0 && halfway.routeOpacity < 1);
  for (let ms = 0; ms <= RELAY_DEPARTURE.reduced; ms += 40) {
    const frame = relayDeparture(ms, true);
    assert.deepEqual(frame.main, start.main);
    assert.deepEqual(frame.companions, start.companions);
    assert.equal(frame.mainOpacity, frame.companionOpacity);
  }
  assert.equal(relayDeparture(RELAY_DEPARTURE.reduced - 1, true).ready, false);
  assert.equal(end.routeOpacity, 0);
  assert.equal(end.mainOpacity, 0);
  assert.equal(end.ready, true);
  assert.deepEqual(relayDeparture(RELAY_DEPARTURE.reduced + 500, true), end);
});
