import { v, sub, cross, normalize, point } from './math.js';
import { leaf, branch, generate, map, combine } from './tree.js';
export const triangle = (a, b, c) => ({ a, b, c, normal: normalize(cross(sub(b, a), sub(c, a))) });
export const quad = (a, b, c, d) => branch(leaf(triangle(a, b, c)), leaf(triangle(a, c, d)));
export const transformMesh = (tree, m) => map(tree, t => triangle(point(m, t.a), point(m, t.b), point(m, t.c)));
export function box() {
  const face = (axis, side) => {
    const a = (u, w) => axis === 0 ? v(side, u, w) : axis === 1 ? v(w, side, u) : v(u, w, side);
    return quad(a(-.5, -.5), a(.5, -.5), a(.5, .5), a(-.5, .5));
  };
  return combine(branch(face(0, -.5), face(0, .5)), branch(face(1, -.5), face(1, .5)), branch(face(2, -.5), face(2, .5)));
}
export function cylinder(sides = 8, taper = 1) {
  const section = i => {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    const p = (angle, y, radius) => v(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    return combine(quad(p(a, -.5, .5), p(b, -.5, .5), p(b, .5, .5 * taper), p(a, .5, .5 * taper)),
      leaf(triangle(v(0, .5, 0), p(a, .5, .5 * taper), p(b, .5, .5 * taper))),
      leaf(triangle(v(0, -.5, 0), p(b, -.5, .5), p(a, -.5, .5))));
  };
  const join = (start, end) => end - start === 1 ? section(start) :
    branch(join(start, (start + end) >> 1), join((start + end) >> 1, end));
  return join(0, sides);
}
export function crystal() {
  const ring = (a, y) => v(Math.cos(a) * .5, y, Math.sin(a) * .5);
  return flatten(generate(0, 6, i => {
    const a = i * Math.PI / 3, b = (i + 1) * Math.PI / 3;
    return branch(leaf(triangle(v(0, .5, 0), ring(a, -.1), ring(b, -.1))),
      leaf(triangle(v(0, -.5, 0), ring(b, -.1), ring(a, -.1))));
  }));
}
export function flatten(t) {
  if (t.tag === 'empty') return t;
  return t.tag === 'leaf' ? t.value : branch(flatten(t.left), flatten(t.right));
}
// Actual per-frame mesh deformation: a moving ribbon sampled as a balanced tree.
export function ribbon(time, radius, width, start, sweep, lift = .1) {
  const p = (i, outer) => {
    const t = i / 40, a = start + t * sweep;
    const r = radius + outer * width * Math.sin(Math.PI * t);
    return v(Math.cos(a) * r, lift * Math.sin(t * 9 + time * 7), Math.sin(a) * r);
  };
  return flatten(generate(0, 40, i => quad(p(i, 0), p(i + 1, 0), p(i + 1, 1), p(i, 1))));
}
