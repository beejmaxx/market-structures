# C++ and Rust engineering

<p class="chapter-subtitle">Compare mechanisms and engineering constraints; languages do not execute in the abstract.</p>

C++ and Rust can both produce native code with explicit layouts, bounded storage,
custom data structures, atomics, and no garbage collector. That does not imply
identical performance, and it does not make “which language is faster?” a
well-formed universal question.

```text
source language
  -> API and ownership choices
  -> representation and algorithms
  -> compiler transformations and generated code
  -> target CPU + operating state
  -> observed workload distribution
```

Language constraints influence every arrow. The experiment must identify which
arrow changed.

## Three comparison modes

Keep these names in result reports:

| Mode | Fixed | Allowed to differ | Question |
|---|---|---|---|
| layout-equivalent | semantics, trace, fields, sizes, layout, algorithm | syntax, compiler | does generated work differ under the same representation? |
| standard baseline | semantics, trace, broad container contract | standard containers and idioms | what does a competent accessible version deliver? |
| best defended | semantics, trace, capacity and outputs | representation, safe/unsafe boundary, idioms | what engineering result can each language justify? |

The first is a controlled language/code-generation experiment. The second is a
learning and productivity baseline. The third is usually the practical goal.
Do not use layout parity as the permanent mission; it can force one language to
imitate the other's weaknesses.

## Shared semantic core

Before writing both implementations, define a language-neutral model:

```text
fixed-width wire values
operation and error enums
price/quantity arithmetic rules
capacity policy
matching and priority semantics
trade/output order
canonical state hash
versioned trace format
```

The model should not expose a C++ pointer or Rust borrow. Each runner converts
trace records into its internal form and emits the same observable results.

Use a deliberately slow reference model. Cross-language final equality is not
enough: compare operation results and state hashes at trace checkpoints so the
first divergence is reproducible.

## C++: control with convention and review

C++ offers direct expression of intrusive structures, stable pooled pointers,
placement construction, allocator-aware containers, templates, and atomics.
RAII ties resource release to object lifetime. The language permits designs
whose validity depends on programmer-maintained lifetime and aliasing rules.

```cpp
struct OrderPool {
    Handle allocate(OrderInit);
    Order* get(Handle) noexcept;
    bool free(Handle) noexcept;
};
```

The pointer is convenient once validated. Review must ensure it does not outlive
the handle generation, pool, vector capacity, or owning book. C++ object
lifetime rules are formal and subtle; storage reuse does not make every old
pointer valid. See the standard's [object lifetime](https://eel.is/c++draft/basic.life)
rules.

Strengths for this work include:

- mature low-level libraries and profiler/debugger support;
- natural pointer-based intrusive structures;
- explicit allocation and object lifetime control;
- templates that specialize representations without virtual dispatch; and
- broad interoperability with existing exchange and systems code.

Engineering risks include:

- undefined behavior from lifetime, bounds, aliasing, data-race, and signed-
  overflow mistakes;
- implicit copies/moves or allocator paths hidden behind high-level operations;
- iterator/reference invalidation that varies by container and mutation;
- exception paths crossing code assumed to be fixed-latency; and
- build modes whose macros and flags change semantics.

None is a verdict against C++; each demands evidence and a narrow invariant.

## Rust: encode ownership, isolate escape hatches

Rust makes ownership, borrowing, and thread-safety constraints part of type
checking. `Option`, `Result`, enums, iterators, generics, and RAII-style `Drop`
support expressive zero-overhead abstractions when optimized as intended.

```rust
struct OrderPool {
    slots: Vec<Slot<Order>>,
    free: Vec<u32>,
}

fn get(&self, handle: Handle) -> Option<&Order>;
fn get_mut(&mut self, handle: Handle) -> Option<&mut Order>;
```

Generational indices work naturally because borrows remain short. A raw-pointer
intrusive representation may require `unsafe` for dereference, lifetime, and
aliasing operations. `unsafe` does not disable the rules; it makes the block
responsible for upholding them. The
[Rustonomicon](https://doc.rust-lang.org/nomicon/) describes many of these
contracts.

Strengths for this work include:

- compiler-enforced ordinary ownership and race prevention;
- explicit recoverable errors and exhaustive state enums;
- slices and iterators that carry bounds and length;
- strong tooling around formatting, tests, dependencies, and builds; and
- the ability to confine low-level invariants behind a safe API.

Engineering costs can include:

- self-referential/intrusive graphs requiring handles or carefully reviewed
  unsafe code;
- borrow structure influencing algorithm decomposition even when runtime work
  should be unchanged;
- a smaller pool of domain-specific HFT libraries and experienced reviewers;
- generic monomorphization increasing build time or code footprint; and
- panic/overflow/allocator configuration that must be frozen for deployment.

Again, these are design inputs, not speed rankings.

## Bounds checks and alias information

Rust indexing checks bounds unless the optimizer proves safety; iterators and
well-shaped loops often make proofs easy. C++ unchecked indexing avoids a branch
but makes out-of-range access undefined. A bounds check that predicts or is
eliminated may cost nothing measurable; a check on a critical unpredictable
path may matter.

Compare in this order:

1. write clear safe Rust and correct C++;
2. inspect optimized assembly or compiler diagnostics;
3. measure a targeted loop;
4. reshape iteration so bounds are structurally evident; and
5. use unchecked access only behind a proved precondition when it changes the
   result materially.

Rust reference exclusivity can give optimizers useful alias information. C++
compilers can infer non-aliasing in many contexts and offer target extensions,
but the source-level pointer model differs. Do not attribute a code-generation
difference to “safety overhead” until instruction and memory access paths are
examined.

## Pointers versus handles

This is the most important representation fork for the book:

| Need | C++ pointer design | Shared handle design |
|---|---|---|
| direct intrusive links | very natural | one base/index lookup |
| relocation | difficult; repair pointers | update slot/indirection policy |
| stale reuse detection | external discipline/tag | generation in handle |
| Rust safe implementation | usually not direct | natural short borrows |
| compact links | full pointer width | 32-bit index may suffice |
| layout-equivalent test | raw pointers in both, unsafe Rust | handles in both |

Build both handle-based versions first if cross-language learning is the goal.
Then allow C++ pointers or Rust-specific storage in the best-defended mode.
Measure the extra base lookup rather than assuming it matters.

## Standard containers are different designs

`std::unordered_map` and Rust `HashMap` do not promise identical collision
policy, iteration order, hasher, node layout, growth, or allocator behavior.
`std::map` and `BTreeMap` share ordered-map semantics but need not share a tree
shape. `std::deque` and `VecDeque` both provide double-ended queues while using
different specified and implementation details.

A standard-container comparison is valid when labeled as such. It is not a
controlled language-only experiment. Record implementation versions, reserve
capacity, choose hash threat policy consciously, and instrument allocations.

## Allocation and failure policy

C++ container operations may allocate and may throw according to type and
allocator behavior. Deployments sometimes change exception support, but that is
a toolchain policy with consequences. `noexcept` is a semantic promise: a
violating exception terminates.

Rust allocations in standard collections can also fail at process or allocator
policy boundaries; reservation APIs include fallible variants for some cases.
`Result` expresses domain failures such as Full, Duplicate, and Stale without
unwinding. Panics may unwind or abort according to build configuration.

For the hot path in both languages, preallocate, expose capacity failures in the
API, and keep unexpected resource exhaustion outside ordinary operation logic.
Do not benchmark one version's checked Full result against another version's
unbounded growth.

## Arithmetic semantics

Price, quantity, sequence, generation, and counter arithmetic must match.
Unsigned fixed-width arithmetic wraps modulo the type width in both languages,
but relying on wrap is correct only when the algorithm proves it. C++ signed
overflow is undefined. Rust overflow behavior can depend on operation and build
configuration.

Use explicit checked, wrapping, saturating, or widened arithmetic where the
contract calls for it. Test boundaries and freeze compiler overflow settings.
Different arithmetic failure behavior is a semantic mismatch, not performance.

## Errors, exceptions, and panics

Expected engine outcomes should be ordinary values:

```text
Added | Traded | DuplicateId | MissingId | Full | InvalidQuantity
```

C++ can use an enum/result type or `std::expected` where the selected standard
library level supports it. Rust uses `Result<T, E>`. Reserve exceptions/panics
for genuinely exceptional invariant or environment failures according to the
deployment policy.

Measure the success path and each expected failure path. A result type can
compile to a branch and compact tag; an exception path changes control flow and
binary metadata. Source-level aesthetics do not predict the emitted normal path.

## Unsafe code and undefined behavior strategy

The C++ implementation should run sanitizers in test configurations, use debug
validators, keep owners obvious, minimize raw allocation, and document every
pointer/reference invalidation boundary.

The Rust implementation should keep unsafe modules tiny, document each safety
precondition, expose only safe checked operations, and exercise aliasing,
initialization, and drop behavior with specialized test tools where available.

Neither dynamic testing proves absence of undefined behavior. Prefer
representations with smaller proof surfaces unless a measured gain justifies the
complexity.

## Build and code-generation parity

Record complete commands, not “release mode.” Align:

- optimization level and debug assertions;
- target architecture/CPU features;
- link-time optimization choice;
- panic, exception, and overflow policy;
- allocator and link mode;
- thread-affinity environment; and
- dependency/library versions.

Binary size and instruction-cache footprint are outputs worth recording. Whole-
program optimization can inline or remove boundaries differently. Inspect the
actual function reached in the benchmark, not a source snippet compiled alone.

## Performance-difference triage

When one result differs, investigate in this order:

```text
1. semantic/output equality
2. trace and timed-boundary equality
3. operation and failure-path counts
4. allocation/capacity behavior
5. object sizes and access-path layout
6. algorithmic work: probes, traversal, moves
7. optimized assembly and vectorization
8. hardware counters and OS outliers
9. language/toolchain constraint that caused the mechanism
```

Stopping at “Rust is safer” or “C++ is faster” leaves the useful knowledge gap
untouched.

## Decision matrix

| Constraint | First representation to try | Reason |
|---|---|---|
| easiest correct baseline | standard maps + values/handles | simple oracle and semantics |
| bounded book, shared design | array pool + generational handles | portable invariants in both languages |
| C++-only stable pool | intrusive pointers | direct local rewiring |
| dense tick domain | level array + bitmap | language-independent direct navigation |
| read-heavy price index | sorted vector / flat map | dense traversal |
| one producer/consumer | bounded SPSC ring | ownership proof avoids CAS |
| FFI/wire boundary | explicit decoder + fixed-width DTO | isolate representation contract |

This table selects a starting experiment. Workload evidence can overturn it.

## Failure modes

- source translations look similar but container algorithms/layouts differ;
- an unsafe Rust version is written before a safe baseline establishes need;
- C++ undefined behavior produces a spectacular but invalid benchmark;
- bounds checks are blamed without inspecting generated code;
- build flags change arithmetic, errors, or CPU instructions;
- standard containers are presented as a pure language comparison;
- layout parity becomes the product goal instead of an experimental control; or
- one best run becomes a permanent claim about two languages.

## Build the comparison suite

For the pool, ID map, SPSC queue, and two order books from prior chapters:

1. specify one semantic API and trace format;
2. build a standard baseline in each language;
3. build a shared handle/layout representation;
4. build each language's best-defended representation;
5. add cross-language state and result hashes;
6. capture type/layout reports and allocation counts; and
7. retain optimized assembly for the smallest decisive hot functions.

For every unsafe/raw-pointer optimization, write the invariant and a safe/handle
fallback next to the benchmark result. Delete optimizations that do not survive
the component workload.

## Measure and report

Use the benchmark ladder and common metadata schema. Report performance by
representation mode, not only language name. Include correctness evidence,
build commands, trace identity, type sizes, allocations, latency distributions,
throughput, counters tied to predictions, and threats to validity.

The best conclusion may be asymmetric: C++ direct pointers could win one local
mutation while Rust handles make compaction, validation, or concurrent ownership
safer to evolve. Engineering decisions include performance, proof burden,
maintainability, integration, and team expertise.

## Checkpoint

Explain:

- the three comparison modes and why none replaces the others;
- how ownership rules can change representation without adding runtime work;
- why standard-container results are not language-only results;
- the evidence required before using unchecked/unsafe access; and
- how to trace a performance difference from measurement back to a language
  constraint without confusing correlation for cause.

Next: [Capstone and defense](18-capstone-defense.md).
