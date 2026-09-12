import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Children, isValidElement } from 'react';
import { braceletPhase, projectPoint, scatteredPoint, type CameraView } from '../lib/bracelet-transition.ts';
import { QuickLookLink } from '../components/game/quick-look-link.ts';
import { BRACELET_ASSETS, MODEL_REVISION } from '../lib/model-assets.ts';

test('Quick Look is a native image-only anchor; label cannot intercept the click', () => {
  let opened = 0;
  const entry = QuickLookLink({ onOpen: () => { opened++; } });
  const [link, label] = Children.toArray((entry.props as typeof entry.props & { children: import('react').ReactNode }).children);
  assert.ok(isValidElement<{rel: string; href: string; 'aria-label': string; children: unknown; onClick: () => void}>(link));
  assert.equal(link.type, 'a'); assert.equal(link.props.rel, 'ar');
  assert.equal(link.props.href, BRACELET_ASSETS.ar);
  assert.ok(isValidElement<{src: string; width: number}>(link.props.children));
  assert.equal(link.props.children.type, 'img', 'No span/text siblings inside a Quick Look anchor');
  assert.ok(isValidElement<{children: string}>(label)); assert.equal(label.type, 'span');
  link.props.onClick(); assert.equal(opened, 1);
  assert.match(link.props['aria-label'], /Apple AR Quick Look/);
  assert.equal(link.props.children.props.width, 56);
  assert.equal(link.props.children.props.src, 'images/ar-quick-look-surface.svg');
  for (const href of Object.values(BRACELET_ASSETS)) {
    assert.equal(new URL(href, 'https://example.com/w25-signal/').searchParams.get('v'), MODEL_REVISION);
  }
  assert.equal(label.props.children, '在现实中看一看');
  const metadata = JSON.parse(readFileSync(new URL('../public/models/jewelry-metadata.json', import.meta.url), 'utf8'));
  assert.equal(MODEL_REVISION, metadata.revision, 'All displayed assets must use the exported model revision');
});

test('solid fades into a held star silhouette before any scattering or chapter change', () => {
  assert.equal(braceletPhase(0).solid, 1);
  assert.equal(braceletPhase(0).stars, 0);
  assert.ok(braceletPhase(900).solid > 0 && braceletPhase(900).stars > 0);
  for (const ms of [1700, 2200, 2800]) {
    assert.equal(braceletPhase(ms).solid, 0);
    assert.equal(braceletPhase(ms).stars, 1);
    assert.equal(braceletPhase(ms).spread, 0);
    assert.equal(braceletPhase(ms).done, false);
  }
  assert.ok(braceletPhase(4200).spread > 0);
  assert.equal(braceletPhase(5799).done, false);
  assert.equal(braceletPhase(5800).done, true);
  assert.equal(braceletPhase(1800, true).done, true);
  assert.equal(braceletPhase(1800, true).spread, 0, 'Reduced motion does not scatter');
});

test('camera projection keeps silhouette aligned at rotated poses and mobile aspect ratios', () => {
  const view: CameraView = { theta:0, phi:Math.PI/2, radius:1, target:[0,0,0], fov:90, left:20, top:120, width:300, height:400 };
  const center = projectPoint([0,0,0], view);
  assert.deepEqual(center, {x:170,y:320});
  assert.equal(projectPoint([.1,0,0], view).x, 190);
  assert.equal(projectPoint([0,.1,0], view).y, 300);
  const rotated = {...view, theta:Math.PI/2};
  assert.ok(Math.abs(projectPoint([0,0,-.1], rotated).x - 190) < .00001);
  const landscape = {...view, width:700, height:300};
  assert.equal(projectPoint([0,0,0], landscape).x, 370);
  assert.deepEqual(scatteredPoint(center, 12, 0, 390, 844), center);
  const end = scatteredPoint(center, 12, 1, 390, 844);
  assert.ok(end.x >= 0 && end.x <= 390 && end.y >= 0 && end.y <= 844);
});
