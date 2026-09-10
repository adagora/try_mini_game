# Authoritative, pure, fixed-timestep simulation. Distances are signed centimetres.
# Counts are u24, coordinates i24; reachable values stay well inside 24-bit bounds.
# This first-order subset also compiles to the offline browser backend.
object Input { x: i24, z: i24, jump: u24, attack: u24, special: u24, shield: u24 }
object Player { x: i24, y: i24, z: i24, vx: i24, vy: i24, vz: i24, face: i24, jumps: u24, damage: u24, shield: u24, energy: u24, cooldown: u24, attack: u24, hurt: u24, stocks: u24, blocking: u24, invulnerable: u24, attack_kind: u24 }
object Boss { x: i24, z: i24, hp: u24, timer: u24, phase: u24, aimx: i24, aimz: i24, mode: u24, hit: u24 }
object World { frame: u24, player: Player, boss: Boss, status: u24, combo: u24, best: u24 }
object Prop { id: u24, x: i24, z: i24, height: u24, kind: u24 }
type Grove = (Node ~left ~right) | (Leaf value)

def pick(c: u24, a: T, b: T) -> T:
  if c:
    return a
  else:
    return b

def low(a: _, b: _) -> _:
  if a < b:
    return a
  else:
    return b

def high(a: _, b: _) -> _:
  if a > b:
    return a
  else:
    return b

def sub(a: u24, b: u24) -> u24:
  if a > b:
    return a - b
  else:
    return 0

def abs_i(x: i24) -> i24:
  if x < +0:
    return +0 - x
  else:
    return x

def sign_i(x: i24) -> i24:
  if x < +0:
    return -1
  else:
    return +1

def clamp_i(x: i24, a: i24, b: i24) -> i24:
  return high(a, low(b, x))

def sqdist(x: i24, z: i24, a: i24, b: i24) -> i24:
  return (x - a) * (x - a) + (z - b) * (z - b)

def spawn_player(stocks: u24) -> Player:
  return Player(-330, +0, +40, +0, +0, +0, +1, 2, 0, 100, 100, 0, 0, 0, stocks, 0, 90, 0)

def initial() -> World:
  return World(0, spawn_player(3), Boss(+350, +0, 720, 0, 1, -330, +40, 0, 0), 0, 0, 0)

# Three raised one-way platforms above the central disk. Previous height is used
# for swept landing so a fast descent cannot tunnel through a platform.
def platform(x: i24, z: i24, oldy: i24, newy: i24, vy: i24) -> i24:
  if (vy <= +0) & (oldy >= +195) & (newy <= +195) & (abs_i(x + +490) < +155) & (abs_i(z + +210) < +115):
    return +195
  elif (vy <= +0) & (oldy >= +280) & (newy <= +280) & (abs_i(x) < +140) & (abs_i(z + +360) < +95):
    return +280
  elif (vy <= +0) & (oldy >= +195) & (newy <= +195) & (abs_i(x - +490) < +155) & (abs_i(z + +210) < +115):
    return +195
  elif (newy <= +0) & (oldy >= +0) & (sqdist(x, z, +0, +0) < +640000):
    return +0
  else:
    return -9999

def move_player(p: Player, i: Input, frame: u24) -> Player:
  open Player: p
  open Input: i
  blocking = i.shield & (p.shield > 0) & (p.hurt == 0)
  speed = pick(blocking, +5, +15)
  dx = pick(p.hurt > 28, p.vx, i.x * speed)
  dz = pick(p.hurt > 28, p.vz, i.z * speed)
  jumping = i.jump & (p.jumps > 0) & (p.hurt == 0)
  dy = pick(jumping, +37, high(-65, p.vy - +2))
  nx = p.x + dx
  nz = p.z + dz
  ny = p.y + dy
  floor = platform(nx, nz, p.y, ny, dy)
  landed = floor > -9999
  jumps = pick(landed, 2, sub(p.jumps, jumping))
  sh = pick(blocking, sub(p.shield, 1), low(100, p.shield + (frame % 2)))
  face = pick(i.x != +0, sign_i(i.x), p.face)
  return Player(nx, pick(landed, floor, ny), nz, dx, pick(landed, +0, dy), dz, face, jumps, p.damage, sh, low(100, p.energy + pick(frame % 8 == 0, 1, 0)), sub(p.cooldown, 1), sub(p.attack, 1), sub(p.hurt, 1), p.stocks, blocking, sub(p.invulnerable, 1), pick(p.attack > 1, p.attack_kind, 0))

def attack_player(p: Player, i: Input) -> Player:
  open Player: p
  open Input: i
  ready = (p.cooldown == 0) & (p.hurt == 0) & (p.blocking == 0)
  special = ready & i.special & (p.energy >= 30)
  normal = ready & i.attack & (special == 0)
  active = special | normal
  # Attack kind is separate from animation countdown: 0 idle, 1 neutral, 2 special.
  kind = pick(active, pick(special, 2, 1), p.attack_kind)
  return Player(p.x, p.y, p.z, p.vx, p.vy, p.vz, p.face, p.jumps, p.damage, p.shield, sub(p.energy, pick(special, 30, 0)), pick(active, pick(special, 42, 23), p.cooldown), pick(active, pick(special, 32, 16), p.attack), p.hurt, p.stocks, p.blocking, p.invulnerable, kind)

def move_boss(b: Boss, p: Player) -> Boss:
  open Boss: b
  open Player: p
  phase = pick(b.hp <= 360, 2, 1)
  cycle = pick(phase == 2, 172, 208)
  timer = (b.timer + 1) % cycle
  warning = (timer >= 65) & (timer < 112)
  slash = (timer >= 112) & (timer < 133)
  mode = pick(slash, 2, pick(warning, 1, pick(timer >= 133, 3, 0)))
  aimx = pick(timer == 65, p.x, b.aimx)
  aimz = pick(timer == 65, p.z, b.aimz)
  # Chebyshev-normalized dash: pure integer arithmetic, no sqrt needed.
  distance = high(+1, high(abs_i(aimx - b.x), abs_i(aimz - b.z)))
  dashx = (aimx - b.x) * +34 / distance
  dashz = (aimz - b.z) * +34 / distance
  walkx = pick(abs_i(p.x - b.x) > +220, sign_i(p.x - b.x) * +3, +0)
  walkz = pick(abs_i(p.z - b.z) > +80, sign_i(p.z - b.z) * +2, +0)
  dx = pick(slash, dashx, pick(mode == 0, walkx, +0))
  dz = pick(slash, dashz, pick(mode == 0, walkz, +0))
  return Boss(clamp_i(b.x + dx, -580, +580), clamp_i(b.z + dz, -440, +420), b.hp, timer, phase, aimx, aimz, mode, sub(b.hit, 1))

def player_hits(p: Player, b: Boss) -> u24:
  open Player: p
  open Boss: b
  special = (p.attack_kind == 2) & (p.attack == 31)
  neutral = (p.attack_kind == 1) & (p.attack == 15)
  range = pick(special, +150000, +85000)
  facing = ((b.x - p.x) * p.face > -80) | special
  return (special | neutral) & facing & (p.y < +340) & (sqdist(p.x, p.z, b.x, b.z) < range)

def damage_boss(b: Boss, p: Player) -> Boss:
  open Boss: b
  open Player: p
  hit = player_hits(p, b)
  amount = pick(p.attack_kind == 2, 64, 24)
  return Boss(b.x, b.z, sub(b.hp, pick(hit, amount, 0)), b.timer, b.phase, b.aimx, b.aimz, b.mode, pick(hit, 12, b.hit))

def boss_hits(b: Boss, p: Player) -> u24:
  open Boss: b
  open Player: p
  return (b.mode == 2) & (p.invulnerable == 0) & (p.y < +190) & (sqdist(p.x, p.z, b.x, b.z) < +145000)

def damage_player(p: Player, b: Boss) -> Player:
  open Player: p
  open Boss: b
  hit = boss_hits(b, p)
  blocked = hit & p.blocking & (p.shield >= 18)
  damaged = hit & (blocked == 0)
  damage = low(300, p.damage + pick(damaged, 22, 0))
  force = +24 + low(+28, u24/to_i24(damage / 5))
  vx = pick(damaged, sign_i(p.x - b.x) * force, p.vx)
  vz = pick(damaged, sign_i(p.z - b.z) * force / +2, p.vz)
  return Player(p.x, p.y, p.z, vx, pick(damaged, +23, p.vy), vz, p.face, p.jumps, damage, sub(p.shield, pick(blocked, 18, 0)), low(100, p.energy + pick(blocked, 12, 0)), p.cooldown, pick(damaged, 0, p.attack), pick(damaged, 48, p.hurt), p.stocks, p.blocking, pick(hit, 48, p.invulnerable), pick(damaged, 0, p.attack_kind))

def resolve_player(p: Player) -> Player:
  open Player: p
  if (p.y < -650) | (abs_i(p.x) > +1350) | (abs_i(p.z) > +1300):
    return spawn_player(sub(p.stocks, 1))
  else:
    return p

def step(w: World, i: Input) -> World:
  open World: w
  if w.status != 0:
    return w
  else:
    moved = move_player(w.player, i, w.frame)
    attacking = attack_player(moved, i)
    boss = move_boss(w.boss, attacking)
    damaged = damage_boss(boss, attacking)
    player = resolve_player(damage_player(attacking, damaged))
    open Player: player
    open Boss: damaged
    hit = player_hits(attacking, boss)
    combo = pick(player.hurt > 28, 0, w.combo + hit)
    status = pick(damaged.hp == 0, 1, pick(player.stocks == 0, 2, 0))
    return World(w.frame + 1, player, damaged, status, combo, high(w.best, combo))

# Divide-and-conquer procedural grove: each branch can reduce independently on HVM.
# Spatial split follows the bit path, giving a balanced, deterministic partition.
def grove(depth: u24, id: u24, x: i24, z: i24, span: i24) -> Grove:
  if depth == 0:
    return Grove/Leaf(Prop(id, x, z, 130 + id % 5 * 45, id % 3))
  else:
    next = span / +2
    left = grove(depth - 1, id * 2, x - next, z + pick(depth % 2, next, +0), next)
    right = grove(depth - 1, id * 2 + 1, x + next, z - pick(depth % 2, next, +0), next)
    return Grove/Node(left, right)

def grove_count(tree: Grove) -> u24:
  match tree:
    case Grove/Leaf:
      return 1
    case Grove/Node:
      return grove_count(tree.left) + grove_count(tree.right)

def neutral_input() -> Input:
  return Input(+0, +0, 0, 0, 0, 0)

def replay(n: u24, w: World) -> World:
  if n == 0:
    return w
  else:
    return replay(n - 1, step(w, neutral_input()))

def main() -> u24:
  w = replay(240, initial())
  open World: w
  p = w.player
  open Player: p
  b = w.boss
  open Boss: b
  return w.frame + p.damage + p.stocks + b.hp + grove_count(grove(4, 1, +0, +0, +600))
