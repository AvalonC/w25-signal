import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLESSING_ASCENT, BLESSING_CENTER, BLESSING_REST, blessingDuration, blessingFrame, blessingLines } from '../lib/blessing-ascent.ts';

void test('final blessing keeps chosen wish order and deliberately omits curiosity', () => {
  assert.deepEqual(blessingLines([5, 4, 0]), ['HBD, Leah', '愿你被温柔地爱着，也自由地去爱。', '愿你向前时，心里有光。', '愿你珍爱的，都能陪你走过新的岁月。']);
  assert.doesNotMatch(blessingLines([5, 4, 0]).join(''), /HANA|W25|想问的事|想去的地方/);
});

void test('main star begins at the clicked gem, focuses centrally, rises and rests with all verses', () => {
  const origin = { x: .71, y: .63 }, count = 5;
  assert.deepEqual(blessingFrame(0, count, origin).point, origin);
  const focused = blessingFrame(BLESSING_ASCENT.focus, count, origin);
  assert.deepEqual(focused.point, BLESSING_CENTER);
  assert.equal(focused.lines.some(Boolean), false);
  const begin = BLESSING_ASCENT.focus;
  assert.equal(blessingFrame(begin, count, origin).point.y, .52);
  assert.equal(blessingFrame(begin, count, origin).verseTop, .64);
  assert.equal(blessingFrame(begin, count, origin).lines.some(Boolean), false);
  const halfway = blessingFrame(begin + (blessingDuration(count) - BLESSING_ASCENT.settle - begin) / 2, count, origin);
  assert.equal(halfway.point.y, .35, 'half of the sustained ascent happens while verses are being revealed');
  assert.equal(halfway.verseTop, .475);
  assert.ok(halfway.lines.some((v) => v === 1) && halfway.lines.some((v) => v === 0));
  let previous = .52;
  for (let elapsed = begin; elapsed <= blessingDuration(count); elapsed += 25) {
    const frame = blessingFrame(elapsed, count, origin);
    assert.ok(frame.point.y <= previous, 'ascent never moves down through the text');
    assert.equal(frame.point.x, .5);
    assert.ok(frame.verseTop - frame.point.y >= .119, 'the growing letter always stays beneath its rising star');
    previous = frame.point.y;
  }
  for (let line = 0; line < count; line++) {
    const at = begin + BLESSING_ASCENT.line * line;
    assert.equal(blessingFrame(at, count).lines[line], 0);
    assert.equal(blessingFrame(at + BLESSING_ASCENT.reveal, count).lines[line], 1);
    if (line < count - 1) assert.equal(blessingFrame(at + BLESSING_ASCENT.line - 1, count).lines[line + 1], 0);
  }
  const fullyShown=blessingFrame(blessingDuration(count)-BLESSING_ASCENT.settle,count);
  assert.deepEqual(fullyShown.point,BLESSING_REST,'the star stops as soon as the last blessing is fully visible');
  assert.equal(fullyShown.ready,false,'the long-press invitation waits for a quiet settled moment');
  const almost = blessingFrame(blessingDuration(count) - 1, count);
  assert.deepEqual(almost.point,fullyShown.point);
  assert.equal(almost.ready, false);
  assert.equal(almost.phase, 'settling');
  assert.ok(almost.lines.every((v) => v === 1), 'the full last verse remains readable before exit unlocks');
  const ready = blessingFrame(blessingDuration(count), count);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.point, BLESSING_REST);
  assert.deepEqual(blessingFrame(blessingDuration(count) + 60000, count), ready, 'star and verses remain exactly still after settling');
});

void test('reduced motion keeps readable staggered verses without long travel', () => {
  const count = 4, duration = blessingDuration(count, true);
  for (const elapsed of [0, 160, 600, 1900, duration, duration + 60000]) {
    const frame = blessingFrame(elapsed, count, { x: .9, y: .7 }, true);
    assert.deepEqual(frame.point, BLESSING_REST);
    assert.equal(frame.trail, 0);
    assert.equal(frame.verseTop, .31);
  }
  assert.ok(duration >= (count - 1) * 1800);
  assert.equal(blessingFrame(duration - 1, count, null, true).ready, false);
  assert.equal(blessingFrame(duration, count, null, true).ready, true);
});

void test('absent or malformed click coordinates fall back safely within the viewport', () => {
  assert.deepEqual(blessingFrame(0, 3).point, BLESSING_CENTER);
  assert.deepEqual(blessingFrame(0, 3, { x: Infinity, y: NaN }).point, BLESSING_CENTER);
  assert.deepEqual(blessingFrame(0, 3, { x: -3, y: 2 }).point, { x: 0, y: 1 });
});
