import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshRelay, relayStep, wishLight, deliveredWishes } from '../lib/echo-relay.ts';
import { MORSE_CODES, fresh, readSave } from '../lib/journey.ts';

void test('wish effects combine; delivery order changes the help on the first crossing', () => {
  assert.deepEqual(wishLight([0, 3, 5]), { lead: 1, unit: 433, glimpse: true });
  assert.equal(wishLight([3, 6]).unit, 533);
  assert.equal(wishLight([0]).lead, 1);
  assert.equal(wishLight([3]).lead, 0);
});

void test('three wishes cross in the chosen order without confirmation or duplicate delivery', () => {
  const choices = [0, 3, 5], delivered: number[] = [];
  for (const wish of [5, 0, 3]) {
    let state = relayStep(freshRelay(), { type: 'choose', wish }, choices, delivered);
    assert.equal(state.phase, 'listen');
    assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
    state = relayStep(state, { type: 'heard' }, choices, delivered);
    const target = MORSE_CODES[delivered.length];
    assert.ok(state.draft.length < target.length);
    const before = state.draft;
    state = relayStep(state, { type: 'send', symbol: target[before.length] === '.' ? '-' : '.' }, choices, delivered);
    assert.equal(state.draft, before, 'a wrong pulse preserves the earned prefix');
    assert.equal(state.misses, 1);
    for (const symbol of target.slice(before.length))
      state = relayStep(state, { type: 'send', symbol: symbol as '.' | '-' }, choices, delivered);
    assert.equal(state.phase, 'cross', 'the final correct pulse sends the wish automatically');
    assert.equal(relayStep(state, { type: 'send', symbol: '.' }, choices, delivered), state);
    delivered.push(wish);
    const empty = freshRelay();
    assert.equal(relayStep(empty, { type: 'choose', wish }, choices, delivered), empty);
  }
  assert.deepEqual(delivered, [5, 0, 3]);
});

void test('replay and interrupted listening preserve the reply, and wishes cannot solve the whole crossing', () => {
  const choices = [0, 1, 4], delivered = [0, 1];
  let state = relayStep(freshRelay(), { type: 'choose', wish: 4 }, choices, delivered);
  state = relayStep(state, { type: 'heard' }, choices, delivered);
  assert.equal(state.draft, '...');
  state = relayStep(state, { type: 'replay' }, choices, delivered);
  assert.equal(state.phase, 'listen');
  state = relayStep(state, { type: 'pause' }, choices, delivered);
  assert.equal(state.draft, '...');
  assert.equal(state.phase, 'answer');
  const empty = freshRelay();
  assert.equal(relayStep(empty, { type: 'choose', wish: 7 }, choices, []), empty);
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
