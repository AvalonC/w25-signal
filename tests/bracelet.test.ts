import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Children, isValidElement } from 'react';
import { braceletPhase, clickOrigin, projectPoint, scatteredPoint, type CameraView } from '../lib/bracelet-transition.ts';
import { QuickLookLink } from '../components/game/quick-look-link.ts';
import { BRACELET_ASSETS, MODEL_REVISION } from '../lib/model-assets.ts';

void test('Quick Look is a native image-only anchor; label cannot intercept the click', () => {
  let opened = 0;
  const entry = QuickLookLink({ onOpen: () => { opened++; } });
  const [link, label] = Children.toArray((entry.props as typeof entry.props & { children: import('react').ReactNode }).children);
  assert.ok(isValidElement<{rel: string; href: string; 'aria-label': string; children: unknown; onClick: () => void}>(link));
  assert.equal(link.type, 'a'); assert.equal(link.props.rel, 'ar');
  assert.equal(link.props.href, BRACELET_ASSETS.ar);
  assert.ok(isValidElement<{src: string; width: number; height: number}>(link.props.children));
  assert.equal(link.props.children.type, 'img', 'No span/text siblings inside a Quick Look anchor');
  assert.ok(isValidElement<{children: string}>(label)); assert.equal(label.type, 'span');
  link.props.onClick(); assert.equal(opened, 1);
  assert.match(link.props['aria-label'], /Apple AR Quick Look/);
  assert.equal(link.props.children.props.width, 64);
  assert.equal(link.props.children.props.height, 64);
  assert.equal(link.props.children.props.src, 'images/ar-native-transparent.png');
  for (const href of Object.values(BRACELET_ASSETS)) {
    assert.equal(new URL(href, 'https://example.com/w25-signal/').searchParams.get('v'), MODEL_REVISION);
  }
  assert.equal(label.props.children, '在现实中看一看');
  const metadata = JSON.parse(readFileSync(new URL('../public/models/jewelry-metadata.json', import.meta.url), 'utf8'));
  assert.equal(MODEL_REVISION, metadata.revision, 'All displayed assets must use the exported model revision');
});

void test('compact layouts keep Safari native AR badge above its 51px rendering threshold', () => {
  // WebKit ARKitBadgeSystemImage: smallDimension=35, smallOffset=8.
  // A 50px image is a valid tap target, but WebKit intentionally paints no badge.
  const minimumBadgeBox = 35 + 2 * 8;
  const styles = ['../app/bracelet.css', '../app/immersive.css'].map((file) =>
    readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
  const declarations = (selector: string) => {
    const result: Record<string, string> = {};
    for (const css of styles) {
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
        if (!rule[1].split(',').map((part) => part.trim()).includes(selector)) continue;
        for (const declaration of rule[2].split(';')) {
          const [name, value] = declaration.split(':').map((part) => part.trim());
          if (name && value) result[name] = value;
        }
      }
    }
    return result;
  };
  const image = declarations('.bracelet-ar-link img');
  const compactImage = {...image, ...declarations('.immersive-journey .bracelet-ar-link img')};
  for (const layout of [image, compactImage]) {
    for (const dimension of ['width', 'height', 'min-width', 'min-height']) {
      assert.ok(Number.parseFloat(layout[dimension]) >= minimumBadgeBox, dimension + ' must allow the native AR badge');
    }
  }
  const compactEntry = {...declarations('.bracelet-ar-entry'), ...declarations('.immersive-journey .bracelet-ar-entry')};
  assert.ok(Number.parseFloat(compactEntry['grid-template-columns']) >= Number.parseFloat(compactImage.width),
    'Reserve the image column so the label cannot cover the badge');
  assert.equal(declarations('.bracelet-ar-label')['pointer-events'], 'none', 'The full row forwards taps to the native anchor');
});

void test('native AR image has no opaque pixels covering the system badge', () => {
  const png = readFileSync(new URL('../public/images/ar-native-transparent.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 64);
  assert.equal(png.readUInt32BE(20), 64);
  assert.equal(png[24], 8); assert.equal(png[25], 6, 'RGBA image');
  const chunks: Buffer[] = [];
  for (let i = 8; i < png.length;) {
    const size = png.readUInt32BE(i);
    if (png.toString('ascii', i + 4, i + 8) === 'IDAT') chunks.push(png.subarray(i + 8, i + 8 + size));
    i += size + 12;
  }
  const pixels = inflateSync(Buffer.concat(chunks));
  assert.equal(pixels.length, 64 * (64 * 4 + 1));
  assert.ok(pixels.every((byte) => byte === 0), 'Unfiltered RGBA pixels must all be transparent');
});

void test('solid fades into a held star silhouette before any scattering or chapter change', () => {
  assert.equal(braceletPhase(0).solid, 1);
  assert.equal(braceletPhase(0).stars, 0);
  assert.ok(braceletPhase(900).solid > 0 && braceletPhase(900).stars > 0);
  for (const ms of [1100, 1200, 1350]) {
    assert.equal(braceletPhase(ms).solid, 0);
    assert.equal(braceletPhase(ms).stars, 1);
    assert.equal(braceletPhase(ms).spread, 0);
    assert.equal(braceletPhase(ms).done, false);
  }
  assert.ok(braceletPhase(2400).spread > 0);
  assert.equal(braceletPhase(3599).done, false);
  assert.equal(braceletPhase(3600).done, true);
  assert.equal(braceletPhase(1000, true).done, true);
  assert.equal(braceletPhase(1000, true).spread, 0, 'Reduced motion does not scatter');
});

void test('camera projection keeps silhouette aligned at rotated poses and mobile aspect ratios', () => {
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


void test('the farewell begins at the actual touch point, while keyboard activation uses its button center',()=>{
  const gem={left:250,top:210,width:48,height:48},button={left:60,top:570,width:280,height:44};
  assert.deepEqual(clickOrigin({detail:1,clientX:265,clientY:240},gem,400,800),{x:.6625,y:.3});
  assert.deepEqual(clickOrigin({detail:1,clientX:140,clientY:590},button,400,800),{x:.35,y:.7375});
  assert.deepEqual(clickOrigin({detail:0,clientX:0,clientY:0},button,400,800),{x:.5,y:.74});
  assert.deepEqual(clickOrigin({detail:1,clientX:0,clientY:0},gem,400,800),{x:0,y:0},'a real touch at zero is not mistaken for a keyboard click');
  assert.deepEqual(clickOrigin({detail:1,clientX:900,clientY:-50},gem,400,800),{x:1,y:0});
});
