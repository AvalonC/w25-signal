import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DATE_ENTRY_TIMING, dateEntryFrame, dialReveal } from '../lib/dial-reveal.ts';

void test('a stationary dial reveals its rim, marks, symbols and reading in overlapping layers', () => {
  const rim = dialReveal(.12, 12);
  assert.ok(rim.outer > 0);
  assert.ok(rim.ticks.every((light) => light === 0));
  assert.ok(rim.labels.every((light) => light === 0));
  assert.equal(rim.inner, 0);
  assert.equal(rim.pointer, 0);
  assert.equal(rim.reading, 0);

  const marks = dialReveal(.27, 12);
  assert.ok(marks.outer < 1, 'the marks follow the rim before it has finished');
  assert.equal(marks.ticks[0], 1);
  assert.equal(marks.ticks[11], 0, 'marks are engraved around the dial in order');
  assert.ok(marks.labels.every((light) => light === 0));

  const symbols = dialReveal(.52, 12);
  assert.ok(symbols.ticks.every((light) => light === 1));
  assert.equal(symbols.labels[0], 1);
  assert.equal(symbols.labels[11], 0, 'symbols arrive individually in the same order');
  assert.equal(symbols.inner, 0);
  assert.equal(symbols.reading, 0);

  const center = dialReveal(.76, 12);
  assert.ok(center.labels.every((light) => light === 1));
  assert.ok(center.inner > 0 && center.inner < 1);
  assert.ok(center.pointer > 0 && center.pointer < 1);
  assert.equal(center.reading, 0, 'the reading waits for the full calendar');
  assert.equal(center.ready, false);
});

void test('all twelve zodiac signs and all 31 dates complete without losing any labels', () => {
  for (const count of [12, 31]) {
    const start = dialReveal(0, count), end = dialReveal(1, count);
    assert.equal(start.ticks.length, count);
    assert.equal(start.labels.length, count);
    assert.deepEqual(start.ticks, Array(count).fill(0));
    assert.deepEqual(start.labels, Array(count).fill(0));
    assert.deepEqual(end.ticks, Array(count).fill(1));
    assert.deepEqual(end.labels, Array(count).fill(1));
    for (const key of ['outer', 'inner', 'pointer', 'reading'] as const) {
      assert.equal(start[key], 0);
      assert.equal(end[key], 1);
    }
    assert.equal(start.ready, false);
    assert.equal(end.ready, true);
    assert.deepEqual(dialReveal(-1, count), start);
    assert.deepEqual(dialReveal(2, count), end);
  }
});

void test('every layer advances monotonically and the reading waits for visible symbols', () => {
  for (const count of [12, 31]) {
    let previous = dialReveal(0, count);
    for (let step = 1; step <= 200; step++) {
      const current = dialReveal(step / 200, count);
      const values = [current.outer, ...current.ticks, ...current.labels, current.inner, current.pointer, current.reading];
      const before = [previous.outer, ...previous.ticks, ...previous.labels, previous.inner, previous.pointer, previous.reading];
      values.forEach((value, index) => assert.ok(value >= before[index] && value <= 1));
      if (current.reading > 0) assert.ok(current.labels.every((light) => light >= .8));
      assert.equal(current.ready, step === 200);
      previous = current;
    }
  }
});

void test('the date dial follows the zodiac dial and both settle before interaction unlocks', () => {
  assert.deepEqual(dateEntryFrame(0, false), { month: 0, day: 0, ready: false });
  assert.deepEqual(dateEntryFrame(-100, false), dateEntryFrame(0, false));
  const lead = dateEntryFrame(DATE_ENTRY_TIMING.dayDelay, false);
  assert.ok(lead.month > 0);
  assert.equal(lead.day, 0);
  const monthDone = dateEntryFrame(DATE_ENTRY_TIMING.dialDuration, false);
  assert.equal(monthDone.month, 1);
  assert.ok(monthDone.day > 0 && monthDone.day < 1);
  assert.equal(monthDone.ready, false);
  const dayDone = DATE_ENTRY_TIMING.dialDuration + DATE_ENTRY_TIMING.dayDelay;
  assert.ok(dayDone < DATE_ENTRY_TIMING.duration, 'a settled calendar precedes the interactive state');
  assert.deepEqual(dateEntryFrame(dayDone, false), { month: 1, day: 1, ready: false });
  assert.equal(dateEntryFrame(DATE_ENTRY_TIMING.duration - 1, false).ready, false);
  assert.deepEqual(dateEntryFrame(DATE_ENTRY_TIMING.duration, false), { month: 1, day: 1, ready: true });
});

void test('reduced motion shows both dials together and revisits retain the completed calendar', () => {
  for (const elapsed of [0, 125, 250, 499, 500, 600]) {
    const frame = dateEntryFrame(elapsed, true);
    assert.equal(frame.month, frame.day);
    assert.equal(frame.ready, elapsed >= DATE_ENTRY_TIMING.reduced);
  }
  assert.deepEqual(dateEntryFrame(500, true), { month: 1, day: 1, ready: true });
  assert.deepEqual(dateEntryFrame(0, false, true), { month: 1, day: 1, ready: true });
  assert.deepEqual(dateEntryFrame(0, true, true), { month: 1, day: 1, ready: true });
});
