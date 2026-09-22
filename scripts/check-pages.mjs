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
  'model-clasp-detail.png',
  'model-clasp-top.png',
  'models/sapphire-star.glb',
  'models/jewelry-metadata.json',
  'models/bracelet-stars.json',
  'sapphire-preview.png',
  'images/sky-photorealistic.png',
  'images/ar-native-transparent.png',
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
const modelBuffers = new WeakMap();
function inspectGLB(name, expectedMeshes, expectedTriangles, minSpan, maxSpan) {
  const bytes = readFileSync(resolve(root, 'models', name + '.glb'));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  modelBuffers.set(gltf, bytes.subarray(28 + bytes.readUInt32LE(12)));
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
assert.equal(assembly.clasp.bodyRollDegrees, 90);
assert.equal(assembly.clasp.apertureCrossings, 1, 'The terminal ring must thread the clasp aperture exactly once');
assert.equal(assembly.clasp.checks.length, 5, 'Validate shell, closed gate, pivot, seam and lever');
assert.ok(assembly.clasp.minimumSurfaceClearanceMm > .02, 'Clasp must not intersect the terminal ring');
for (const check of assembly.clasp.checks) {
  assert.equal(check.triangleIntersections, 0, check.part + ' overlaps the terminal ring');
  assert.ok(check.minimumSurfaceClearanceMm > .02);
}
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
// Independently test the exported triangles, not only the Blender report. The
// final GLB uses Y-up: its terminal-ring plane is XY and clasp plane is XZ.
function accessorData(model, index) {
  const accessor = model.accessors[index], view = model.bufferViews[accessor.bufferView];
  const bytes = modelBuffers.get(model);
  const components = accessor.type === 'VEC3' ? 3 : 1;
  const unit = accessor.componentType === 5123 ? 2 : 4;
  const stride = view.byteStride ?? unit * components;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: components }, (_, j) => {
    const at = offset + i * stride + j * unit;
    return accessor.componentType === 5126 ? bytes.readFloatLE(at)
      : accessor.componentType === 5123 ? bytes.readUInt16LE(at) : bytes.readUInt32LE(at);
  }));
}
const shellNode = ring.nodes.find((node) => node.name === 'Lobster clasp · hollow teardrop shell');
assert.ok(shellNode);
const shellTriangles = ring.meshes[shellNode.mesh].primitives.flatMap((primitive) => {
  const points = accessorData(ring, primitive.attributes.POSITION);
  const indices = accessorData(ring, primitive.indices).flat();
  return Array.from({ length: indices.length / 3 }, (_, i) => indices.slice(i * 3, i * 3 + 3).map((j) => points[j]));
});
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
function rayHitsShell(point, direction) {
  return shellTriangles.some(([a, b, c]) => {
    const first = subtract(b, a), second = subtract(c, a), h = cross(direction, second);
    const determinant = dot(first, h);
    if (Math.abs(determinant) < 1e-14) return false;
    const s = subtract(point, a), u = dot(s, h) / determinant;
    if (u < 0 || u > 1) return false;
    const q = cross(s, first), v = dot(direction, q) / determinant;
    if (v < 0 || u + v > 1) return false;
    const distance = dot(second, q) / determinant;
    return distance > 0 && distance < .012;
  });
}
const inside = assembly.clasp.terminalCentrelineCrossings.map((crossing) => {
  const [x, y, z] = crossing.positionMeters, point = [x, z, -y];
  const enclosed = Array.from({ length: 32 }, (_, i) => {
    const angle = i * Math.PI * 2 / 32;
    return rayHitsShell(point, [Math.cos(angle), 0, -Math.sin(angle)]);
  }).every(Boolean);
  assert.equal(enclosed, crossing.insideClaspAperture, 'Exported clasp aperture differs from the validated assembly');
  return enclosed;
});
assert.equal(inside.filter(Boolean).length, 1, 'Exported clasp is stacked instead of interlocked');
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
  'Pages assets, full geometry, interlocked clasp, gravity tail, star silhouette, gemstone hotspot and USDZ packing verified.',
);
