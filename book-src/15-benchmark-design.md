# Benchmark design

<p class="chapter-subtitle">A benchmark is an experiment that can falsify a mechanism—not a stopwatch wrapped around code.</p>

“C++ versus Rust” is not yet a question. Neither is “tree versus hash table.” A
useful benchmark states:

```text
workload + semantic contract + representation + mechanism + measurement boundary
```

Example:

> Under a fixed 70/20/10 add/cancel/modify trace at 100k live orders, does a
> preallocated open-addressed ID index reduce failed-cancel p99 latency by
> shortening dependent probe paths relative to the standard map baseline?

This predicts an observable mechanism—probe paths—not merely a winner.

## Draw the boundary

Trace generation, parsing, allocation, warmup, validation, and reporting can
each dominate the operation under study. Decide which belong to the production
operation and which prepare or observe the experiment.

<div class="ms-lab" data-ms-benchmark>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Audit a timed boundary</h3></div>
    <p>A valid microbenchmark prepares identical work, times the declared operation, and keeps an observable correctness result.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="clean">clean boundary</button>
    <button type="button" data-action="setup">time setup too</button>
    <button type="button" data-action="dead">drop observation</button>
    <button type="button" data-action="oneshot">one-shot sample</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-benchmark-flow" data-benchmark-stages aria-label="Benchmark stages"></div>
  <div class="ms-stats" aria-live="polite">
    <div><span>timed stages</span><strong data-stat="timed">0</strong></div>
    <div><span>result observed</span><strong data-stat="observed">no</strong></div>
    <div><span>samples</span><strong data-stat="samples">0</strong></div>
    <div><span>verdict</span><strong data-stat="verdict">unconfigured</strong></div>
  </div>
  <p class="ms-log" data-benchmark-log>Select a boundary audit.</p>
</div>

Including setup is not inherently wrong. It answers an end-to-end question.
Calling that result steady-state operation latency is wrong. Draw the boundary
before seeing results.

## Three useful experiment scales

**Microbenchmark:** isolates a primitive such as hash lookup, pool allocation,
or ring push. It explains mechanisms but may omit system interactions.

**Component benchmark:** replays a realistic operation mix through a complete
book/index/pool component. It preserves coupled mutation and working-set effects.

**End-to-end benchmark:** includes decode, routing, state update, strategy, and
publication. It measures the system but makes root cause harder to identify.

Use all three as a ladder. A micro result proposes a mechanism; a component test
checks whether it survives integration; end-to-end work establishes impact.

## Freeze semantics before performance

Write the operation contract once:

- valid and invalid message behavior;
- duplicate ID policy;
- quantity and overflow rules;
- price-time priority;
- capacity/backpressure behavior;
- which timestamps and outputs exist; and
- final-state and per-operation result hashing.

Every implementation consumes the same serialized or generated trace and must
produce the same observable result. Performance data from semantically different
programs is not a language comparison.

## Workload dimensions

One “realistic” trace can hide a design's shape. Build a matrix:

| Dimension | Example sweep |
|---|---|
| live cardinality | 1k, 10k, 100k, 1m orders |
| operation mix | add-heavy, cancel-heavy, balanced, bursty |
| price locality | top-heavy, uniform band, wide sparse |
| ID behavior | hits, misses, duplicates, clustered hashes |
| lifetime | rapid reuse, long-lived, mixed |
| side/instrument | one hot book, many interleaved books |
| queue state | empty-biased, balanced, near-full |

Synthetic traces reveal mechanisms; captured traces preserve correlations. Use
both when possible. Remove sensitive fields without destroying distributions
the experiment relies on.

## Clock and timer overhead

C++ [`std::chrono::steady_clock`](https://eel.is/c++draft/time.clock.steady) and
Rust [`std::time::Instant`](https://doc.rust-lang.org/std/time/struct.Instant.html)
provide monotonic elapsed-time interfaces. Their resolution and call overhead
are platform-specific.

Timing one tiny operation can measure the clock more than the operation. Options:

- batch many operations between two clock reads and report amortized cost;
- sample only selected operations while replaying the full stateful stream;
- use a benchmark harness that estimates measurement overhead; or
- read a hardware counter with target-specific serialization and calibration.

Batching hides the per-operation distribution, so use it for throughput and add
a separate latency method. Measure empty timing scaffolding and report it; do
not blindly subtract a noisy constant from every sample.

## Keep work observable

An optimizer may remove unused results, hoist invariant lookup, precompute a
trace, or merge operations. Correct optimized code is allowed to do so.

Accumulate an output checksum that depends on operation results and verify it
outside the timed region. Vary runtime inputs. Inspect optimized assembly for
suspiciously tiny loops.

Rust provides
[`std::hint::black_box`](https://doc.rust-lang.org/std/hint/fn.black_box.html) as
a best-effort optimization barrier for benchmarks. C++ has no equivalent
portable standard function; established benchmark harnesses provide compiler-
specific barriers. Barriers do not make an unrealistic workload realistic and
are not cryptographic or correctness tools.

## Warm, cold, and steady state

Warmup serves several purposes:

- populate the structure to target cardinality;
- reach allocator and free-list steady state;
- fault in pages and establish page placement;
- warm instruction/data caches and predictors; and
- allow dynamic runtime machinery, if any, to settle.

C++ and Rust native builds generally do not have a tracing JIT, but the machine
still changes state. Frequency, thermal limits, background daemons, and page
faults matter.

Cold-start latency is a valid separate experiment. Define how caches and pages
become cold; flushing broad memory can perturb far more than the intended data.
Report first-touch and steady-state separately.

## Distributions, not one average

Low-latency work cares about the distribution:

```text
count, min, p50, p90, p95, p99, p99.9, max
histogram or raw samples
```

Percentiles require enough samples: p99.9 estimated from 1,000 observations is
essentially one extreme point. Repeat independent runs and show run-to-run
variation. Means remain useful for throughput and additive resource accounting,
but they do not describe rare stalls.

Use an integer histogram with sufficient resolution or retain raw data when
feasible. State percentile convention. Do not average percentiles from separate
runs; merge compatible samples or report the distribution of per-run metrics.

## Coordinated omission

If a load generator waits for each response before scheduling the next request,
a slow response also suppresses requests that should have arrived during the
stall. The measured latency distribution omits queued waiting and can look
better precisely when the system pauses.

For service-style tests, schedule arrivals independently and measure from
intended arrival to completion. For a single-threaded market-data replay that is
inherently sequential, distinguish processing time per event from end-to-end lag
behind the source schedule. Both are useful; they answer different questions.

## Control the environment

Record at least:

```text
CPU and topology
OS/kernel
compiler version and complete flags
target CPU features and link mode
power/frequency policy
thread affinity and NUMA placement
dataset/trace identity and seed
build commit and dirty-state marker
```

Reduce unrelated load. Pinning can improve reproducibility but may create an
unrepresentative topology, so disclose it. Check whether counters are multiplexed
and whether turbo or thermal throttling changes across long runs.

## Fair C++ and Rust comparisons

Use three deliberately named comparisons:

1. **layout-equivalent:** matching representations and semantics, used to inspect
   generated work and language/runtime overhead;
2. **standard baseline:** `std` containers and idioms in each language, used to
   establish accessible implementations; and
3. **best defended design:** each language may choose the representation its
   constraints support best, used to compare engineering outcomes.

Use equivalent optimization, target features, link-time optimization choice,
panic/exception policy where relevant, allocator policy, and debug assertions.
Do not force awkward source transliteration and call it language fairness.

Validate sizes, capacity, allocations, and final checksums. Inspect generated
assembly or hardware counters when results differ; the source languages are not
the causal explanation until narrower mechanisms are excluded.

## Statistical discipline

Randomize or alternate implementation run order so temperature and background
load do not always favor one variant. Use common traces to reduce input variance.
Preserve every run, including slow ones, unless a predeclared exclusion rule
identifies a known invalid condition.

Confidence intervals quantify sampling uncertainty, not benchmark validity. A
precise answer to the wrong workload is still wrong. Favor effect sizes and
mechanistic counters over ritual significance tests.

## Hardware counters and profiles

Counters can record cycles, retired instructions, cache events, branches, TLB
events, and more. Profiles locate instruction or call-path concentration. They
are evidence for a proposed mechanism, subject to CPU-specific definitions,
sampling, skid, and multiplexing.

Useful pairings include:

- more time + more dependent cache misses in pointer traversal;
- same time + fewer instructions but more branch misses;
- hash tail spikes + long probe histogram;
- pool improvement + fewer allocator calls and page touches; or
- queue topology regression + more cache-line ownership traffic.

Do not dump every counter into a table and invent a story afterward. Predict the
counter direction first.

## Failure modes

- trace generation or allocation is inconsistently timed;
- one implementation does less validation or different work;
- results are unused and optimized away;
- only uniform random keys are tested;
- throughput is divided into “nanoseconds per operation” and mislabeled latency;
- too few samples support claimed extreme percentiles;
- run order, CPU placement, or thermal state favors one variant;
- a benchmark framework's default is treated as a methodology; or
- the fastest result is selected from many runs while all others are discarded.

## Build the harness

Create a language-neutral trace format with a versioned header, seed, semantic
configuration, and operations. Build C++ and Rust runners that emit one common
machine-readable result schema:

```text
metadata, implementation, trace hash, operation counts
final state hash, allocation counts, latency histogram
throughput, errors/full states, optional hardware counters
```

The harness must support setup/warmup/timed/validation phases, batch throughput,
sampled per-operation latency, multiple repetitions, fixed CPU affinity
configuration, and raw output retention. Add a deliberately broken benchmark
whose checksum is removed and prove optimization can distort it.

## Run the benchmark ladder

For every proposed optimization:

1. state the mechanism and predicted observable change;
2. write or reuse a correctness oracle;
3. run the smallest discriminating microbenchmark;
4. run the component trace with coupled indexes;
5. collect relevant counters;
6. test at least one adversarial workload; and
7. accept, reject, or narrow the claim in a short result note.

Store raw results beside commit, trace hash, and environment metadata. A chart
without reproducible inputs is an illustration, not durable evidence.

## Checkpoint

Explain:

- why a timed boundary defines the question rather than merely the code;
- how a checksum prevents some dead-code elimination and validates semantics;
- why throughput-derived averages are not latency distributions;
- how coordinated omission hides stalls; and
- the different questions answered by layout-equivalent, standard, and best-
  defended C++/Rust comparisons.
