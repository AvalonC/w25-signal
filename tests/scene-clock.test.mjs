import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useVisibleClock } from '../components/game/scene-clock.ts';

test('scene clock survives updates, pauses, resets on new phases, and cleans up', async () => {
  const original = { document: globalThis.document, performance: globalThis.performance,
    requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  let now = 0, next = 0, elapsed = -1;
  const frames = new Map();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.document = { hidden: false };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => now, mark: () => {}, measure: () => {}, clearMarks: () => {}, clearMeasures: () => {},
  } });
  globalThis.requestAnimationFrame = (fn) => { frames.set(++next, fn); return next; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  function Probe({active, phase}) { elapsed = useVisibleClock(active, phase); return null; }
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 40) {
      now += 40;
      const callbacks = [...frames.values()]; frames.clear();
      await act(() => { callbacks.forEach((fn) => fn(now)); });
    }
  };
  let root;
  try {
    await act(() => { root = create(React.createElement(Probe, { active: true, phase: 'gather' })); });
    await advance(1600);
    assert.equal(elapsed, 1600);
    await act(() => root.update(React.createElement(Probe, { active: true, phase: 'gather' })));
    await advance(200);
    assert.equal(elapsed, 1800, 'ordinary renders must not cancel the completion timer');
    await act(() => root.update(React.createElement(Probe, { active: false, phase: 'gather' })));
    await advance(2000);
    assert.equal(elapsed, 1800, 'help pauses the clock');
    await act(() => root.update(React.createElement(Probe, { active: true, phase: 'gather' })));
    globalThis.document.hidden = true;
    await advance(2000);
    assert.equal(elapsed, 1800, 'hidden tabs do not complete scenes');
    globalThis.document.hidden = false;
    await advance(400);
    assert.equal(elapsed, 2200);
    await act(() => root.update(React.createElement(Probe, { active: true, phase: 'reveal' })));
    assert.equal(elapsed, 0, 'new phases cannot inherit elapsed time and skip themselves');
    await advance(200);
    assert.equal(elapsed, 200);
    await act(() => root.unmount());
    assert.equal(frames.size, 0);
  } finally {
    globalThis.document = original.document;
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: original.performance });
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    globalThis.cancelAnimationFrame = original.cancelAnimationFrame;
  }
});
