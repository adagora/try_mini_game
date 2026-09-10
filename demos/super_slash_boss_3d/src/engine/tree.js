// Immutable algebraic scene data. Buffers belong exclusively to the graphics boundary.
export const empty = Object.freeze({ tag: 'empty', count: 0 });
export const leaf = value => ({ tag: 'leaf', value, count: 1 });
export const branch = (left, right) => left === empty ? right : right === empty ? left :
  ({ tag: 'branch', left, right, count: left.count + right.count });
export function generate(start, end, fn) {
  if (end <= start) return empty;
  if (end - start === 1) return leaf(fn(start));
  const mid = start + Math.floor((end - start) / 2);
  return branch(generate(start, mid, fn), generate(mid, end, fn));
}
export function map(tree, fn) {
  if (tree.tag === 'empty') return tree;
  return tree.tag === 'leaf' ? leaf(fn(tree.value)) : branch(map(tree.left, fn), map(tree.right, fn));
}
export function fold(tree, initial, fn) {
  if (tree.tag === 'empty') return initial;
  return tree.tag === 'leaf' ? fn(initial, tree.value) : fold(tree.right, fold(tree.left, initial, fn), fn);
}
export function visit(tree, fn) {
  if (tree.tag === 'leaf') fn(tree.value);
  else if (tree.tag === 'branch') { visit(tree.left, fn); visit(tree.right, fn); }
}
export function filter(tree, predicate) {
  if (tree.tag === 'empty') return tree;
  if (tree.tag === 'leaf') return predicate(tree.value) ? tree : empty;
  return branch(filter(tree.left, predicate), filter(tree.right, predicate));
}
export const combine = (a, b, c = empty, d = empty) => branch(branch(a, b), branch(c, d));

// Persistent integer trie, used for destruction timestamps and bounded event history.
export function get(tree, key) {
  if (!tree) return undefined;
  if (key === 0) return tree.value;
  return get(key & 1 ? tree.right : tree.left, key >>> 1);
}
export function set(tree, key, value) {
  if (key === 0) return { ...tree, value };
  return key & 1 ? { ...tree, right: set(tree?.right, key >>> 1, value) } :
    { ...tree, left: set(tree?.left, key >>> 1, value) };
}

export const union = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
  minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY),
  minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) });
export function bvh(tree, boundsOf) {
  if (tree.tag === 'empty') return tree;
  if (tree.tag === 'leaf') return { ...tree, bounds: boundsOf(tree.value) };
  const left = bvh(tree.left, boundsOf), right = bvh(tree.right, boundsOf);
  return { ...tree, left, right, bounds: union(left.bounds, right.bounds) };
}
export function visible(tree, test, fn, stats) {
  if (tree.tag === 'empty') return;
  stats.visited++;
  if (!test(tree.bounds)) { stats.culled += tree.count; return; }
  if (tree.tag === 'leaf') fn(tree.value);
  else { visible(tree.left, test, fn, stats); visible(tree.right, test, fn, stats); }
}
