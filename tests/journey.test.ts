import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fresh,
  readSave,
  restart,
  finish,
  validChoices,
  MORSE_CODES,
  morseTimeline,
  prefixOK,
  symbolFromHold,
} from '../lib/journey.ts';

test('three distinct wishes; unsupported values and duplicates rejected', () => {
  assert.ok(validChoices([0, 3, 7]));
  for (const v of [[0, 0, 1], [0, 1, 2, 3], [-1], [8], ['1'], null])
    assert.equal(validChoices(v), false);
});
test('seven chapters survive reload and a completed visit can replay the original wishes', () => {
  let s = restart(fresh(), false);
  s = { ...s, choices: [1, 4, 7], stage: 2 };
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  s = { ...s, color: true, stage: 3 };
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  s = {
    ...s,
    stars: 13,
    stage: 4,
    month: 10,
    day: 9,
    stone: true,
    rotation: 120,
  };
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  s = { ...s, stage: 5, decoded: 3 };
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  s = { ...s, stage: 6 };
  s = finish(s);
  assert.equal(s.stage, 7);
  assert.equal(s.completed, true);
  assert.deepEqual(readSave(JSON.stringify(s)), s);
  const replay = restart(s, true);
  assert.deepEqual(replay.choices, [1, 4, 7]);
  assert.equal(replay.replay, true);
  assert.equal(replay.stars, 0);
  assert.equal(replay.stone, false);
  assert.equal(replay.decoded, 0);
  const again = restart(s, false);
  assert.deepEqual(again.choices, []);
  assert.deepEqual(again.history, [1, 4, 7]);
  assert.notEqual(replay.choices, s.history);
  assert.notEqual(again.history, s.history);
});
test('corrupted or prematurely advanced saves safely restart', () => {
  for (const raw of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...fresh(), stage: 7 }),
    JSON.stringify({ ...fresh(), completed: true }),
    JSON.stringify({ ...fresh(), day: 32 }),
    JSON.stringify({ ...fresh(), rotation: -1 }),
  ])
    assert.deepEqual(readSave(raw), fresh());
});
test('old completed four-wish journeys retain the first three choices', () => {
  const s = readSave(
    null,
    JSON.stringify({ delivery: 'complete', wishes: [2, 4, 5, 7] }),
  );
  assert.equal(s.completed, true);
  assert.deepEqual(s.history, [2, 4, 5]);
  assert.equal(s.stage, 0);
  assert.equal(
    readSave(
      null,
      JSON.stringify({ delivery: 'waiting', wishes: [2, 4, 5, 7] }),
    ).completed,
    false,
  );
});
test('Morse holds use the exact one-second boundary and incorrect answers cannot advance', () => {
  assert.equal(symbolFromHold(999), '.');
  assert.equal(symbolFromHold(1000), '-');
  assert.deepEqual(MORSE_CODES, ['.--', '..---', '.....']);
  assert.ok(prefixOK('.-', '.--'));
  assert.ok(!prefixOK('..', '.--'));
  assert.ok(!prefixOK('.---', '.--'));
});
test('light timelines preserve 1:3 duration, inter-symbol and letter spacing', () => {
  const t = morseTimeline('.- .', 100);
  assert.deepEqual(
    t.frames.map((f) => [f.start, f.end]),
    [
      [0, 100],
      [200, 500],
      [800, 900],
    ],
  );
  const full = morseTimeline(MORSE_CODES.join(' '), 110);
  assert.equal(full.frames.length, 13);
  assert.equal(full.duration, 4400);
});
