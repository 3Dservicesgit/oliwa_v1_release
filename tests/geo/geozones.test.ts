// Zone geometry as the server returns it, including zones drawn in the mobile
// app, which keep their circle or line in geozone_points.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGeozoneGeometry, parseGeozonePoints } from "../../src/api/types/geozones.types.ts";

test("a ring of [lng, lat] pairs is a polygon", () => {
  const g = parseGeozoneGeometry("[[32.61,0.60],[32.59,0.66],[32.66,0.69],[32.68,0.63]]");
  assert.equal(g.shape, "polygon");
  assert.equal(g.params, null);
  assert.equal(g.ring.length, 4);
  assert.deepEqual(g.ring[0], { lat: 0.60, lng: 32.61 });
  assert.deepEqual(g.outline, g.ring);
});

test("a circle drawn in the app: its centre, radius and a ring around it", () => {
  // "kampala cbd", 5 km round the city centre.
  const g = parseGeozoneGeometry('{"type":"circle","center":[32.578147910535336,0.31303235129801266],"radius":5000.0}');
  assert.equal(g.shape, "circle");
  assert.deepEqual(g.params, { center: { lat: 0.31303235129801266, lng: 32.578147910535336 }, radius_m: 5000 });
  assert.ok(g.ring.length >= 32, `ring of ${g.ring.length}`);
  // Every ring point is about 5 km from the centre.
  for (const p of g.ring) {
    const km = Math.hypot((p.lat - 0.31303) * 111.32, (p.lng - 32.57815) * 111.32 * Math.cos(0.313 * Math.PI / 180));
    assert.ok(Math.abs(km - 5) < 0.1, `${km} km`);
  }
  assert.equal(parseGeozonePoints('{"type":"circle","center":[32.5,0.3],"radius":4000}').length, g.ring.length);
});

test("a line drawn in the app: its route to draw, but no area", () => {
  const g = parseGeozoneGeometry('{"type":"line","points":[[32.657802142202854,0.3545807392698703],[32.723720110952854,0.3733487828138395]]}');
  assert.equal(g.shape, "line");
  assert.deepEqual(g.params, { points: g.outline, width_m: 0 });
  assert.equal(g.outline.length, 2);
  assert.deepEqual(g.ring, []);
  assert.deepEqual(parseGeozonePoints('{"type":"line","points":[[32.6,0.3],[32.7,0.4]]}'), []);
});

test("anything unreadable is no geometry, not an error", () => {
  for (const raw of ["", "not json", "null", "42", '{"type":"circle"}', '{"type":"circle","center":[32.5,0.3],"radius":0}', "[[\"a\",\"b\"]]"]) {
    const g = parseGeozoneGeometry(raw);
    assert.deepEqual(g.ring, [], raw);
    assert.deepEqual(g.outline, [], raw);
  }
});
