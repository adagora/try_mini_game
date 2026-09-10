# Super Slash Boss 3D

- [ ] Implement and natively validate the Bend simulation and procedural tree generators.
- [ ] Build an offline browser backend with pure scene trees, BVH culling, GPU instancing,
      worker-generated geometry, procedural animation, destruction, and synthesized audio.
- [ ] Deliver the eclipse shrine, katana boss, platforming, attacks, shields, and complete match flow.
- [x] Verify combat arithmetic, jump bounds, and spatial tree laws in Lean.
- [ ] Test native/browser conformance, gameplay scenarios, actual keyboard input, and rendering.
- [ ] Inspect screenshots, fix discovered bugs with a dedicated agent, and document results.

## Proof argument, before implementation

Health is a natural number. Saturating damage is `health - damage`, so it never exceeds
the original health; sufficient damage reduces it to zero. A blocking hit with enough
shield leaves health unchanged and subtracts a bounded amount from the shield. Shield
recovery is capped, hence cannot exceed capacity. Jump consumes one of two jump tokens;
landing restores exactly two, so accepted jumps preserve the bound. Knockback is capped
by construction. These are integer rules in the Bend simulation, modeled over Lean Nat
or Int, not claims about floating-point rendering or whole-program correctness.

A nonempty spatial tree has leaf and branch constructors. Mapping its leaves preserves
leaf count (structural induction), and folding a branch equals the sum of independent
folds. The Lean tree models this nonempty part; the JavaScript empty constructor is not
included in those theorems. Conservative region pruning is safe when the cached bounds contain every leaf:
if a query misses the bounds, it cannot contain a leaf. Prove the interval implication
separately, then the tree query preservation by induction with an explicit containment
invariant. This justifies partitioned generation and culling, without claiming a proof
of the JavaScript compiler, WebGL driver, or all geometry code.

## Lean obligations

- [x] Repair and recheck exact shield consumption: under `18 ≤ shield`, the blocked
      branch returns `shield - 18`, and natural subtraction cancellation gives
      `(shield - 18) + 18 = shield`. The existing `simp` closes this whole obligation;
      remove the subsequent tactic without changing the theorem statement.
- [x] Saturating damage never increases health, zero damage is neutral, and lethal damage reaches zero.
- [x] Blocked hits preserve damage percentage and consume exactly 18 shield charge.
- [x] Shield regeneration capacity and double-jump bounds.
- [x] Knockback cap.
- [x] Tree map count preservation and independent branch folding.
- [x] Conservative interval pruning, with explicit containment assumptions.

Validation: all 17 theorems compile through `npm run test:lean` with warnings treated
as errors. No `sorry`, `admit`, custom axiom declarations, or `sorryAx` dependencies
remain. Axiom inspection finds only Lean's standard `propext`, `Quot.sound`, and
`Classical.choice` dependencies, where used.

Correspondence limits: these are executable mathematical contracts, not a formal
translation of the whole Bend program. The shield-hit contract describes an actual
collision using the charge after movement's per-frame drain, and assumes the game's
reachable damage range `0..300` when relating preserved percentage to Bend's cap.
Natural arithmetic agrees with Bend for these bounded, non-overflowing combat values;
the jump Boolean represents an accepted jump. Integer interval pruning assumes leaf
containment and does not verify the floating-point frustum or generated mesh bounds.

## Implementation decision

“Bend” means HigherOrderCO's language. Ship the authoritative `.bend` source and run it
with the native interpreter during verification. For instant offline browser play,
compile a small, documented first-order subset to an ES module at build time. The
browser does not launch native processes per frame. Native-vs-browser fixtures cover
the supported numeric domain. This is a project-specific backend, not a complete Bend
compiler. Ordinary arrays are excluded from simulation and scene data; packed typed
buffers exist only at WebGL/worker I/O boundaries, where the graphics API requires them.
