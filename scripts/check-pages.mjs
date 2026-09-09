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
  'models/sapphire-star.glb',
  'models/jewelry-metadata.json',
  'sapphire-preview.png',
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
// Inspect exported geometry, not just the declared manifest. glTF triangulation
// may split vertices at material/normal seams; compare actual triangle counts.
function inspectGLB(name, expectedMeshes, expectedTriangles, maxSpan) {
  const bytes = readFileSync(resolve(root, 'models', name + '.glb'));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.meshes.length, expectedMeshes, name + ': mesh count changed');
  const primitives = gltf.meshes.flatMap((m) => m.primitives);
  const triangles = primitives.reduce((sum, p) => {
    assert.equal(p.mode ?? 4, 4);
    const count = gltf.accessors[p.indices].count;
    assert.equal(count % 3, 0);
    return sum + count / 3;
  }, 0);
  assert.equal(triangles, expectedTriangles, name + ': geometry changed');
  const positions = primitives.map((p) => gltf.accessors[p.attributes.POSITION]);
  const span = Math.max(...[0, 1, 2].map((i) =>
    Math.max(...positions.map((p) => p.max[i])) - Math.min(...positions.map((p) => p.min[i]))));
  assert.ok(span > maxSpan / 2 && span < maxSpan, name + ': meter scale is incorrect');
  return gltf;
}
const ring = inspectGLB('bracelet-ring', 288, 282192, 0.1);
inspectGLB('sapphire-star', 10, 7162, 0.01);
const metadata = JSON.parse(readFileSync(resolve(root, 'models/jewelry-metadata.json'), 'utf8'));
assert.equal(metadata.decimated, false);
assert.equal(metadata.units, 'meters');
assert.equal(metadata.vertices, ringManifest.evaluatedVertices);
assert.equal(metadata.polygons, ringManifest.evaluatedPolygons);
assert.equal(metadata.triangles, 282192);
const gem = ring.nodes.find((n) => n.name?.includes('four-point') && n.name.includes('brilliant'));
assert.ok(gem, 'Original central sapphire missing');
const gemPositions = ring.meshes[gem.mesh].primitives.map((p) => ring.accessors[p.attributes.POSITION]);
for (let i = 0; i < 3; i++) {
  assert.ok(metadata.hotspot[i] >= Math.min(...gemPositions.map((p) => p.min[i])) &&
    metadata.hotspot[i] <= Math.max(...gemPositions.map((p) => p.max[i])), 'Hotspot must be inside the actual sapphire');
}
console.log(
  'Pages assets, full ring/sapphire geometry, meter scale, gemstone hotspot and USDZ verified.',
);
