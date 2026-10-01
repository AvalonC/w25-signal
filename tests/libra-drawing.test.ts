import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRA_FACET_GEOMETRY, drawLibraDiscovery } from '../lib/libra-drawing.ts';
import { SAPPHIRE_VERTICES as vertices, SAPPHIRE_FACES as faces, gemstoneOutline, projectSapphire, type GemVertex } from '../lib/sapphire-shape.ts';

const geometry = LIBRA_FACET_GEOMETRY;
const points = (value: unknown): GemVertex[] => {
  if (!Array.isArray(value)) return [];
  if (value.length === 3 && value.every((entry) => typeof entry === 'number')) return [value as GemVertex];
  return value.flatMap(points);
};
const near = (a: readonly number[], b: readonly number[]) => a.every((value, index) => Math.abs(value - b[index]) < 1e-9);
const subtract = (a: GemVertex, b: GemVertex): GemVertex => a.map((value, index) => value - b[index]) as GemVertex;
const dot = (a: GemVertex, b: GemVertex) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const onTriangle = (point: GemVertex, a: GemVertex, b: GemVertex, c: GemVertex) => {
  const u = subtract(b, a), v = subtract(c, a), w = subtract(point, a);
  const denominator = dot(u, u) * dot(v, v) - dot(u, v) ** 2;
  const one = (dot(w, u) * dot(v, v) - dot(w, v) * dot(u, v)) / denominator;
  const two = (dot(w, v) * dot(u, u) - dot(w, u) * dot(u, v)) / denominator;
  const projected = a.map((value, index) => value + u[index] * one + v[index] * two);
  return one >= -1e-9 && two >= -1e-9 && one + two <= 1 + 1e-9 && near(point, projected);
};
const onFacet = (point: GemVertex) => faces.some((face) => face.slice(1, -1).some((_, index) =>
  onTriangle(point, vertices[face[0]], vertices[face[index + 1]], vertices[face[index + 2]])));

void test('Libra uses opposite crown and shoulder vertices of the same stone', () => {
  const { beams, hangers, panRims, stars } = geometry;
  assert.strictEqual(beams[0][1], vertices[1]);
  assert.strictEqual(beams[1][1], vertices[5]);
  assert.deepEqual(hangers, [[vertices[1], vertices[9]], [vertices[5], vertices[13]]]);
  assert.strictEqual(panRims[0][1], vertices[9]);
  assert.strictEqual(panRims[1][1], vertices[13]);
  assert.deepEqual(stars, [vertices[1], beams[0][0], vertices[5], vertices[9], vertices[13]]);
  for (const key of ['beams', 'hangers', 'panRims', 'panBowls'] as const) {
    geometry[key][0].forEach((point, index) => {
      const opposite = [-point[0], point[1], -point[2]];
      assert.ok(near(opposite, geometry[key][1][index]), `${key} stays physically balanced before projection`);
    });
  }
});

void test('the column and pedestal end on pavilion facets instead of extending outside the gem', () => {
  assert.deepEqual(geometry.axis.slice(1), [vertices[7], vertices[15], vertices[16]]);
  assert.strictEqual(geometry.base[3], vertices[16]);
  for (const point of points(Object.values(geometry))) assert.ok(onFacet(point), `point ${point.join(",")} belongs to a real face`);
  const strokes = [...geometry.beams, ...geometry.hangers, ...geometry.panRims, ...geometry.panBowls, geometry.axis, geometry.base];
  for (const stroke of strokes) for (let index = 1; index < stroke.length; index++) {
    const midpoint = stroke[index].map((value, axis) => (value + stroke[index - 1][axis]) / 2) as GemVertex;
    assert.ok(onFacet(midpoint), 'the whole connecting line remains on a facet');
  }
});

function recording(angle: number, alignment = 1, found = false) {
  const drawn: { x: number; y: number }[] = [];
  const projected: GemVertex[] = [];
  const mark = (x: number, y: number) => { drawn.push({ x, y }); };
  const context = {
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, stroke() {}, fill() {},
    moveTo: mark, lineTo: mark, arc: mark,
    fillText: (_text: string, x: number, y: number) => mark(x, y),
  } as unknown as CanvasRenderingContext2D;
  drawLibraDiscovery(context, {
    project: (point) => { projected.push(point); return projectSapphire(point, angle, 320, 480); },
    scale: 96, alignment, found, time: 0, reduced: false, opacity: 1,
  });
  return { drawn, projected };
}

void test('every drawn mark follows the actual gem projection through a full turn', () => {
  for (let step = 0; step <= 32; step++) {
    const angle = step / 32 * Math.PI * 2;
    const outline = gemstoneOutline(vertices.map((vertex) => projectSapphire(vertex, angle, 320, 480)));
    const { drawn, projected } = recording(angle);
    assert.ok(drawn.length > 0 && projected.length > 0);
    for (const point of drawn) {
      const sides = outline.map((from, index) => {
        const to = outline[(index + 1) % outline.length];
        return (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
      });
      assert.ok(sides.every((side) => side >= -1e-7) || sides.every((side) => side <= 1e-7), 'no floating chart or external pedestal');
    }
  }
  const first = recording(2.18).drawn, wrapped = recording(2.18 + Math.PI * 2).drawn;
  first.forEach((point, index) => assert.ok(near([point.x, point.y], [wrapped[index].x, wrapped[index].y])));
  assert.notDeepEqual(recording(2.18, 0, true).drawn, recording(2.55, 0, true).drawn, 'found marks rotate with the facets, too');
});

void test('the constellation grows from the central beam before the lower supporting facets', () => {
  assert.equal(recording(2.18, 0).drawn.length, 0, 'no separate fixed reference chart');
  const early = recording(2.18, .35), culet = projectSapphire(vertices[16], 2.18, 320, 480);
  assert.ok(early.projected.includes(geometry.beams[0][0]));
  assert.ok(!early.drawn.some((point) => near([point.x, point.y], [culet.x, culet.y])), 'the lower facets wait until the crown light has travelled down');
  assert.ok(recording(2.18).projected.includes(vertices[16]));
  assert.ok(recording(2.18, 0, true).drawn.length > 0, 'a discovered engraving remains attached between alignments');
});
