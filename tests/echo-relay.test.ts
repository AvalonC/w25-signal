import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshRelay, relayStep, wishLight, deliveredWishes } from '../lib/echo-relay.ts';
import { MORSE_CODES, fresh, readSave } from '../lib/journey.ts';
import { RELAY_SHORES, RELAY_WISHES, RELAY_MARKS, relayArrival, relayCurve, relayReveal } from '../lib/relay-motion.ts';

void test('entry, completed routes and W25 reveal use the same world coordinates', () => {
  assert.equal(relayArrival(2599).ready, false);
  const arrival = relayArrival(2600);
  assert.deepEqual(arrival.main, RELAY_SHORES[0]);
  assert.deepEqual(arrival.companions, RELAY_WISHES);
  for (let i=0; i<3; i++) {
    assert.deepEqual(relayCurve(i, 0), RELAY_SHORES[i]);
    assert.deepEqual(relayCurve(i, 1), RELAY_SHORES[i+1]);
  }
  assert.equal(RELAY_MARKS.length, 13);
  const start = relayReveal(0), end = relayReveal(5500);
  assert.equal(start.gather, 0);
  assert.deepEqual(start.main, RELAY_SHORES[3]);
  assert.deepEqual(start.companions, RELAY_WISHES);
  assert.equal(end.ready, true);
  assert.equal(end.gather, 1);
  assert.equal(end.returnLight, 1);
  assert.deepEqual(end.main, [180,215]);
  assert.equal(relayReveal(5499).ready, false);
  assert.equal(relayReveal(1000,true).ready, true);
  assert.equal(relayArrival(400,true).ready, true);
});

void test('wish effects combine; delivery order changes the help on the first crossing', () => {
  assert.deepEqual(wishLight([0, 3, 5]), { lead: 1, unit: 433, glimpse: true });
  assert.equal(wishLight([3, 6]).unit, 533);
  assert.equal(wishLight([0]).lead, 1);
  assert.equal(wishLight([3]).lead, 0);
});

void test('three wishes progress from complete reply, to helping, to alternating with the far shore', () => {
  const choices = [0, 3, 5], delivered: number[] = [];
  for (const wish of [5, 0, 3]) {
    let state = relayStep(freshRelay(), { type: 'choose', wish }, choices, delivered);
    assert.equal(state.phase, delivered.length === 2 ? 'echo' : 'listen');
    assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
    if (delivered.length === 2) {
      assert.equal(state.draft, '');
      state = relayStep(state, { type: 'echoed' }, choices, delivered);
      assert.equal(state.draft, '.');
    } else {
      state = relayStep(state, { type: 'heard' }, choices, delivered);
      if (delivered.length === 1) {
        assert.equal(state.phase, 'help');
        assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
        assert.equal(relayStep(state, { type: 'help', wish: 7 }, choices, delivered), state);
        state = relayStep(state, { type: 'help', wish: delivered[0] }, choices, delivered);
        assert.equal(state.listenFrom, 2, 'the helper reconnects the interrupted letter');
        assert.equal(state.helper, delivered[0], 'a delivered wish is still available to help');
        state = relayStep(state, { type: 'heard' }, choices, delivered);
      }
      assert.equal(state.draft, '', 'wishes illuminate the opening but the player replies in full');
    }
    const target = MORSE_CODES[delivered.length];
    assert.ok(state.draft.length < target.length);
    const before = state.draft;
    state = relayStep(state, { type: 'send', symbol: target[before.length] === '.' ? '-' : '.' }, choices, delivered);
    assert.equal(state.draft, before, 'a wrong pulse preserves the earned prefix');
    assert.equal(state.misses, 1);
    while (state.draft.length < target.length) {
      if (state.phase === 'echo') {
        assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state, 'extra player taps cannot replace a far-shore turn');
        state = relayStep(state, { type: 'echoed' }, choices, delivered);
      } else state = relayStep(state, { type: 'send', symbol: target[state.draft.length] as '.' | '-' }, choices, delivered);
    }
    assert.equal(state.phase, 'cross', 'the final pulse sends the wish automatically');
    assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
    delivered.push(wish);
    const empty = freshRelay();
    assert.equal(relayStep(empty, { type: 'choose', wish }, choices, delivered), empty);
  }
  assert.deepEqual(delivered, [5, 0, 3]);
});

void test('replay and paused listening preserve a reply without skipping the listening phase', () => {
  const choices = [0, 1, 4], delivered: number[] = [];
  let state = relayStep(freshRelay(), { type: 'choose', wish: 0 }, choices, delivered);
  state = relayStep(state, { type: 'heard' }, choices, delivered);
  assert.equal(state.draft, '');
  state = relayStep(state, { type: 'send', symbol: '.' }, choices, delivered);
  state = relayStep(state, { type: 'replay' }, choices, delivered);
  assert.equal(state.phase, 'listen');
  state = relayStep(state, { type: 'pause' }, choices, delivered);
  assert.equal(state.draft, '.');
  assert.equal(state.phase, 'listen');
  assert.equal(state.listeningPaused, true);
  assert.equal(relayStep(state, { type: 'heard' }, choices, delivered), state);
  assert.equal(relayStep(state, { type: 'send', symbol: '-' }, choices, delivered), state);
  state = relayStep(state, { type: 'pause' }, choices, delivered);
  state = relayStep(state, { type: 'heard' }, choices, delivered);
  assert.equal(state.draft, '.');
  assert.equal(state.phase, 'answer');
  const empty = freshRelay();
  assert.equal(relayStep(empty, { type: 'choose', wish: 7 }, choices, []), empty);
});

void test('replaying the shared final letter never awards pulses and returns to the same turn', () => {
  const choices = [0, 1, 4], delivered = [0, 1];
  let state = relayStep(freshRelay(), { type: 'choose', wish: 4 }, choices, delivered);
  assert.equal(state.phase, 'echo');
  assert.equal(relayStep(state, { type: 'replay' }, choices, delivered), state);
  state = relayStep(state, { type: 'echoed' }, choices, delivered);
  state = relayStep(state, { type: 'replay' }, choices, delivered);
  state = relayStep(state, { type: 'heard' }, choices, delivered);
  assert.equal(state.phase, 'answer');
  assert.equal(state.draft, '.');
  state = relayStep(state, { type: 'send', symbol: '.' }, choices, delivered);
  assert.equal(state.phase, 'echo');
  assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
});

void test('new delivery order persists, while old or corrupt optional order falls back safely', () => {
  const choices = [0, 3, 5];
  const save = { ...fresh(), choices, stage: 5, stars: 13, stone: true, rotation: 150, color: true,
    decoded: 2, echoWishes: [5, 0] };
  assert.deepEqual(readSave(JSON.stringify(save)), save);
  assert.deepEqual(deliveredWishes(choices, 2), [0, 3]);
  assert.deepEqual(deliveredWishes(choices, 2, [5, 0]), [5, 0]);
  for (const bad of [[5, 5], [7, 0], ['0', 3], [5]]) {
    const restored = readSave(JSON.stringify({ ...save, echoWishes: bad }));
    assert.equal(restored.decoded, 2);
    assert.deepEqual(deliveredWishes(restored.choices, restored.decoded, restored.echoWishes), [0, 3]);
  }
});
