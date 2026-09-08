import { readFileSync, existsSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const root = resolve('dist/pages');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
assert.ok(
  links.some((l) => l.endsWith('.js')),
  'Static entry script missing',
);
for (const link of links) {
  if (!link.startsWith('/w25-signal/')) continue;
  assert.ok(
    existsSync(resolve(root, link.slice('/w25-signal/'.length))),
    'Missing ' + link,
  );
}
assert.ok(!html.includes('/_vinext/'), 'Server entry leaked into static build');
for (const path of [
  'models/bracelet-wire.json',
  'models/bracelet-ring.glb',
  'models/bracelet-ring-manifest.json',
  'models/bracelet-ring.usdz',
  'models/bracelet.usdz',
  'model-poster.svg',
  'model-ring-preview.png',
  'images/sky-photorealistic.png',
]) {
  assert.ok(statSync(resolve(root, path)).size > 0, 'Missing asset: ' + path);
}
const model = JSON.parse(
  readFileSync(resolve(root, 'models/bracelet-wire.json'), 'utf8'),
);
assert.ok(model.objects.some((o) => o.pink && o.name.includes('four-point')));
for (const o of model.objects)
  for (const [a, b] of o.edges) {
    assert.ok(o.vertices[a] && o.vertices[b], 'Broken geometry indices');
  }
const ringManifest = JSON.parse(
  readFileSync(resolve(root, 'models/bracelet-ring-manifest.json'), 'utf8'),
);
assert.equal(ringManifest.decimated, false, 'Ring model was decimated');
assert.ok(ringManifest.evaluatedVertices >= 140000, 'Full ring geometry missing');
assert.ok(ringManifest.evaluatedPolygons >= 140000, 'Ring polygons missing');
console.log(
  'Static Pages entry, photorealistic sky, full ring geometry and USDZ verified.',
);
