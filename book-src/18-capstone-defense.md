# Capstone and defense

<p class="chapter-subtitle">Build one result you can explain from semantic contract to CPU mechanism—and survive skeptical review.</p>

The mission of this book is now concrete:

> Learn to choose and defend data structures for low-latency systems by
> connecting workload, invariants, representation, machine behavior, and
> measurement—using C++ and Rust as two engineering lenses.

The capstone is not “build the fastest matching engine.” That target has no
fixed workload, feature set, machine, or stopping point. The capstone is a
reproducible defense of one useful design decision.

```text
declared semantics
  -> proved representation invariants
  -> frozen workload
  -> mechanism prediction
  -> controlled measurement
  -> evidence-bounded conclusion
```

## The project brief

Build a single-instrument price-time-priority limit order book with:

- add, cancel, quantity reduction, price-changing replace, and matching;
- integer order IDs, prices, and quantities with explicit overflow rules;
- BBO and configurable depth snapshots;
- a fixed-capacity mode with explicit Full behavior;
- a canonical trace and output/state hash;
- a slow reference model; and
- at least two representation hypotheses.

Implement a correct baseline in both C++ and Rust. Then choose specialization
according to the question:

- for a **language-focused** question, implement the same controlled layout in
  both languages;
- for a **representation-focused** question, compare designs within one language
  first, then port only the surviving mechanism; or
- for an **engineering-outcome** question, allow each language its best-defended
  design while keeping semantics and workload fixed.

This prevents parity work from consuming the project when parity is not the
question.

<div class="ms-lab" data-ms-capstone>
  <div class="ms-lab-head">
    <div><span>DEFENSE GATES</span><h3>Earn the benchmark</h3></div>
    <p>Toggle a gate only when its artifact exists. Performance is the fourth gate, not the first.</p>
  </div>
  <div class="ms-capstone-gates" data-capstone-gates></div>
  <div class="ms-stats" aria-live="polite">
    <div><span>gates passed</span><strong data-stat="passed">0 / 5</strong></div>
    <div><span>next gate</span><strong data-stat="next">semantics</strong></div>
    <div><span>benchmark ready</span><strong data-stat="ready">no</strong></div>
    <div><span>defense status</span><strong data-stat="status">not started</strong></div>
  </div>
  <p class="ms-log" data-capstone-log>Start by versioning the semantic contract and trace schema.</p>
</div>

## Minimum viable defense

The minimum version is deliberately smaller than a production exchange:

1. one versioned semantic contract;
2. one reference model;
3. one C++ baseline and one Rust baseline;
4. one optimization hypothesis and one relevant alternative;
5. randomized differential tests and structural validators;
6. a common trace suite and result schema;
7. a reproducible benchmark on one documented machine; and
8. a short report that may reject the optimization.

No networking, persistence, risk engine, multi-instrument sharding, lock-free
pipeline, or complex order types are required. Add them only when the research
question needs them.

## Candidate hypotheses

Choose one primary hypothesis. Good examples are narrow enough to fail:

### LIFO pool reuse

> Under top-heavy add/cancel churn with a bounded live set, a LIFO fixed pool
> reduces allocation latency variance and active cache/TLB footprint relative
> to general allocation and FIFO reuse.

Measure allocate/free tails, reuse distance, pages/lines touched, high-water
mark, and component-level operation latency.

### Dense price occupancy

> Within a bounded, mostly dense active price window, direct levels plus a
> hierarchical bitmap reduce best-price repair and level navigation latency
> relative to an ordered tree.

Sweep window width and occupancy distribution. The sparse wide-domain case is
expected to challenge the claim.

### Global intrusive order list

> If mutations are sufficiently concentrated near the touch, head-origin list
> traversal plus hot LIFO reuse beats a level tree for the observed operation
> mix despite linear worst-case search.

Instrument traversal distance and far-from-touch adversarial operations. This
is the original idea, turned into a falsifiable workload claim.

### Handles versus pointers

> A 32-bit handle-based arena improves density enough to repay its base lookup
> relative to direct 64-bit pointers at target cardinality.

Hold algorithm and layout otherwise equivalent; report size, lines/pages,
instruction path, and stale-handle guarantees.

### C++ versus Rust generated work

> For the same bounded handle-based book layout and trace, optimized C++ and safe
> Rust execute materially equivalent hot paths; any measured difference can be
> localized to checks, alias information, code layout, or toolchain decisions.

This is a language experiment, so matching layout and build configuration are
part of the independent-variable control.

## The twelve-week learning program

Treat weeks as milestones, not deadlines. Move on only when the checkpoint and
artifact exist.

| Week | Study | Build artifact | Evidence |
|---:|---|---|---|
| 1 | arrays, vectors, layout | fixed and growable array | invalidation + stride tests |
| 2 | lists, stacks, queues | intrusive list, pool stack, ring | validators + wrap tests |
| 3 | heaps and hashing | indexed heap, fixed hash map | differential tests + probe histograms |
| 4 | ordered/radix/bitsets | tree/flat/radix/bitmap micro-lab | adversarial shapes + footprint |
| 5 | range and graphs | Fenwick + CSR + DSU | direct-oracle comparisons |
| 6 | memory hierarchy | address-stream lab | counters across working-set sweep |
| 7 | pools and layout | generational pool, AoS/SoA | drop/lifetime tests + sizes |
| 8 | concurrency | SPSC plus mutex queue | sequence correctness + topology sweep |
| 9 | benchmark design | common trace/result harness | optimizer/boundary audit |
| 10 | engine study | repository structure sheets | feature/access-path comparison |
| 11 | capstone implementation | baseline + candidate | trace-prefix differential tests |
| 12 | measurement and defense | final report + raw results | rerun script + oral defense |

If a week exposes a weak prerequisite, loop back. The schedule is a dependency
graph, not a streak counter.

## Required repository artifacts

Use a structure like:

```text
capstone/
  contract/          semantic rules and versioned trace schema
  traces/            generators, seeds, hashes, small readable fixtures
  reference/         slow oracle
  cpp/               baseline and candidate implementations
  rust/              baseline and candidate implementations
  tests/             cross-language fixtures and expected state hashes
  bench/             runners, affinity/config scripts, result schema
  results/raw/       immutable machine-readable runs
  results/figures/   generated charts and tables
  report/            defense document
  reproduce.md       exact build and run commands
```

Generated binaries and huge temporary outputs do not belong in source control.
Small canonical traces and raw result files that support the report do.

## Gate 1: semantic contract

The contract must answer:

- What happens on duplicate ID, missing cancel, and invalid quantity?
- Does quantity increase lose time priority? Does reduction retain it?
- What is the execution price and trade ordering?
- What happens to unfilled marketable remainder?
- Which integer widths and overflow policies apply?
- What is the fixed-capacity failure behavior?
- Which outputs contribute to the canonical hash?

Provide hand-worked traces, including multiple makers at one price, walking
several prices, full and partial fill, final level deletion, and rejected inputs.

## Gate 2: correctness evidence

Required evidence:

1. unit tests for each mutation edge;
2. randomized differential tests against the reference model;
3. structural validator after every operation in test mode;
4. cross-language result/state hashes at trace checkpoints;
5. allocation/lifetime counters at teardown; and
6. race/undefined-behavior tooling appropriate to each implementation.

Bug discoveries become regression fixtures. A benchmark run is invalid if any
validator, checksum, or lifetime count fails.

## Gate 3: workload defense

The trace suite must include:

- a small readable semantic trace;
- uniform synthetic stress;
- top-heavy price locality;
- sparse wide prices;
- rapid add/cancel reuse;
- match-heavy sweeps through levels;
- failed IDs and duplicates; and
- at least one adversarial trace for the candidate structure.

State why each trace exists and which mechanism it stresses. Report live orders,
live levels, price-distance distribution, operation mix, lifetime distribution,
and instrument interleaving.

## Gate 4: measurement evidence

The benchmark record contains:

```text
question and prediction
commit + dirty state
compiler/toolchain + complete flags
CPU/OS/topology + affinity/frequency policy
trace/config hashes
warmup and timed boundary
sample/repetition counts
throughput + latency histogram
allocations + structure instrumentation
selected hardware counters
correctness hashes
all raw runs, not only the best
```

Alternate or randomize variant order. Run an empty/scaffolding control. Check
optimized code for the decisive micro-path. Repeat from a fresh build using only
`reproduce.md` before writing conclusions.

## Gate 5: adversarial defense

Prepare to answer:

### Semantics

- Which venue rules did you simplify, and could that change the hot path?
- Can two implementations produce the same final state but different trades?
- Which modification preserves priority, and where is that encoded?

### Structures

- List every index an order participates in.
- Show the writes for full fill, cancel, and last-order-at-level deletion.
- What is the worst input for the chosen representation?
- Why is the rejected alternative not secretly serving a different contract?

### Machine mechanism

- Which loads are dependent?
- Which fields/lines/pages does the operation touch?
- What counter or structural metric supports the mechanism?
- Could footprint, branch prediction, or allocation explain the result instead?

### Measurement

- What work is outside the timer, and why?
- How was optimization-away prevented and detected?
- Are reported tails based on enough observations?
- What changes under cold start, different topology, or higher cardinality?

### C++ and Rust

- Is this layout-equivalent, standard-baseline, or best-defended?
- Which safety/lifetime invariants are compiler-enforced versus reviewed?
- What unsafe/UB risks remain, and what evidence narrows them?
- Which result is about a representation rather than a language?

The right response can be “the evidence does not establish that claim.” That is
stronger than inventing certainty.

## Scoring rubric

| Area | Points | Full-credit standard |
|---|---:|---|
| semantic precision | 15 | versioned, complete, hand-worked edge cases |
| structural correctness | 20 | invariants, oracle, randomized tests, lifetime evidence |
| workload quality | 15 | dimension sweeps plus mechanism-specific adversary |
| experimental validity | 20 | fair boundary, environment, raw distributions, reproducible |
| mechanistic analysis | 15 | work counts + layout/counters support causal story |
| C++/Rust reasoning | 10 | comparison mode labeled; constraints distinguished from runtime cost |
| communication | 5 | answer-first report, legible figures, bounded claims |

Passing is not a faster median. A result can score highly when the candidate
loses, provided the experiment explains where and why.

## Report template

Copy this outline into the capstone report:

```text
# Decision and result
One paragraph: what should be used, for which workload, with what confidence.

## Question and predicted mechanism
Falsifiable hypothesis and expected work/counter changes.

## Semantic contract
Operations, edge cases, capacity, arithmetic, outputs.

## Implementations
Access paths, layouts, ownership, allocation, comparison mode.

## Correctness evidence
Oracle, validators, randomized tests, hashes, lifetime/race tooling.

## Workloads
Trace construction, distributions, seeds/hashes, adversarial cases.

## Experimental method
Hardware/software, build flags, affinity, boundaries, sampling.

## Results
Throughput, latency distributions, work instrumentation, counters, footprint.

## Mechanism analysis
Why observations support or contradict the prediction.

## Threats to validity
Semantic, workload, measurement, platform, and implementation limitations.

## Decision boundary
Where the recommendation applies and likely crossover conditions.

## Next discriminating experiment
The smallest test that would reduce the largest remaining uncertainty.
```

Generate every figure from raw data with a checked-in command. A figure title
states the conclusion; axes include units; captions name workload and sample
count; tables do not imply more precision than measurements support.

## Stop rules

Stop optimizing a candidate when:

- it does not improve the component workload despite a micro gain;
- correctness or proof burden grows beyond the measured value;
- the gain disappears across reruns or environment controls;
- a simpler representation is within the predeclared practical margin;
- production workload dimensions fall outside the winning region; or
- the next experiment costs more than the decision is worth.

Low-latency engineering includes knowing when not to spend complexity.

## Beyond the capstone

Only after the single-book defense is sound, add one dimension at a time:

1. multiple instruments with ownership/sharding;
2. inbound SPSC/MPSC pipeline and backpressure;
3. risk/account state and transactional failure behavior;
4. deterministic journaling and replay;
5. snapshot publication and reader consistency;
6. transport/decode and open-loop end-to-end lag; and
7. recovery, operational limits, and observability.

Each expansion gets its own semantic contract and benchmark boundary. A matching
engine core is one subsystem of an exchange.

## Final checkpoint

You are ready to defend the capstone when you can:

- draw every relevant byte/index/link for one operation;
- name every invariant that operation changes;
- reproduce the first semantic divergence from a trace prefix;
- predict which machine mechanism should move before running the benchmark;
- explain the timer boundary and tail statistics;
- distinguish representation, compiler, language, and environment effects; and
- narrow or reject your favorite design when evidence requires it.

That is the knowledge gap worth closing. Memorized container complexity is only
the beginning.

Return to the [learning roadmap](roadmap.md) to choose the first gate and record
your current mastery scores.
