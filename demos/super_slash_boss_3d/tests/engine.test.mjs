import test from 'node:test';
import assert from 'node:assert/strict';
import { empty, generate, map, fold, visit, get, set, bvh, visible } from '../src/engine/tree.js';
import { camera, v, boundsOf, point } from '../src/engine/math.js';
import { box, cylinder, crystal, ribbon } from '../src/engine/mesh.js';
import { props, staticRegion, dynamicScene, evolveCuts } from '../src/scene.js';
import { initial } from '../src/generated/game.js';

test('persistent trees preserve previous versions, leaf counts and independent folds', () => {
  const tree = generate(0, 1024, i => i);
  assert.equal(tree.count, 1024);
  assert.equal(fold(tree, 0, (a, b) => a + b), 1023 * 1024 / 2);
  const mapped = map(tree, x => x * 2);
  assert.equal(mapped.count, tree.count);
  assert.equal(fold(mapped, 0, (a, b) => a + b), 1023 * 1024);
  let log;
  for (let i = 0; i < 100; i++) log = set(log, i, i * 7);
  const newer = set(log, 3, 1000);
  assert.equal(get(log, 3), 21); assert.equal(get(newer, 3), 1000);
  for (let i = 0; i < 100; i++) assert.equal(get(log, i), i * 7);
  assert.equal(get(log, 150), undefined);
});

test('BVH never drops a visible leaf compared with exhaustive camera tests', () => {
  const tree = generate(0, 1024, i => ({ minX: (i % 32) * 2 - 32, maxX: (i % 32) * 2 - 31,
    minY: -1, maxY: 1, minZ: Math.floor(i / 32) * 2 - 32, maxZ: Math.floor(i / 32) * 2 - 31 }));
  const index = bvh(tree, x => x);
  for (let k = 0; k < 12; k++) {
    const cam = camera(v(Math.sin(k) * 20, 8, Math.cos(k) * 20), v(), 1.5);
    const full = new Set(); visit(tree, b => { if (cam.test(b)) full.add(b); });
    const actual = new Set(), stats = { visited: 0, culled: 0 };
    visible(index, cam.test, b => actual.add(b), stats);
    assert.deepEqual(actual, full);
    assert.ok(stats.culled > 0);
  }
});

test('procedural meshes contain finite vertices and fit their conservative bounds', () => {
  const meshes = { box: box(), cylinder: cylinder(32), hex: cylinder(6), cone: cylinder(7, 0), crystal: crystal(), rock: cylinder(7, .68) };
  for (const mesh of Object.values(meshes)) {
    visit(mesh, triangle => {
      for (const p of [triangle.a, triangle.b, triangle.c, triangle.normal])
        for (const value of Object.values(p)) assert.ok(Number.isFinite(value));
    });
  }
  for (let region = 0; region < 4; region++) {
    visit(staticRegion(region), item => {
      const box = boundsOf(item), mesh = meshes[item.mesh];
      assert.ok(mesh, item.mesh);
      visit(mesh, triangle => {
        for (const vertex of [triangle.a, triangle.b, triangle.c]) {
          const p = point(item.transform, vertex);
          assert.ok(p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY && p.z >= box.minZ && p.z <= box.maxZ);
        }
      });
    });
  }
});

test('dynamic ribbon topology stays bounded while geometry genuinely deforms', () => {
  const a = ribbon(0, 3, .5, 0, 4, .2), b = ribbon(1, 3, .5, 0, 4, .2);
  assert.equal(a.count, 80); assert.equal(b.count, 80); assert.notDeepEqual(a, b);
});

test('a katana slash persistently cuts nearby scenery and fragments expire', () => {
  const propTree = props(), first = fold(propTree, null, (a, b) => a || b), original = initial();
  const slash = { ...original, frame: 1, boss: { ...original.boss, mode: 2, x: first.x * 100, z: first.z * 100 } };
  assert.equal(evolveCuts(original, { ...slash, boss: { ...slash.boss, mode: 1 } }, undefined, propTree), undefined);
  const log = evolveCuts(original, slash, undefined, propTree);
  assert.equal(get(log, first.id), 1);
  assert.equal(get(evolveCuts(slash, { ...slash, frame: 2 }, log, propTree), first.id), 1);
  const debris = dynamicScene(slash, 0, propTree, log);
  const expired = dynamicScene({ ...slash, frame: 200 }, 0, propTree, log);
  assert.ok(debris.count > expired.count);
  assert.equal(original.frame, 0);
});

test('all boss modes produce deterministic pure scene trees with bounded instance counts', () => {
  const original = initial(), propTree = props();
  for (let mode = 0; mode < 4; mode++) {
    const world = { ...original, boss: { ...original.boss, mode } };
    const snapshot = structuredClone(world);
    const a = dynamicScene(world, 5, propTree), b = dynamicScene(world, 5, propTree);
    assert.deepEqual(a, b); assert.deepEqual(world, snapshot); assert.ok(a.count < 500);
    visit(a, item => { for (const value of Object.values(boundsOf(item))) assert.ok(Number.isFinite(value)); });
  }
  assert.equal(empty.count, 0);
});
