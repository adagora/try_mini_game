// Generated from bend/game.bend. Edit the Bend source, then npm run build.
const __u24 = n => n & 0xffffff;
const __i24 = n => (n << 8) >> 8;
const u24$to_i24 = __i24;
const i24$to_u24 = __u24;
const __div = (a, b) => { if (b === 0) throw new RangeError("Bend division by zero"); return Math.trunc(a / b); };
const __rem = (a, b) => { if (b === 0) throw new RangeError("Bend remainder by zero"); return a % b; };
export const Input = (x, z, jump, attack, special, shield) => Object.freeze({ tag: 'Input', x, z, jump, attack, special, shield });
export const Player = (x, y, z, vx, vy, vz, face, jumps, damage, shield, energy, cooldown, attack, hurt, stocks, blocking, invulnerable, attack_kind) => Object.freeze({ tag: 'Player', x, y, z, vx, vy, vz, face, jumps, damage, shield, energy, cooldown, attack, hurt, stocks, blocking, invulnerable, attack_kind });
export const Boss = (x, z, hp, timer, phase, aimx, aimz, mode, hit) => Object.freeze({ tag: 'Boss', x, z, hp, timer, phase, aimx, aimz, mode, hit });
export const World = (frame, player, boss, status, combo, best) => Object.freeze({ tag: 'World', frame, player, boss, status, combo, best });
export const Prop = (id, x, z, height, kind) => Object.freeze({ tag: 'Prop', id, x, z, height, kind });
export const Grove$Node = (left, right) => Object.freeze({ tag: 'Grove/Node', left, right });
export const Grove$Leaf = (value) => Object.freeze({ tag: 'Grove/Leaf', value });
export function pick(c, a, b) {
  if (c) {
    return a;
  }
  else {
    return b;
  }
}
export function low(a, b) {
  if (Number(a < b)) {
    return a;
  }
  else {
    return b;
  }
}
export function high(a, b) {
  if (Number(a > b)) {
    return a;
  }
  else {
    return b;
  }
}
export function sub(a, b) {
  if (Number(a > b)) {
    return __u24((a - b));
  }
  else {
    return 0;
  }
}
export function abs_i(x) {
  if (Number(x < 0)) {
    return __i24((0 - x));
  }
  else {
    return x;
  }
}
export function sign_i(x) {
  if (Number(x < 0)) {
    return -1;
  }
  else {
    return 1;
  }
}
export function clamp_i(x, a, b) {
  return high(a, low(b, x));
}
export function sqdist(x, z, a, b) {
  return __i24((__i24((__i24((x - a)) * __i24((x - a)))) + __i24((__i24((z - b)) * __i24((z - b))))));
}
export function spawn_player(stocks) {
  return Player(-330, 0, 40, 0, 0, 0, 1, 2, 0, 100, 100, 0, 0, 0, stocks, 0, 90, 0);
}
export function initial() {
  return World(0, spawn_player(3), Boss(350, 0, 720, 0, 1, -330, 40, 0, 0), 0, 0, 0);
}
export function platform(x, z, oldy, newy, vy) {
  if (__u24((__u24((__u24((__u24((Number(vy <= 0) & Number(oldy >= 195))) & Number(newy <= 195))) & Number(abs_i(__i24((x + 490))) < 155))) & Number(abs_i(__i24((z + 210))) < 115)))) {
    return 195;
  }
  else if (__u24((__u24((__u24((__u24((Number(vy <= 0) & Number(oldy >= 280))) & Number(newy <= 280))) & Number(abs_i(x) < 140))) & Number(abs_i(__i24((z + 360))) < 95)))) {
    return 280;
  }
  else if (__u24((__u24((__u24((__u24((Number(vy <= 0) & Number(oldy >= 195))) & Number(newy <= 195))) & Number(abs_i(__i24((x - 490))) < 155))) & Number(abs_i(__i24((z + 210))) < 115)))) {
    return 195;
  }
  else if (__u24((__u24((Number(newy <= 0) & Number(oldy >= 0))) & Number(sqdist(x, z, 0, 0) < 640000)))) {
    return 0;
  }
  else {
    return -9999;
  }
}
export function move_player(p, i, frame) {
  const blocking = __u24((__u24((i.shield & Number(p.shield > 0))) & Number(p.hurt == 0)));
  const speed = pick(blocking, 5, 15);
  const dx = pick(Number(p.hurt > 28), p.vx, __i24((i.x * speed)));
  const dz = pick(Number(p.hurt > 28), p.vz, __i24((i.z * speed)));
  const jumping = __u24((__u24((i.jump & Number(p.jumps > 0))) & Number(p.hurt == 0)));
  const dy = pick(jumping, 37, high(-65, __i24((p.vy - 2))));
  const nx = __i24((p.x + dx));
  const nz = __i24((p.z + dz));
  const ny = __i24((p.y + dy));
  const floor = platform(nx, nz, p.y, ny, dy);
  const landed = Number(floor > -9999);
  const jumps = pick(landed, 2, sub(p.jumps, jumping));
  const sh = pick(blocking, sub(p.shield, 1), low(100, __u24((p.shield + __u24(__rem(frame, 2))))));
  const face = pick(Number(i.x != 0), sign_i(i.x), p.face);
  return Player(nx, pick(landed, floor, ny), nz, dx, pick(landed, 0, dy), dz, face, jumps, p.damage, sh, low(100, __u24((p.energy + pick(Number(__u24(__rem(frame, 8)) == 0), 1, 0)))), sub(p.cooldown, 1), sub(p.attack, 1), sub(p.hurt, 1), p.stocks, blocking, sub(p.invulnerable, 1), pick(Number(p.attack > 1), p.attack_kind, 0));
}
export function attack_player(p, i) {
  const ready = __u24((__u24((Number(p.cooldown == 0) & Number(p.hurt == 0))) & Number(p.blocking == 0)));
  const special = __u24((__u24((ready & i.special)) & Number(p.energy >= 30)));
  const normal = __u24((__u24((ready & i.attack)) & Number(special == 0)));
  const active = __u24((special | normal));
  const kind = pick(active, pick(special, 2, 1), p.attack_kind);
  return Player(p.x, p.y, p.z, p.vx, p.vy, p.vz, p.face, p.jumps, p.damage, p.shield, sub(p.energy, pick(special, 30, 0)), pick(active, pick(special, 42, 23), p.cooldown), pick(active, pick(special, 32, 16), p.attack), p.hurt, p.stocks, p.blocking, p.invulnerable, kind);
}
export function move_boss(b, p) {
  const phase = pick(Number(b.hp <= 360), 2, 1);
  const cycle = pick(Number(phase == 2), 172, 208);
  const timer = __u24(__rem(__u24((b.timer + 1)), cycle));
  const warning = __u24((Number(timer >= 65) & Number(timer < 112)));
  const slash = __u24((Number(timer >= 112) & Number(timer < 133)));
  const mode = pick(slash, 2, pick(warning, 1, pick(Number(timer >= 133), 3, 0)));
  const aimx = pick(Number(timer == 65), p.x, b.aimx);
  const aimz = pick(Number(timer == 65), p.z, b.aimz);
  const distance = high(1, high(abs_i(__i24((aimx - b.x))), abs_i(__i24((aimz - b.z)))));
  const dashx = __i24(__div(__i24((__i24((aimx - b.x)) * 34)), distance));
  const dashz = __i24(__div(__i24((__i24((aimz - b.z)) * 34)), distance));
  const walkx = pick(Number(abs_i(__i24((p.x - b.x))) > 220), __i24((sign_i(__i24((p.x - b.x))) * 3)), 0);
  const walkz = pick(Number(abs_i(__i24((p.z - b.z))) > 80), __i24((sign_i(__i24((p.z - b.z))) * 2)), 0);
  const dx = pick(slash, dashx, pick(Number(mode == 0), walkx, 0));
  const dz = pick(slash, dashz, pick(Number(mode == 0), walkz, 0));
  return Boss(clamp_i(__i24((b.x + dx)), -580, 580), clamp_i(__i24((b.z + dz)), -440, 420), b.hp, timer, phase, aimx, aimz, mode, sub(b.hit, 1));
}
export function player_hits(p, b) {
  const special = __u24((Number(p.attack_kind == 2) & Number(p.attack == 31)));
  const neutral = __u24((Number(p.attack_kind == 1) & Number(p.attack == 15)));
  const range = pick(special, 150000, 85000);
  const facing = __u24((Number(__i24((__i24((b.x - p.x)) * p.face)) > -80) | special));
  return __u24((__u24((__u24((__u24((special | neutral)) & facing)) & Number(p.y < 340))) & Number(sqdist(p.x, p.z, b.x, b.z) < range)));
}
export function damage_boss(b, p) {
  const hit = player_hits(p, b);
  const amount = pick(Number(p.attack_kind == 2), 64, 24);
  return Boss(b.x, b.z, sub(b.hp, pick(hit, amount, 0)), b.timer, b.phase, b.aimx, b.aimz, b.mode, pick(hit, 12, b.hit));
}
export function boss_hits(b, p) {
  return __u24((__u24((__u24((Number(b.mode == 2) & Number(p.invulnerable == 0))) & Number(p.y < 190))) & Number(sqdist(p.x, p.z, b.x, b.z) < 145000)));
}
export function damage_player(p, b) {
  const hit = boss_hits(b, p);
  const blocked = __u24((__u24((hit & p.blocking)) & Number(p.shield >= 18)));
  const damaged = __u24((hit & Number(blocked == 0)));
  const damage = low(300, __u24((p.damage + pick(damaged, 22, 0))));
  const force = __i24((24 + low(28, u24$to_i24(__u24(__div(damage, 5))))));
  const vx = pick(damaged, __i24((sign_i(__i24((p.x - b.x))) * force)), p.vx);
  const vz = pick(damaged, __i24(__div(__i24((sign_i(__i24((p.z - b.z))) * force)), 2)), p.vz);
  return Player(p.x, p.y, p.z, vx, pick(damaged, 23, p.vy), vz, p.face, p.jumps, damage, sub(p.shield, pick(blocked, 18, 0)), low(100, __u24((p.energy + pick(blocked, 12, 0)))), p.cooldown, pick(damaged, 0, p.attack), pick(damaged, 48, p.hurt), p.stocks, p.blocking, pick(hit, 48, p.invulnerable), pick(damaged, 0, p.attack_kind));
}
export function resolve_player(p) {
  if (__u24((__u24((Number(p.y < -650) | Number(abs_i(p.x) > 1350))) | Number(abs_i(p.z) > 1300)))) {
    return spawn_player(sub(p.stocks, 1));
  }
  else {
    return p;
  }
}
export function step(w, i) {
  if (Number(w.status != 0)) {
    return w;
  }
  else {
    const moved = move_player(w.player, i, w.frame);
    const attacking = attack_player(moved, i);
    const boss = move_boss(w.boss, attacking);
    const damaged = damage_boss(boss, attacking);
    const player = resolve_player(damage_player(attacking, damaged));
    const hit = player_hits(attacking, boss);
    const combo = pick(Number(player.hurt > 28), 0, __u24((w.combo + hit)));
    const status = pick(Number(damaged.hp == 0), 1, pick(Number(player.stocks == 0), 2, 0));
    return World(__u24((w.frame + 1)), player, damaged, status, combo, high(w.best, combo));
  }
}
export function grove(depth, id, x, z, span) {
  if (Number(depth == 0)) {
    return Grove$Leaf(Prop(id, x, z, __u24((130 + __u24((__u24(__rem(id, 5)) * 45)))), __u24(__rem(id, 3))));
  }
  else {
    const next = __i24(__div(span, 2));
    const left = grove(__u24((depth - 1)), __u24((id * 2)), __i24((x - next)), __i24((z + pick(__u24(__rem(depth, 2)), next, 0))), next);
    const right = grove(__u24((depth - 1)), __u24((__u24((id * 2)) + 1)), __i24((x + next)), __i24((z - pick(__u24(__rem(depth, 2)), next, 0))), next);
    return Grove$Node(left, right);
  }
}
export function grove_count(tree) {
  switch (tree.tag) {
    case 'Grove/Leaf': {
      return 1;
    }
    case 'Grove/Node': {
      return __u24((grove_count(tree.left) + grove_count(tree.right)));
    }
  }
}
export function neutral_input() {
  return Input(0, 0, 0, 0, 0, 0);
}
export function replay(n, w) {
  if (Number(n == 0)) {
    return w;
  }
  else {
    return replay(__u24((n - 1)), step(w, neutral_input()));
  }
}
export function main() {
  const w = replay(240, initial());
  const p = w.player;
  const b = w.boss;
  return __u24((__u24((__u24((__u24((w.frame + p.damage)) + p.stocks)) + b.hp)) + grove_count(grove(4, 1, 0, 0, 600))));
}
export const sourceHash = '7c83f2b7d8d1f4495888a21c5f60c1a9fb381e3c4bd0e20a5ae07f1922f39d78';
