import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as game from '../src/generated/game.js';
import { compile } from '../tools/build.mjs';
import { fixtures, numericValues } from '../tools/conformance-fixtures.mjs';

const source = await readFile(new URL('../bend/game.bend', import.meta.url), 'utf8');
const probes = await import(`data:text/javascript;base64,${Buffer.from(compile(source + fixtures)).toString('base64')}`);
const withPlayer = (world, fields) => Object.freeze({ ...world, player: Object.freeze({ ...world.player, ...fields }) });

test('checked-in browser simulation is generated exactly from authoritative Bend', async () => {
  const generated = await readFile(new URL('../src/generated/game.js', import.meta.url), 'utf8');
  assert.equal(generated, compile(source));
  assert.equal(game.sourceHash, createHash('sha256').update(source).digest('hex'));
});

test('integer lowering preserves division, remainder, casts, overflow and precedence', () => {
  const { tag, ...values } = probes.numeric_probe();
  assert.equal(tag, 'NumericProbe');
  assert.deepEqual(values, numericValues);
});

test('compiler rejects unknown calls, floats, mixed numeric types and invalid arity', () => {
  assert.throws(() => compile('def main() -> u24:\n  return process(1)\n'), /Unknown function/);
  assert.throws(() => compile('def main() -> u24:\n  return 1.5\n'), /Unsupported expression/);
  assert.throws(() => compile('def main() -> u24:\n  return +0 + 5\n'), /Mixed/);
  assert.throws(() => compile('def main() -> i24:\n  return u24/to_i24(1, 2)\n'), /argument count/);
});

test('spawn protection permits movement, jumping, attacks and shields immediately', () => {
  const initial = game.initial();
  const active = game.step(initial, game.Input(1, 0, 1, 1, 0, 0));
  assert.equal(active.player.x, initial.player.x + 15);
  assert.equal(active.player.y, 37);
  assert.equal(active.player.jumps, 1);
  assert.equal(active.player.attack, 16);
  assert.equal(active.player.invulnerable, 89);
  assert.equal(active.player.hurt, 0);
  const shield = game.step(initial, game.Input(0, 0, 0, 0, 0, 1));
  assert.equal(shield.player.blocking, 1);
  assert.equal(shield.player.shield, 99);
  assert.equal(initial.player.y, 0);
  assert.ok(Object.isFrozen(initial) && Object.isFrozen(active.player));
});

test('double jump has a finite budget and landing restores it without tunnelling', () => {
  let world = game.step(game.initial(), game.Input(0, 0, 1, 0, 0, 0));
  world = game.step(world, game.Input(0, 0, 1, 0, 0, 0));
  assert.equal(world.player.jumps, 0);
  const third = game.step(world, game.Input(0, 0, 1, 0, 0, 0));
  assert.equal(third.player.vy, 35);
  for (let frame = 0; frame < 90; frame++) world = game.step(world, game.neutral_input());
  assert.equal(world.player.y, 0);
  assert.equal(world.player.jumps, 2);
  assert.equal(game.platform(-490, -210, 245, 180, -65), 195);
  assert.equal(game.platform(0, -360, 310, 245, -65), 280);
  assert.equal(game.platform(-490, -210, 180, 215, 35), -9999);
});

test('damage, knockback and blocked slashes keep hitstun separate from immunity', () => {
  const p = { ...game.initial().player, x: 100, z: 20, invulnerable: 0 };
  const b = { ...game.initial().boss, x: 0, z: 0, mode: 2 };
  const hit = game.damage_player(p, b);
  assert.equal(hit.damage, 22);
  assert.equal(hit.vx, 28);
  assert.equal(hit.vz, 14);
  assert.equal(hit.hurt, 48);
  assert.equal(hit.invulnerable, 48);
  assert.equal(game.damage_player(hit, b).damage, hit.damage);
  const blocked = game.damage_player({ ...p, blocking: 1 }, b);
  assert.equal(blocked.damage, 0);
  assert.equal(blocked.shield, 82);
  assert.equal(blocked.hurt, 0);
  assert.equal(blocked.invulnerable, 48);
});

test('a special has exactly one hit window and cannot become a neutral attack', () => {
  for (const [input, amount, kind, frames] of [
    [game.Input(0, 0, 0, 0, 1, 0), 64, 2, 35],
    [game.Input(0, 0, 0, 1, 0, 0), 24, 1, 20],
  ]) {
    const initial = game.initial();
    let player = game.attack_player({ ...initial.player, x: 100, z: 0 }, input);
    let boss = { ...initial.boss, x: 100, z: 0 };
    assert.equal(player.attack_kind, kind);
    let hits = 0;
    for (let frame = 0; frame < frames; frame++) {
      player = game.move_player(player, game.neutral_input(), frame);
      hits += game.player_hits(player, boss);
      boss = game.damage_boss(boss, player);
    }
    assert.equal(hits, 1);
    assert.equal(boss.hp, initial.boss.hp - amount);
    assert.equal(player.attack_kind, 0);
  }
});

test('falling loses exactly one stock; terminal game states remain frozen', () => {
  let world = game.initial();
  for (let stocks = 2; stocks >= 0; stocks--) {
    world = game.step(withPlayer(world, { y: -700 }), game.neutral_input());
    assert.equal(world.player.stocks, stocks);
    assert.equal(world.player.y, 0);
    assert.equal(world.player.hurt, 0);
  }
  assert.equal(world.status, 2);
  assert.equal(game.step(world, game.Input(1, 1, 1, 1, 1, 1)), world);
});

test('sustained keyboard-equivalent play completes a boss fight and preserves bounds', () => {
  let world = game.initial();
  let phaseTwo = false;
  for (let frame = 0; frame < 1800 && !world.status; frame++) {
    world = game.step(world, probes.combat_input(world));
    phaseTwo ||= world.boss.phase === 2;
    for (const value of Object.values(world.player)) if (typeof value === 'number') assert.ok(Number.isInteger(value));
    assert.ok(world.player.shield >= 0 && world.player.shield <= 100);
    assert.ok(world.player.energy >= 0 && world.player.energy <= 100);
    assert.ok(world.player.damage >= 0 && world.player.damage <= 300);
    assert.ok(world.boss.hp >= 0 && world.boss.hp <= 720);
  }
  assert.ok(phaseTwo);
  assert.equal(world.status, 1);
  assert.equal(world.boss.hp, 0);
  assert.equal(game.step(world, game.neutral_input()), world);
});

test('procedural Bend grove is a deterministic balanced tree', () => {
  const grove = game.grove(7, 1, 0, 0, 600);
  assert.equal(game.grove_count(grove), 128);
  assert.deepEqual(grove, game.grove(7, 1, 0, 0, 600));
});
