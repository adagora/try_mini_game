export const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = a => Math.hypot(a.x, a.y, a.z);
export const normalize = a => scale(a, 1 / (length(a) || 1));
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp = (a, min, max) => Math.max(min, Math.min(max, a));
export const color = (r, g, b, glow = 0) => ({ r, g, b, glow });
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const identity = Object.freeze({ x: v(1, 0, 0), y: v(0, 1, 0), z: v(0, 0, 1), p: v() });
export function transform(x, y, z, sx = 1, sy = sx, sz = sx, yaw = 0, roll = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  return { x: v(c * cr * sx, sr * sx, -s * cr * sx),
    y: v(-c * sr * sy, cr * sy, s * sr * sy), z: v(s * sz, 0, c * sz), p: v(x, y, z) };
}
export const vector = (m, p) => add(add(scale(m.x, p.x), scale(m.y, p.y)), scale(m.z, p.z));
export const point = (m, p) => add(m.p, vector(m, p));
export const compose = (a, b) => ({ x: vector(a, b.x), y: vector(a, b.y), z: vector(a, b.z), p: point(a, b.p) });
export function between(a, b, width, depth = width) {
  const y = sub(b, a), up = normalize(y);
  const x = scale(normalize(cross(Math.abs(up.z) > .95 ? v(1, 0, 0) : v(0, 0, 1), up)), width);
  return { x, y, z: scale(normalize(cross(x, y)), depth), p: scale(add(a, b), .5) };
}
export function boundsOf(item) {
  // Meshes fit the unit box except rods/spires whose generators also honor it.
  const m = item.transform;
  const x = (Math.abs(m.x.x) + Math.abs(m.y.x) + Math.abs(m.z.x)) * .72;
  const y = (Math.abs(m.x.y) + Math.abs(m.y.y) + Math.abs(m.z.y)) * .72;
  const z = (Math.abs(m.x.z) + Math.abs(m.y.z) + Math.abs(m.z.z)) * .72;
  return { minX: m.p.x - x, maxX: m.p.x + x, minY: m.p.y - y, maxY: m.p.y + y,
    minZ: m.p.z - z, maxZ: m.p.z + z };
}
export function camera(eye, target, aspect, fov = .77) {
  const forward = normalize(sub(target, eye)), right = normalize(cross(forward, v(0, 1, 0)));
  const up = cross(right, forward), tangent = Math.tan(fov / 2);
  return { eye, forward, right, up, aspect, tangent,
    test: box => {
      const center = v((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2);
      const radius = Math.hypot(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ) / 2;
      const d = sub(center, eye), z = dot(d, forward);
      return z + radius > .1 && z - radius < 180 &&
        Math.abs(dot(d, right)) <= z * tangent * aspect + radius * Math.hypot(1, tangent * aspect) &&
        Math.abs(dot(d, up)) <= z * tangent + radius * Math.hypot(1, tangent);
    }
  };
}
