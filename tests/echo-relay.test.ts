import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshRelay, relayStep, wishLight, deliveredWishes } from '../lib/echo-relay.ts';
import { MORSE_CODES, fresh, readSave } from '../lib/journey.ts';
import { RELAY_SHORES, RELAY_WISHES, RELAY_ENTRY_START, RELAY_ENTRY_TIMING, RELAY_MARKS, relayArrival, relayCurve } from '../lib/relay-motion.ts';

void test('entry and completed routes use the same world coordinates without decoding the pulses', () => {
  const opening = relayArrival(0);
  assert.deepEqual(opening.main, RELAY_ENTRY_START);
  assert.notDeepEqual(RELAY_ENTRY_START, RELAY_SHORES[0]);
  assert.notDeepEqual(RELAY_ENTRY_START, RELAY_SHORES[1], 'the star enters from its own sky position, not the far shore');
  assert.notDeepEqual(relayArrival(900).main, opening.main, 'the star travels toward the player-side dock');
  const dock = relayArrival(RELAY_ENTRY_TIMING.dock);
  assert.deepEqual(dock.main, RELAY_SHORES[0]);
  assert.equal(dock.ready, false, 'docking is not the start of the playable round');
  assert.equal(dock.horizon, 0, 'the onward route does not appear before docking');
  assert.equal(dock.interfaceLight, 0, 'the Morse console waits for the stars');
  assert.notDeepEqual(dock.companions, RELAY_WISHES);
  assert.equal(relayArrival(RELAY_ENTRY_TIMING.ready - 1).ready, false);
  const arrival = relayArrival(RELAY_ENTRY_TIMING.ready);
  assert.deepEqual(arrival.main, RELAY_SHORES[0]);
  assert.deepEqual(arrival.companions, RELAY_WISHES);
  assert.equal(arrival.horizon, 1);
  assert.equal(arrival.interfaceLight, 1);
  assert.deepEqual(arrival.companionLabels, [1, 1, 1]);
  assert.equal(arrival.trail, 0);
  for (let i=0; i<3; i++) {
    assert.deepEqual(relayCurve(i, 0), RELAY_SHORES[i]);
    assert.deepEqual(relayCurve(i, 1), RELAY_SHORES[i+1]);
  }
  assert.equal(RELAY_MARKS.length, 13);
  assert.equal(relayArrival(400,true).ready, true);
});

void test('arrival stays in the foreground and stops before the stars and interface unfold', () => {
  let previous = RELAY_ENTRY_START;
  for (let ms = 0; ms <= RELAY_ENTRY_TIMING.dock; ms += 40) {
    const frame = relayArrival(ms);
    assert.ok(frame.main[0] >= previous[0] && frame.main[1] <= previous[1], 'entry never reverses its direction');
    assert.ok(frame.main[0] <= RELAY_SHORES[0][0] && frame.main[1] >= RELAY_SHORES[0][1], 'entry stays on the near side of every route');
    for (const shore of RELAY_SHORES.slice(1)) assert.ok(Math.hypot(frame.main[0]-shore[0], frame.main[1]-shore[1]) > 90, 'entry never crosses a future station');
    assert.equal(frame.horizon, 0);
    assert.equal(frame.interfaceLight, 0);
    previous = frame.main;
  }
  const early = relayArrival(1750);
  const offsets = [[18,-12], [27,4], [12,19]];
  assert.notDeepEqual(early.companions[0], RELAY_SHORES[0].map((value, axis) => value+offsets[0][axis]));
  assert.deepEqual(early.companions[2], RELAY_SHORES[0].map((value, axis) => value+offsets[2][axis]), 'companions fan out in sequence, not all at once');
  for (const ms of [1900, 2300, 2800]) {
    assert.deepEqual(relayArrival(ms).main, RELAY_SHORES[0], 'the star stays docked while the scene unfolds');
    assert.equal(relayArrival(ms).ready, false);
  }
  assert.ok(relayArrival(2300).horizon > 0);
  assert.equal(relayArrival(2300).interfaceLight, 0, 'show the next destination before the console');
  assert.ok(relayArrival(2800).interfaceLight > 0);
  for (const ms of [0, 120, 399, 400]) {
    const reduced = relayArrival(ms, true);
    assert.deepEqual(reduced.main, RELAY_SHORES[0], 'reduced motion has no flight');
    assert.deepEqual(reduced.companions, RELAY_WISHES, 'reduced motion has no companion flight');
    assert.equal(reduced.trail, 0);
    assert.equal(reduced.ready, ms >= RELAY_ENTRY_TIMING.reduced);
  }
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

void test('a saved final Morse crossing resumes before the next chapter without replaying its answers', () => {
  const saved = { ...fresh(), choices:[0,3,5], stage:5, color:true, stars:13, stone:true, rotation:150, decoded:3, echoWishes:[5,0,3] };
  const resumed = readSave(JSON.stringify(saved));
  assert.equal(resumed.stage, 5);
  assert.equal(resumed.decoded, 3);
  assert.deepEqual(deliveredWishes(resumed.choices,resumed.decoded,resumed.echoWishes),[5,0,3]);
  assert.equal(readSave(JSON.stringify({...resumed,stage:6,pathClosed:false})).stage,6);
});
