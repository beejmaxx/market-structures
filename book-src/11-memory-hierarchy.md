# Memory hierarchy

<p class="chapter-subtitle">The processor runs instructions; the latency distribution often comes from waiting for data.</p>

Big-O counts operations as if every load and branch had one price. Real machines
have registers, several cache levels, translation caches, main memory, branch
predictors, prefetchers, and multiple cores competing for ownership. Their exact
sizes and timings vary by processor, but the design questions are stable.

```text
core -> registers -> L1 -> L2 -> shared cache -> memory
          fastest, smallest                 slower, larger
```

The useful question is not “how many nanoseconds is a cache miss?” in the
abstract. It is “which dependency, address stream, or ownership transition does
this representation produce on the target machine?”

## Cache lines and locality

Caches transfer fixed-size **lines**, not individual fields. If a line is 64
bytes, loading one 8-byte value brings neighboring bytes too. Sequentially
stored values exploit **spatial locality**; recently reused values exploit
**temporal locality**.

<div class="ms-lab" data-ms-cache>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE MODEL</span><h3>Change the address stream</h3></div>
    <p>Each outlined group models one cache line holding four elements. This counts lines touched; it does not pretend to be a hardware simulator.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="sequential">8 sequential loads</button>
    <button type="button" data-action="stride">8 strided loads</button>
    <button type="button" data-action="dependent">8 dependent loads</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>loads</span><strong data-stat="loads">0</strong></div>
    <div><span>unique lines</span><strong data-stat="lines">0</strong></div>
    <div><span>loads / line</span><strong data-stat="density">0.0</strong></div>
    <div><span>dependency</span><strong data-stat="dependency">none</strong></div>
  </div>
  <div class="ms-cache-grid" data-cache-slots aria-label="Thirty-two elements grouped into modeled cache lines"></div>
  <p class="ms-log" data-cache-log>Select an address pattern.</p>
</div>

The sequential pattern consumes most bytes brought into each line. A large
stride can spend a line fill for one useful value. A dependent chain can touch
the same number of lines as independent random lookups yet be slower because the
next address is unknown until the current load completes.

## Latency hiding and dependency

Modern cores can overlap multiple independent misses. Consider:

```text
sum += a[index[i]]          independent indices may overlap
node = node->next           next address depends on current load
```

Pointer chasing creates a serial dependency chain. A linked list can have
`O(1)` insertion and still lose to a vector that shifts several cached elements.
This is why counting pointer writes or comparisons alone does not predict time.

Software prefetch can request a known future address, but it consumes issue
capacity, bandwidth, and cache space. It cannot easily outrun a strict one-link-
at-a-time dependency. Measure distance and usefulness; an unnecessary prefetch
is extra work.

## Set conflicts and footprint

A cache is divided into sets with limited associativity. Many active addresses
mapping to the same set can evict one another even when total working-set bytes
seem small. Alignment, power-of-two strides, and the relative placement of
arrays can create conflict patterns.

Padding every object to a cache line is not a universal fix. It can prevent
false sharing but multiplies footprint, consumes more cache sets and TLB entries,
and reduces useful bytes per line. Separate hot fields from cold fields before
adding blind padding.

## Address translation and the TLB

Virtual addresses are translated in pages. Translation lookaside buffers
(TLBs) cache recent virtual-to-physical mappings. A scattered working set across
many pages can miss the TLB even when individual objects are small.

```text
many nodes on few pages      -> translation reuse
one useful node per page     -> high TLB pressure
```

Larger pages reduce the number of translations but change allocation,
fragmentation, privilege, and operational concerns. First make objects dense
and measure page footprint. Huge pages are an environment decision, not a data-
structure invariant.

## Branch prediction

Conditional branches are cheap when their direction is predictable. A wrong
prediction discards speculative work. Data structures create characteristic
branch streams:

- binary search branches depend on key comparisons;
- linear probing branches on slot states and equality;
- tree traversal branches left or right;
- parsing branches on message type and validity; and
- a bounded ring branches on full or empty.

“Branchless” code may replace a misprediction with extra instructions, loads,
or masked work. It helps when those costs are lower for the actual distribution.
Test sorted, biased, and random inputs; branch predictability is workload state.

## Hardware prefetchers

Processors recognize simple sequential and strided address streams. Contiguous
arrays cooperate naturally. Several interleaved streams may still be learned;
random permutations and pointer chains generally are harder.

Prefetching also explains why a benchmark's first traversal and repeated warm
traversals answer different questions. Decide whether production data is hot,
warm, or cold at each operation boundary. Do not call every cache-cold result
“realistic” or every warmed result “cheating.”

## Multi-core ownership and NUMA

When one core writes a cache line, coherence must give it ownership and
invalidate other cached copies. **False sharing** occurs when threads modify
different fields that happen to occupy the same line. The logical objects are
independent; the coherence unit is not.

On multi-socket or chiplet systems, memory access can also depend on NUMA
placement. Allocate and initialize memory under the same ownership policy used
in production, pin threads when the experiment requires it, and report the
topology. A portable program may be correct everywhere while its latency is
topology-specific.

## Layout tools in C++ and Rust

C++ can request alignment and inspect object properties:

```cpp
struct alignas(64) PublishedCursor {
    std::atomic<std::uint64_t> value;
};

static_assert(std::is_trivially_copyable_v<Message>);
```

Rust offers explicit representation and alignment attributes:

```rust
#[repr(align(64))]
struct PublishedCursor {
    value: std::sync::atomic::AtomicU64,
}
```

The number 64 is a target assumption that belongs in configuration and
measurement evidence, not a language truth. `sizeof`/`alignof` and
`size_of`/`align_of` expose layout facts; they do not reveal cache behavior by
themselves.

Both optimizers may eliminate dead computations, vectorize loops, unroll them,
or replace code with a closed form. Inspect optimized assembly when the result
is surprising and build benchmarks with production-like optimization settings.

## Connect the mechanism to structures

| Structure | Likely strength | Likely machine cost |
|---|---|---|
| vector / flat map | density, streaming | movement, invalidation |
| linked tree/list | stable local mutation | dependent pointer loads |
| open-address hash | compact probe run | occupancy-sensitive clusters |
| node hash | stable nodes | hash + bucket + node indirection |
| bitmap | many keys per line | domain footprint, scans when sparse |
| pool with indices | controlled lifetime, denser nodes | generation checks, capacity |

These are hypotheses, not verdicts. Value size, mutation mix, cardinality, key
distribution, and which fields are touched can reverse them.

## Failure modes

- a compact-looking struct contains hidden padding or an oversized cold field;
- two writers false-share a line despite separate logical counters;
- a pointer benchmark accidentally allocates nodes contiguously and claims a
  general linked-list result;
- a cold-cache flush measures the flush machinery or unrealistic state;
- a stride aliases a small number of cache sets;
- results from one CPU are reported as universal constants; or
- elapsed time is attributed to caches without counters or a discriminating
  experiment.

## Build the experiments

Create a small C++ and Rust memory laboratory with preallocated data and no I/O
inside timed regions:

1. sequential and strided scans over the same array;
2. random independent index loads;
3. a randomized dependent index permutation;
4. AoS versus SoA when touching one field and all fields;
5. packed versus page-scattered linked nodes; and
6. two counters together versus deliberately separated for two pinned writers.

Pre-generate index sequences, verify checksums, sweep working-set size across
likely cache and TLB boundaries, and retain raw observations.

## Measure the mechanism

Report CPU model, core placement, frequency policy, compiler and flags, sample
count, warmup, and data-state policy. Alongside latency/throughput, collect
available hardware counters for cycles, instructions, cache misses, branch
misses, and TLB events.

Counters are model-specific and can be noisy or multiplexed. Use them to test a
mechanistic prediction: for example, “the dependent permutation stops gaining
memory-level parallelism,” not merely “it has more misses.” Change one causal
factor at a time.

## Checkpoint

Explain:

- why equal cache-miss counts can produce different elapsed times;
- how cache lines create spatial locality and false sharing;
- why footprint affects both caches and TLBs;
- when branchless code can be worse; and
- which experiment would distinguish cache density from fewer comparisons.
