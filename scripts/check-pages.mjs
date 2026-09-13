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
  'models/bracelet-assembly-validation.json',
  'models/bracelet-ring.usdz',
  'models/bracelet.usdz',
  'model-poster.svg',
  'model-ring-preview.png',
  'models/sapphire-star.glb',
  'models/jewelry-metadata.json',
  'models/bracelet-stars.json',
  'sapphire-preview.png',
  'images/sky-photorealistic.png',
  'images/ar-quick-look-night.svg',
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
assert.ok(ringManifest.evaluatedVertices >= 110000, 'Full ring geometry missing');
assert.ok(ringManifest.evaluatedPolygons >= 110000, 'Ring polygons missing');
// Inspect exported geometry, not just the declared manifest. glTF triangulation
// may split vertices at material/normal seams; compare actual triangle counts.
function inspectGLB(name, expectedMeshes, expectedTriangles, minSpan, maxSpan) {
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
  assert.ok(span > minSpan && span < maxSpan, name + ': meter scale is incorrect');
  return gltf;
}
// The tail now hangs down instead of widening the ring in its plane.
const ring = inspectGLB('bracelet-ring', 155, 226234, 0.04, 0.06);
inspectGLB('sapphire-star', 5, 14780, 0.005, 0.01);
const metadata = JSON.parse(readFileSync(resolve(root, 'models/jewelry-metadata.json'), 'utf8'));
const assembly = JSON.parse(readFileSync(resolve(root, 'models/bracelet-assembly-validation.json'), 'utf8'));
assert.equal(assembly.revision, metadata.revision);
assert.equal(ringManifest.revision, metadata.revision);
assert.equal(assembly.method, 'rigid-components');
assert.equal(assembly.rollDegrees, 90);
assert.equal(assembly.gemstoneFacing, 'outward');
assert.ok(assembly.maxEdgeLengthErrorMm < .0001, 'Assembly stretched the source jewelry');
assert.equal(assembly.tailParts.filter((name) => name.startsWith('Fan charm')).length, 4,
  'Fan, rim, detail and eye must move together');
assert.ok(Math.abs(Math.hypot(...metadata.normal) - 1) < .00001);
assert.ok(Math.abs(metadata.normal[1]) < .00001, 'Gem must face outward, not up');
assert.ok(metadata.hotspot[0] * metadata.normal[0] + metadata.hotspot[2] * metadata.normal[2] > .02,
  'Gem hotspot normal must face away from the wrist');
assert.equal(metadata.decimated, false);
assert.equal(metadata.units, 'meters');
assert.equal(metadata.vertices, ringManifest.evaluatedVertices);
assert.equal(metadata.polygons, ringManifest.evaluatedPolygons);
assert.equal(metadata.triangles, 226234);
const gem = ring.nodes.find((n) => n.name?.includes('four-point') && n.name.includes('brilliant'));
assert.ok(gem, 'Original central sapphire missing');
const gemPositions = ring.meshes[gem.mesh].primitives.map((p) => ring.accessors[p.attributes.POSITION]);
for (let i = 0; i < 3; i++) {
  assert.ok(metadata.hotspot[i] >= Math.min(...gemPositions.map((p) => p.min[i])) &&
    metadata.hotspot[i] <= Math.max(...gemPositions.map((p) => p.max[i])), 'Hotspot must be inside the actual sapphire');
}
const stars = JSON.parse(readFileSync(resolve(root, 'models/bracelet-stars.json'), 'utf8'));
assert.equal(stars.effectOnly, true);
assert.equal(stars.revision, metadata.revision, 'Star transition must follow the current model');
assert.equal(stars.points.length, 1050);
assert.ok(stars.points.every((p) => p.length === 3 && p.every((n) => Number.isFinite(n) && Math.abs(n) < .1)));
// Tail must fall below the ring's plane, with the pendant lower than its bail.
function centerY(name) {
  const node = ring.nodes.find((n) => n.name === name);
  assert.ok(node, 'Missing jewelry part: ' + name);
  const positions = ring.meshes[node.mesh].primitives.map((p) => ring.accessors[p.attributes.POSITION]);
  return (Math.min(...positions.map((p) => p.min[1])) + Math.max(...positions.map((p) => p.max[1]))) / 2;
}
assert.ok(centerY('Fan charm · domed silver pendant') < -.01, 'Pendant must hang under the ring');
assert.ok(centerY('Fan charm · domed silver pendant') < centerY('Fan charm · suspension eye'));
assert.ok(centerY('Extension · oval link 07') < centerY('Extension · oval link 01'));
// USDZ is an uncompressed ZIP with each file aligned to a 64-byte boundary.
const usdz = readFileSync(resolve(root, 'models/bracelet-ring.usdz'));
let offset = 0, entries = 0;
while (usdz.readUInt32LE(offset) === 0x04034b50) {
  assert.equal(usdz.readUInt16LE(offset + 8), 0, 'USDZ entries cannot be compressed');
  const size = usdz.readUInt32LE(offset + 18), nameLength = usdz.readUInt16LE(offset + 26), extra = usdz.readUInt16LE(offset + 28);
  const name = usdz.toString('utf8', offset + 30, offset + 30 + nameLength);
  assert.ok(!name.startsWith('/') && !name.includes('..') && !name.includes('\\'));
  if (!entries) assert.ok(/\.usd[ac]?$/.test(name), 'First USDZ entry must be the root scene');
  const data = offset + 30 + nameLength + extra;
  assert.equal(data % 64, 0, 'USDZ data alignment is invalid');
  assert.ok(size > 0 && data + size <= usdz.length);
  entries++; offset = data + size;
}
assert.ok(entries > 0, 'USDZ archive is empty');
console.log(
  'Pages assets, full geometry, gravity tail, star silhouette, gemstone hotspot and USDZ packing verified.',
);
