import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshPath, readPath, visitPath, completePrismPath, completeDatePath, infusePath,
} from '../lib/star-path.ts';
import { fresh, readSave, restart } from '../lib/journey.ts';

test('both exploration orders retain discoveries and meet at the same sapphire', () => {
  for (const order of [['prism', 'date'], ['date', 'prism']] as const) {
    let path = freshPath();
    for (const place of order) {
      path = visitPath(path, place);
      path = place === 'prism' ? completePrismPath(path) : completeDatePath(path);
      assert.equal(path.place, place, 'a discovery must not push the player out of its scene');
      path = visitPath(path, 'sky');
    }
    assert.deepEqual(path, { place: 'sky', color: true, dateFound: true, infused: false, anchor: order[1] });
    path = visitPath(path, 'sapphire');
    assert.equal(path.infused, false, 'visiting the stone is not yet carrying light into it');
    assert.deepEqual(infusePath(path), { place: 'sapphire', color: true, dateFound: true, infused: true, anchor: order[1] });
  }
});

test('return anchors survive storage without changing old saves or granting discoveries', () => {
  const left = visitPath(completePrismPath(visitPath(freshPath(),'prism')),'sky');
  const right = visitPath(completeDatePath(visitPath(left,'date')),'sky');
  assert.equal(readPath(JSON.parse(JSON.stringify(left))).anchor,'prism');
  assert.equal(readPath(JSON.parse(JSON.stringify(right))).anchor,'date');
  assert.equal(readPath({...freshPath(),anchor:'elsewhere'}).anchor,undefined);
  assert.equal(readPath({...freshPath(),anchor:'sapphire'}).color,false);
  assert.deepEqual(readPath(freshPath()),freshPath());
});

test('sapphire and light entry cannot skip either discovery', () => {
  for (const path of [
    freshPath(),
    completePrismPath(visitPath(freshPath(), 'prism')),
    completeDatePath(visitPath(freshPath(), 'date')),
  ]) {
    assert.equal(visitPath(path, 'sapphire').place, path.place);
    assert.equal(infusePath(path).infused, false);
    assert.equal(readPath({ ...path, place: 'sapphire', infused: true }).place, 'sky');
    assert.equal(readPath({ ...path, place: 'sapphire', infused: true }).infused, false);
  }
  assert.deepEqual(completePrismPath(freshPath()), freshPath());
  assert.deepEqual(completeDatePath(freshPath()), freshPath());
  assert.equal(infusePath({ ...freshPath(), color: true, dateFound: true }).infused, false);
});

test('malformed path values do not invent discoveries or borrow legacy progress', () => {
  const legacy = { color: true, stone: true, month: 10, day: 8, rotation: 120 };
  for (const value of [null, [], 'sapphire', 1, {}, { place: 'elsewhere' },
    { place: 'sapphire', color: 'true', dateFound: 1, infused: true }]) {
    assert.deepEqual(readPath(value, legacy), freshPath());
  }
  assert.equal(readPath(undefined, { ...legacy, day: 9 }).dateFound, false);
  assert.equal(readPath(undefined, { ...legacy, rotation: Infinity }).infused, false);
});

test('refresh preserves the active exploration and synchronizes completed discoveries', () => {
  let path = completeDatePath(visitPath(freshPath(), 'date'));
  const dateVisit = { ...fresh(), stage: 2, choices: [0, 3, 7], path, month: 10, day: 8 };
  assert.deepEqual(readSave(JSON.stringify(dateVisit)), dateVisit);
  path = completePrismPath(visitPath(path, 'prism'));
  const beforeGem = readSave(JSON.stringify({ ...dateVisit, path, color: false, month: 1, day: 1 }));
  assert.equal(beforeGem.stage, 2);
  assert.equal(beforeGem.color, true);
  assert.equal(beforeGem.month, 10);
  assert.equal(beforeGem.day, 8);
  path = infusePath(visitPath(path, 'sapphire'));
  const turning = { ...beforeGem, path, rotation: 73 };
  assert.deepEqual(readSave(JSON.stringify(turning)), turning);
});

test('legacy chapters migrate without losing a discovered colour or a partly turned stone', () => {
  const old = { ...fresh(), path: undefined, choices: [0, 3, 7] };
  const prism = readSave(JSON.stringify({ ...old, stage: 2 }));
  assert.deepEqual(prism.path, freshPath());
  const stars = readSave(JSON.stringify({ ...old, stage: 3, color: true, stars: 4 }));
  assert.equal(stars.stage, 2);
  assert.deepEqual(stars.path, { ...freshPath(), color: true });
  const date = readSave(JSON.stringify({ ...old, stage: 4, color: true, stars: 13, month: 10, day: 7 }));
  assert.equal(date.path?.place, 'date');
  assert.equal(date.path?.dateFound, false);
  assert.equal(date.day, 7, 'unfinished dial positions survive');
  const stone = readSave(JSON.stringify({ ...old, stage: 4, color: true, stars: 13,
    month: 10, day: 8, stone: true, rotation: 73 }));
  assert.equal(stone.stage, 2);
  assert.equal(stone.rotation, 73);
  assert.deepEqual(stone.path, { place: 'sapphire', color: true, dateFound: true, infused: true });
});

test('new exploration cannot bypass legacy late-chapter gates and completed chapters stay intact', () => {
  const path = { place: 'sapphire', color: true, dateFound: true, infused: true } as const;
  const late = { ...fresh(), stage: 5, choices: [0, 3, 7], color: true, stars: 13,
    month: 10, day: 8, stone: true, rotation: 150, path };
  assert.deepEqual(readSave(JSON.stringify(late)), late);
  assert.deepEqual(readSave(JSON.stringify({ ...late, stone: false })), fresh());
  assert.deepEqual(readSave(JSON.stringify({ ...late, rotation: 0 })), fresh());
  assert.deepEqual(readSave(JSON.stringify({ ...late, stage: 6, decoded: 0 })), fresh());
});

test('fresh visits and both replay modes clear discoveries without sharing mutable path objects', () => {
  const original = { ...fresh(), completed: true, history: [0, 3, 7],
    path: { place: 'sapphire', color: true, dateFound: true, infused: true } as const };
  for (const replay of [false, true]) {
    const next = restart(original, replay);
    assert.deepEqual(next.path, freshPath());
    assert.notEqual(next.path, original.path);
  }
  const a = fresh();
  const b = fresh();
  assert.notEqual(a.path, b.path);
  assert.deepEqual(readSave(JSON.stringify(original)).path, freshPath());
});
