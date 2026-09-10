import Std

/-!
Executable integer contracts corresponding to the Bend combat rules, and the
algebraic laws used by the procedural engine. See PLAN.md for the paper proof.
These proofs do not assert correctness of the compiler, graphics driver, or the
entire running game. Native/browser conformance is checked separately by tests.
-/

namespace SuperSlash

/-- Saturating damage corresponds to Bend `sub`. -/
def damage (health amount : Nat) : Nat := health - amount

theorem damage_le_health (health amount : Nat) : damage health amount ≤ health := by
  simp [damage, Nat.sub_le]

theorem lethal_damage (health amount : Nat) (h : health ≤ amount) :
    damage health amount = 0 := by
  simp [damage, Nat.sub_eq_zero_of_le h]

theorem damage_zero (health : Nat) : damage health 0 = health := by
  simp [damage]

/-- The shield-hit contract; geometry and immunity determine `hit` elsewhere. -/
def blockedHit (percent shield : Nat) (blocking : Bool) : Nat × Nat :=
  if blocking && decide (18 ≤ shield) then (percent, shield - 18)
  else (min 300 (percent + 22), shield)

theorem block_preserves_damage (percent shield : Nat) (h : 18 ≤ shield) :
    (blockedHit percent shield true).1 = percent := by
  simp [blockedHit, h]

theorem block_consumes_exact_charge (percent shield : Nat) (h : 18 ≤ shield) :
    (blockedHit percent shield true).2 + 18 = shield := by
  simp [blockedHit, h]

/-- The recovery branch caps shield charge at 100. -/
def recharge (shield increment : Nat) : Nat := min 100 (shield + increment)

theorem recharge_bounded (shield increment : Nat) : recharge shield increment ≤ 100 := by
  exact Nat.min_le_left _ _

theorem recharge_monotone (shield increment : Nat) (h : shield ≤ 100) :
    shield ≤ recharge shield increment := by
  unfold recharge
  omega

/-- Landing replenishes two jump tokens. An accepted air jump consumes one. -/
def jumpTokens (tokens : Nat) (landed jumping : Bool) : Nat :=
  if landed then 2 else if jumping then tokens - 1 else tokens

theorem jump_tokens_bounded (tokens : Nat) (landed jumping : Bool) (h : tokens ≤ 2) :
    jumpTokens tokens landed jumping ≤ 2 := by
  cases landed <;> cases jumping <;> simp [jumpTokens] <;> omega

theorem landing_restores_jumps (tokens : Nat) (jumping : Bool) :
    jumpTokens tokens true jumping = 2 := by
  simp [jumpTokens]

theorem two_air_jumps_exhaust : jumpTokens (jumpTokens 2 false true) false true = 0 := by
  decide

/-- Bend uses signed coordinates after converting capped unsigned damage. -/
def knockback (percent : Nat) : Nat := 24 + min 28 (percent / 5)

theorem knockback_bounded (percent : Nat) : 24 ≤ knockback percent ∧ knockback percent ≤ 52 := by
  unfold knockback
  have h := Nat.min_le_left 28 (percent / 5)
  omega

/-- Full binary procedural data, with no array indexing. -/
inductive Tree (α : Type) where
  | leaf : α → Tree α
  | branch : Tree α → Tree α → Tree α
  deriving Repr

def Tree.count : Tree α → Nat
  | .leaf _ => 1
  | .branch left right => left.count + right.count

def Tree.map (f : α → β) : Tree α → Tree β
  | .leaf a => .leaf (f a)
  | .branch left right => .branch (left.map f) (right.map f)

theorem map_preserves_leaf_count (f : α → β) (tree : Tree α) :
    (tree.map f).count = tree.count := by
  induction tree with
  | leaf value => rfl
  | branch left right hl hr => simp [Tree.map, Tree.count, hl, hr]

def Tree.sum (f : α → Nat) : Tree α → Nat
  | .leaf a => f a
  | .branch left right => left.sum f + right.sum f

theorem independent_branch_sum (f : α → Nat) (left right : Tree α) :
    (Tree.branch left right).sum f = left.sum f + right.sum f := by
  rfl

theorem map_sum_fusion (f : α → β) (g : β → Nat) (tree : Tree α) :
    (tree.map f).sum g = tree.sum (fun x ↦ g (f x)) := by
  induction tree with
  | leaf value => rfl
  | branch left right hl hr => simp [Tree.map, Tree.sum, hl, hr]

/-- One axis of a conservative BVH. The 3D box test is a conjunction of axes. -/
structure Interval where
  lo : Int
  hi : Int
  deriving Repr

def Interval.Contains (box : Interval) (x : Int) : Prop := box.lo ≤ x ∧ x ≤ box.hi

def Interval.Disjoint (a b : Interval) : Prop := a.hi < b.lo ∨ b.hi < a.lo

theorem conservative_interval_pruning (box query : Interval) (x : Int)
    (inside : box.Contains x) (separated : box.Disjoint query) : ¬query.Contains x := by
  simp only [Interval.Contains, Interval.Disjoint] at *
  omega

def Tree.All (p : α → Prop) : Tree α → Prop
  | .leaf a => p a
  | .branch left right => left.All p ∧ right.All p

theorem disjoint_bounds_exclude_all_leaves (box query : Interval) (tree : Tree Int)
    (contained : tree.All box.Contains) (separated : box.Disjoint query) :
    tree.All (fun x ↦ ¬query.Contains x) := by
  induction tree with
  | leaf x => exact conservative_interval_pruning box query x contained separated
  | branch left right hl hr => exact ⟨hl contained.1, hr contained.2⟩

def Tree.queryCount (query : Interval) : Tree Int → Nat
  | .leaf x => if query.lo ≤ x ∧ x ≤ query.hi then 1 else 0
  | .branch left right => left.queryCount query + right.queryCount query

theorem pruned_query_is_empty (box query : Interval) (tree : Tree Int)
    (contained : tree.All box.Contains) (separated : box.Disjoint query) :
    tree.queryCount query = 0 := by
  induction tree with
  | leaf x =>
    have h := conservative_interval_pruning box query x contained separated
    simpa [Tree.queryCount, Interval.Contains] using h
  | branch left right hl hr =>
    simp [Tree.queryCount, hl contained.1, hr contained.2]

end SuperSlash

#print axioms SuperSlash.damage_le_health
#print axioms SuperSlash.lethal_damage
#print axioms SuperSlash.block_preserves_damage
#print axioms SuperSlash.block_consumes_exact_charge
#print axioms SuperSlash.recharge_bounded
#print axioms SuperSlash.recharge_monotone
#print axioms SuperSlash.jump_tokens_bounded
#print axioms SuperSlash.landing_restores_jumps
#print axioms SuperSlash.two_air_jumps_exhaust
#print axioms SuperSlash.knockback_bounded
#print axioms SuperSlash.map_preserves_leaf_count
#print axioms SuperSlash.independent_branch_sum
#print axioms SuperSlash.map_sum_fusion
#print axioms SuperSlash.conservative_interval_pruning
#print axioms SuperSlash.disjoint_bounds_exclude_all_leaves
#print axioms SuperSlash.pruned_query_is_empty
