// Native and browser backends execute these exact same Bend expressions.
export const numericValues = Object.freeze({
  quotient: -2, remainder: -1, nested: 3, unsigned_wrap: 0,
  unsigned_underflow: 16777215, signed_wrap: -8388608,
  signed_underflow: 8388607, cast_signed: -1, cast_unsigned: 16777215,
  comparison: 1, precedence: 17,
});

export const fixtures = `
object NumericProbe { quotient: i24, remainder: i24, nested: i24, unsigned_wrap: u24, unsigned_underflow: u24, signed_wrap: i24, signed_underflow: i24, cast_signed: i24, cast_unsigned: u24, comparison: u24, precedence: u24 }

def numeric_probe() -> NumericProbe:
  return NumericProbe(-7 / +3, -7 % +3, (+37 / +5 + +2) / +3, 16777215 + 1, 0 - 1, +8388607 + +1, -8388608 - +1, u24/to_i24(16777215), i24/to_u24(-1), +3 > -1, 2 + 3 * 5)

def scripted_input(frame: u24) -> Input:
  direction = pick(frame % 160 < 80, +1, -1)
  sideways = pick(frame % 200 < 100, -1, +1)
  return Input(direction, sideways, frame % 43 == 0, frame % 5 == 0, frame % 83 == 0, (frame % 208 >= 65) & (frame % 208 < 133))

def scripted_replay(n: u24, w: World) -> World:
  open World: w
  if n == 0:
    return w
  else:
    return scripted_replay(n - 1, step(w, scripted_input(w.frame)))

def combat_input(w: World) -> Input:
  open World: w
  p = w.player
  b = w.boss
  open Player: p
  open Boss: b
  dx = b.x - p.x
  dz = b.z - p.z
  return Input(pick(abs_i(dx) > +170, sign_i(dx), +0), pick(abs_i(dz) > +50, sign_i(dz), +0), 0, 1, 1, b.mode == 1)

def combat_replay(n: u24, w: World) -> World:
  if n == 0:
    return w
  else:
    return combat_replay(n - 1, step(w, combat_input(w)))

def probe_initial() -> World:
  return initial()

def probe_idle() -> World:
  return replay(240, initial())

def probe_slash() -> World:
  return replay(124, initial())

def probe_scripted() -> World:
  return scripted_replay(480, initial())

def probe_combat() -> World:
  return combat_replay(900, initial())
`;

export const nativeProbes = Object.freeze([
  'numeric_probe', 'probe_initial', 'probe_slash', 'probe_idle', 'probe_scripted', 'probe_combat', 'main',
]);

export function numbersInTree(value) {
  if (typeof value === 'number') return [value];
  return Object.entries(value).flatMap(([key, child]) => key === 'tag' ? [] : numbersInTree(child));
}
