import { v, color, transform, compose, between, hash, mix, clamp } from './engine/math.js';
import { empty, leaf, branch, combine, generate, map, fold, get, set, bvh } from './engine/tree.js';
import { flatten } from './engine/mesh.js';
import { boundsOf } from './engine/math.js';
import { grove } from './generated/game.js';

const stone = color(.12, .20, .22), top = color(.24, .34, .34), edge = color(.09, .16, .19);
const cyan = color(.16, .79, .73, .7), gold = color(.72, .72, .34, .5);
const dark = color(.032, .058, .073), ivory = color(.72, .78, .7), red = color(.64, .105, .12);
export const instance = (mesh, t, c, glow = false) => ({ mesh, transform: t, color: c, glow });
const shape = (mesh, x, y, z, sx, sy, sz, c, yaw = 0, roll = 0, glow = false) =>
  leaf(instance(mesh, transform(x, y, z, sx, sy, sz, yaw, roll), c, glow));
const group = (tree, t) => map(tree, item => ({ ...item, transform: compose(t, item.transform) }));
const rod = (a, b, width, c, mesh = 'box') => leaf(instance(mesh, between(a, b, width), c));
const ring = (x, y, z, r, width, c, pieces = 80, start = 0, sweep = Math.PI * 2, glow = false) =>
  generate(0, pieces, i => {
    const a = start + (i + .5) / pieces * sweep;
    return instance('box', transform(x + Math.cos(a) * r, y, z + Math.sin(a) * r,
      r * sweep / pieces * .92, .024, width, -a + Math.PI / 2), c, glow);
  });

function gate(x, z, scale = 1) {
  const t = transform(x, 0, z, scale, scale, scale);
  return group(combine(
    combine(shape('box', -1.6, 2.45, 0, .28, 4.9, .32, red), shape('box', 1.6, 2.45, 0, .28, 4.9, .32, red),
      shape('box', 0, 4.1, 0, 4.3, .25, .28, red), shape('box', 0, 4.9, 0, 4.9, .28, .52, dark)),
    combine(shape('box', -2.45, 5.04, 0, .72, .24, .52, dark, 0, -.2), shape('box', 2.45, 5.04, 0, .72, .24, .52, dark, 0, .2),
      shape('box', 0, 4.52, 0, .6, .65, .18, gold)),
    combine(shape('rock', -1.6, .17, 0, .64, .35, .65, stone), shape('rock', 1.6, .17, 0, .64, .35, .65, stone))), t);
}

export function staticRegion(region) {
  if (region === 0) {
    const tiles = flatten(generate(0, 96, i => {
      const sector = i % 24, row = Math.floor(i / 24), a = sector / 24 * Math.PI * 2;
      const r = 1.4 + row * 1.85, x = Math.cos(a) * r, z = Math.sin(a) * r;
      return shape('rock', x, -.22 - hash(i) * .09, z, 1.96, .5, 1.8, color(.18 + hash(i) * .08, .28 + hash(i) * .06, .29 + hash(i) * .05), -a);
    }));
    const underside = generate(0, 68, i => {
      const a = i / 68 * Math.PI * 2, r = 6.5 + hash(i) * 1.1, h = 2.1 + hash(i + 9) * 3;
      return instance('rock', transform(Math.cos(a) * r, -h / 2 - .3, Math.sin(a) * r,
        1.6, h, 1.65, a, (hash(i + 6) - .5) * .5), color(.075, .14 + hash(i) * .05, .16));
    });
    const cracks = generate(0, 38, i => {
      const a = i / 38 * Math.PI * 2, r = 7.1;
      return instance('box', transform(Math.cos(a) * r, -.6 - hash(i) * .6, Math.sin(a) * r,
        .045, .8 + hash(i) * 1.7, .05, a, (hash(i) - .5) * .8), cyan);
    });
    return combine(combine(shape('cylinder', 0, -.32, 0, 15.9, .52, 15.9, top), tiles,
      shape('rock', 0, -2.1, 0, 13.3, 3.8, 13.3, edge), underside),
      combine(ring(0, .012, 0, 7.65, .075, gold), ring(0, .014, 0, 3.2, .038, cyan),
        ring(0, .015, 0, 3.45, .03, cyan, 48), cracks),
      generate(0, 12, i => { const a = i * Math.PI / 6; return instance('box',
        transform(Math.cos(a) * 3.7, .02, Math.sin(a) * 3.7, .32, .023, .075, -a), gold); }));
  }
  if (region === 1) {
    const platform = (x, y, z, width) => combine(shape('rock', x, y - .4, z, width, .78, 2.2, stone),
      shape('box', x, y - .055, z, width, .11, 2.2, top),
      shape('box', x, y - .08, z + 1.1, width * .9, .075, .075, cyan),
      shape('cone', x, y - 1, z, width * .6, 1.4, 1.8, edge, 0, Math.PI));
    return combine(platform(-4.9, 1.95, -2.1, 3.1), platform(0, 2.8, -3.6, 2.8),
      platform(4.9, 1.95, -2.1, 3.1), gate(0, -6.2, 1.0));
  }
  if (region === 2) {
    const islands = flatten(generate(0, 32, i => {
      const a = i * 2.399, r = 15 + hash(i) * 32, x = Math.cos(a) * r, z = Math.sin(a) * r - 15;
      const h = 1.7 + hash(i + 6) * 6, y = -2 + hash(i + 14) * 10, s = 1.3 + hash(i + 2) * 3;
      return combine(shape('rock', x, y - h * .5, z, s, h, s, stone, i),
        shape('hex', x, y, z, s, .14, s, top, i),
        i % 5 === 0 ? group(gate(0, 0, .6), transform(x, y, z)) : empty);
    }));
    const debris = generate(0, 140, i => {
      const a = i * 2.39, r = 9 + hash(i) * 25, s = .12 + hash(i + 1) * .65;
      return instance('crystal', transform(Math.cos(a) * r, -6 + hash(i + 2) * 10,
        Math.sin(a) * r, s, s * 1.6, s, i, i), stone);
    });
    return branch(islands, debris);
  }
  // Hierarchical, individually procedural hanging shrine lanterns and stone path.
  return combine(flatten(generate(0, 10, i => {
    const side = i % 2 ? 1 : -1, z = -4.5 + Math.floor(i / 2) * 1.8, x = side * (6.1 - Math.abs(z) * .07);
    return combine(shape('rock', x, .18, z, .64, .36, .64, stone), shape('box', x, .68, z, .21, .9, .21, stone),
      combine(shape('hex', x, 1.25, z, .6, .5, .6, dark), shape('box', x, 1.27, z, .32, .3, .32, gold)),
      shape('cone', x, 1.67, z, .94, .38, .94, dark));
  })), generate(0, 18, i => instance('box', transform((i % 3 - 1) * .82, .025, -1.8 - Math.floor(i / 3) * .8,
    .75, .05, .74, (hash(i) - .5) * .1), top)));
}
export const indexScene = tree => bvh(tree, boundsOf);

export function props() {
  const convert = tree => tree.tag === 'Grove/Leaf' ? leaf({ ...tree.value,
    x: tree.value.x / 100, z: tree.value.z / 100 + 2.4 }) : branch(convert(tree.left), convert(tree.right));
  return convert(grove(4, 1, 0, 0, 620));
}

export function evolveCuts(previous, world, cuts, propTree) {
  if (world.frame === previous.frame || world.boss.mode !== 2) return cuts;
  const b = world.boss;
  return fold(propTree, cuts, (log, p) => {
    if (get(log, p.id) !== undefined) return log;
    const dx = p.x - b.x / 100, dz = p.z - b.z / 100;
    return dx * dx + dz * dz < 13 ? set(log, p.id, world.frame) : log;
  });
}

function scenery(propTree, cuts, frame) {
  return flatten(map(propTree, p => {
    const cut = get(cuts, p.id), age = cut === undefined ? -1 : (frame - cut) / 60;
    const h = p.height / 100, angle = hash(p.id) * 6;
    const body = p.kind === 0 ? 'hex' : 'crystal';
    const c = p.kind === 0 ? stone : color(.08, .38 + hash(p.id) * .22, .35, .25);
    const base = shape('rock', p.x, .15, p.z, .63, .3, .63, stone);
    if (age < 0) return combine(base, shape(body, p.x, h / 2, p.z, .38, h, .38, c, angle),
      shape('crystal', p.x, h, p.z, .22, .45, .22, cyan, angle));
    const stump = shape(body, p.x, .22, p.z, .38, .45, .38, c, angle);
    if (age > 2) return branch(base, stump);
    const fragments = generate(0, 7, i => {
      const a = hash(p.id * 13 + i) * 6.28, speed = 1.4 + hash(i) * 2.4;
      const y = Math.max(.1, .6 + i * .15 + age * speed - age * age * 4);
      return instance('crystal', transform(p.x + Math.cos(a) * age * speed, y, p.z + Math.sin(a) * age * speed,
        .24, Math.max(.01, (1 - age / 2)) * h * .35, .24, a + age * 3, age * 4), c);
    });
    return combine(base, stump, fragments);
  }));
}

function fighter(p, time) {
  const moving = Math.abs(p.vx) + Math.abs(p.vz) > 0, run = moving ? Math.sin(time * 19) * .65 : Math.sin(time * 2) * .04;
  const attack = p.attack > 0, special = p.attack_kind === 2;
  const yaw = p.face === 1 ? Math.PI / 2 : -Math.PI / 2;
  const root = transform(p.x / 100, p.y / 100, p.z / 100, 1, 1, 1, yaw);
  const coat = p.hurt > 32 ? ivory : color(.08, .40, .42);
  const body = combine(
    combine(shape('hex', 0, 1.1, 0, .58, .68, .36, coat), shape('box', 0, 1.6, 0, .43, .41, .4, ivory),
      shape('box', 0, 1.65, .205, .48, .12, .06, dark), shape('box', 0, 1.65, .245, .24, .035, .022, cyan)),
    combine(rod(v(-.17, .8, 0), v(-.2, .28, run * .38), .17, dark),
      rod(v(.17, .8, 0), v(.2, .28, -run * .38), .17, dark),
      shape('box', -.2, .12, .1 + run * .38, .21, .22, .4, dark),
      shape('box', .2, .12, .1 - run * .38, .21, .22, .4, dark)),
    combine(rod(v(-.3, 1.36, 0), v(-.43, 1.0 + run * .12, .15), .16, coat),
      rod(v(.3, 1.36, 0), v(.5, attack ? 1.4 : 1.04, attack ? .6 : .2), .17, coat),
      shape('box', 0, 1.37, .04, .69, .14, .44, cyan)),
    combine(rod(v(.5, attack ? 1.4 : 1.05, attack ? .6 : .2),
      v(attack ? 1.5 : .55, attack ? 1.65 : 2.35, attack ? 1.9 : .4), .055, ivory),
      generate(0, 9, i => instance('box', transform(-.08 + Math.sin(time * 7 - i * .55) * i * .035,
        1.32 - i * .05, -.27 - i * .17, .26 - i * .018, .045, .23, Math.sin(time * 7 - i * .5) * .2), cyan))));
  const shield = p.blocking ? combine(
    ring(p.x / 100, p.y / 100 + .05, p.z / 100, 1.12, .055, cyan, 48, 0, Math.PI * 2, true),
    generate(0, 18, i => { const a = i / 18 * Math.PI * 2; return instance('crystal',
      transform(p.x / 100 + Math.cos(a) * .94, p.y / 100 + .92, p.z / 100 + Math.sin(a) * .94,
        .06, 1.35 * (.75 + .25 * Math.sin(a)), .06, a), color(.09, .39, .43, .4), true); })) : empty;
  const slash = attack ? leaf(instance('playerRibbon', transform(p.x / 100, p.y / 100 + 1.1, p.z / 100,
    1, 1, 1, -time * 18 * p.face), special ? gold : cyan, true)) : empty;
  return combine(group(body, root), shield, slash,
    shape('cylinder', p.x / 100, .035, p.z / 100, .95, .012, .6, dark));
}

function ronin(b, time) {
  const warning = b.mode === 1, slash = b.mode === 2;
  const yaw = Math.atan2(b.aimx - b.x, b.aimz - b.z), breathe = Math.sin(time * 2) * .055;
  const root = transform(b.x / 100, 0, b.z / 100, 1.25, 1.25, 1.25, yaw);
  const armor = b.hit ? ivory : color(.07, .095, .12), scarlet = color(.51, .065, .08, b.phase === 2 ? .2 : 0);
  const hand = v(slash ? -.7 : 1.0, warning ? 3.45 : slash ? 1.65 : 1.75, warning ? -.4 : .55);
  const bladeEnd = v(warning ? -.2 : slash ? -3.7 : 2.4, warning ? 5.65 : slash ? 1.5 : .38, warning ? -.85 : slash ? 2.5 : 1.2);
  const arms = combine(shape('hex', -.73, 2.25, 0, .7, .38, .68, scarlet, 0, -.22),
    shape('hex', .73, 2.25, 0, .7, .38, .68, scarlet, 0, .22),
    rod(v(.69, 2.25, .03), hand, .23, armor), rod(v(-.67, 2.15, 0), v(-.9, 1.55, .2), .24, armor));
  const katana = branch(rod(hand, bladeEnd, .085, ivory),
    leaf(instance('box', between(hand, bladeEnd, .027, .14), gold)));
  const skirt = flatten(generate(0, 8, i => {
    const a = i / 8 * Math.PI * 2;
    return shape('box', Math.cos(a) * .46, 1.05 + breathe, Math.sin(a) * .35,
      .34, 1.1, .1, i % 2 ? armor : scarlet, -a + Math.PI / 2, Math.sin(time * 3 + i) * .08);
  }));
  const scarf = generate(0, 15, i => instance('box', transform(Math.sin(time * 5 - i * .3) * i * .026,
    2.2 - i * .062, -.4 - i * .11, .77 - i * .035, .05, .18), scarlet));
  const body = combine(
    combine(shape('hex', 0, 1.85 + breathe, 0, 1.0, 1.12, .64, armor),
      shape('box', 0, 2.01 + breathe, .34, .77, .53, .1, scarlet),
      shape('hex', 0, 2.83 + breathe, .02, .6, .67, .54, ivory),
      shape('cone', 0, 3.16 + breathe, 0, 1.8, .37, 1.4, dark)),
    combine(shape('box', 0, 2.82 + breathe, .31, .53, .11, .06, dark),
      shape('box', -.15, 2.84 + breathe, .355, .13, .036, .03, red),
      shape('box', .15, 2.84 + breathe, .355, .13, .036, .03, red),
      shape('cone', 0, 2.46 + breathe, .2, .48, .62, .43, dark, 0, Math.PI)),
    combine(rod(v(-.36, 1.35, 0), v(-.56, .25, .2), .3, dark), rod(v(.36, 1.35, 0), v(.62, .25, -.2), .3, dark),
      shape('box', -.56, .12, .35, .37, .24, .72, armor), shape('box', .62, .12, -.03, .37, .24, .72, armor)),
    combine(arms, katana, skirt, scarf));
  const telegraph = warning ? combine(
    ring(b.aimx / 100, .06, b.aimz / 100, 1.9, .055, red, 64, 0, Math.PI * 2, true),
    ring(b.x / 100, .055, b.z / 100, 3.55, .06, color(.48, .08, .06, .25), 80, time, Math.PI * 1.7, true),
    leaf(instance('box', between(v(b.x / 100, .045, b.z / 100), v(b.aimx / 100, .045, b.aimz / 100), .035), red, true))) : empty;
  return combine(group(body, root), telegraph,
    slash ? leaf(instance('bossRibbon', transform(b.x / 100, 1.3, b.z / 100, 1, 1, 1, time * 18), color(.85, .21, .1, .9), true)) : empty,
    shape('cylinder', b.x / 100, .035, b.z / 100, 2.1, .018, 1.25, dark));
}

export function dynamicScene(world, time, propTree, cuts) {
  const motes = generate(0, 100, i => {
    const a = i * 2.399 + time * (.015 + hash(i) * .025), r = 3 + hash(i + 3) * 15;
    const y = ((hash(i + 7) * 9 + time * (.1 + hash(i) * .12)) % 9) - 1;
    const s = .025 + hash(i + 1) * .045;
    return instance('crystal', transform(Math.cos(a) * r, y, Math.sin(a) * r,
      s * 1.8, s * .4, s, a + time, time + i), i % 3 ? color(.35, .59, .49, .6) : color(.74, .3, .19, .5));
  });
  const impacts = world.boss.hit > 0 ? generate(0, 28, i => {
    const age = (12 - world.boss.hit) / 12, a = i * 2.39, r = .4 + age * 2.5;
    return instance('crystal', transform(world.boss.x / 100 + Math.cos(a) * r, 1.6 + Math.sin(i * 4) * r,
      world.boss.z / 100 + Math.sin(a) * r, .055, .35 * (1 - age), .045, a, a), gold);
  }) : empty;
  return combine(fighter(world.player, time), ronin(world.boss, time), scenery(propTree, cuts, world.frame), branch(motes, impacts));
}
