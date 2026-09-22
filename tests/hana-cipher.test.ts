import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANA_KEY, CIPHER_TITLE, CIPHER_CARRIER, CIPHER_MORSE, DOT_GLYPHS, glyphDots, cipherMarks, decodeMarks } from '../lib/hana-cipher.ts';

void test('the original HANA pink-dot positions stay fixed across the fourteen title characters', () => {
  assert.deepEqual(HANA_KEY, [8, 1, 14, 1]);
  assert.equal(CIPHER_TITLE, 'Project N7A-3914');
  assert.equal(CIPHER_CARRIER, 'ProjectN7A3914');
  const marks = cipherMarks();
  assert.equal(marks.length, 14);
  assert.deepEqual(marks.map((mark) => mark.index + 1), [8, 2, 3, 1, 8, 2, 3, 2, 8, 1, 14, 1, 8, 3]);
  assert.equal(marks.map((mark) => mark.char).join(''), CIPHER_CARRIER);
  for (const [i, mark] of marks.entries()) {
    assert.equal(mark.key, HANA_KEY[i % 4]);
    assert.ok(Number.isInteger(mark.index) && mark.index >= 0 && mark.index < mark.dots.length);
    assert.ok(mark.dots[mark.index], 'every encoded character has exactly one valid pink-dot position');
  }
});

void test('row-major glyph scanning wraps keys and discards only the final 4 decoy', () => {
  for (const char of CIPHER_CARRIER) {
    const expected: { x: number; y: number }[] = [];
    DOT_GLYPHS[char].forEach((row, y) => Array.from(row).forEach((value, x) => {
      if (value === '1') expected.push({ x, y });
    }));
    assert.deepEqual(glyphDots(char), expected);
  }
  assert.deepEqual(glyphDots('?'), []);
  const marks = cipherMarks(), decoy = marks.at(-1)!;
  assert.equal(decoy.char, '4'); assert.equal(decoy.symbol, null);
  assert.equal(decoy.index + 1, 3);
  assert.equal(decodeMarks([decoy]), '', 'the final 4 is a distraction, not a fourteenth Morse signal');
  assert.equal(CIPHER_MORSE, '.--..---.....');
  assert.equal(decodeMarks(), '.--..---.....');
  assert.deepEqual([decodeMarks(marks.slice(0, 3)), decodeMarks(marks.slice(3, 8)), decodeMarks(marks.slice(8, 13))], ['.--', '..---', '.....']);
  assert.equal(marks[2].dots.length, 12);
  assert.equal(marks[2].key, 14);
  assert.equal(marks[2].index, 2, 'a key larger than the glyph wraps before its dash offset');
});
