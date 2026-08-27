# Concurrency and atomics

<p class="chapter-subtitle">Choose ownership first; use atomic ordering to publish the minimum state another thread must observe.</p>

Concurrency adds more than simultaneous execution. It adds a memory model:
which writes another thread may observe, in what order, and under which
synchronization. A fast sequential structure is not made concurrent by changing
an integer to `atomic`.

The strongest low-latency design is often architectural:

```text
one thread owns mutable book state
other threads exchange messages or read published snapshots
```

Single ownership removes races from the data structure itself. Queues and
publication boundaries carry the concurrency contract.

## Data races and happens-before

In C++, conflicting non-atomic accesses from different threads without a
happens-before relationship create a data race and undefined behavior. Safe Rust
prevents ordinary shared mutation without synchronization, while unsafe code and
foreign interfaces can still violate the model.

Atomics provide indivisible operations and selectable ordering. A common
publication pattern is:

```text
producer: write payload -> release store ready
consumer: acquire load ready -> read payload
```

If the acquire observes the released value, earlier producer writes happen-
before later consumer reads. The payload itself can remain non-atomic because
ownership and the synchronization edge prevent concurrent conflicting access.

<div class="ms-lab" data-ms-publish>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE MODEL</span><h3>Publish one slot</h3></div>
    <p>This is a state-machine model of the synchronization edge, not a JavaScript memory-model experiment.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="write">producer writes payload</button>
    <button type="button" data-action="publish">release publishes</button>
    <button type="button" data-action="acquire">consumer acquires</button>
    <button type="button" data-action="read">consumer reads</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-publish" data-publish-stages aria-label="Payload publication stages"></div>
  <div class="ms-stats" aria-live="polite">
    <div><span>payload written</span><strong data-stat="written">no</strong></div>
    <div><span>sequence released</span><strong data-stat="released">0</strong></div>
    <div><span>sequence acquired</span><strong data-stat="acquired">0</strong></div>
    <div><span>safe to read</span><strong data-stat="safe">no</strong></div>
  </div>
  <p class="ms-log" data-publish-log>The producer owns the empty slot.</p>
</div>

Atomicity alone is insufficient. A relaxed “ready = 1” may be atomic without
publishing the preceding payload writes. Conversely, sequential consistency for
every operation may be stronger than the algorithm requires. Derive ordering
from ownership and communication, then prove it.

## Ordering vocabulary

Both C++ and Rust expose broadly corresponding orderings:

| Ordering | Core role |
|---|---|
| relaxed | atomicity and modification order only |
| acquire | later operations do not move before; can observe a release |
| release | earlier operations do not move after; can publish to an acquire |
| acquire-release | both roles on a read-modify-write |
| sequentially consistent | acquire/release plus one global SC order |

C++ documents atomic facilities in [`<atomic>`](https://eel.is/c++draft/atomics).
Rust exposes orderings through
[`std::sync::atomic::Ordering`](https://doc.rust-lang.org/std/sync/atomic/enum.Ordering.html).
The names resemble hardware instructions, but the language model is the
contract. Compiler transformations are part of what the ordering constrains.

`volatile` is not an inter-thread synchronization primitive in either language.
It is for special observable accesses such as some device I/O situations.

## A bounded SPSC ring

A single-producer/single-consumer queue is the best place to learn atomics
because ownership is simple:

```text
producer alone writes tail and constructs slots
consumer alone writes head and destroys slots
both read the other side's published counter
```

With monotonically increasing counters and capacity `C`:

```text
empty: tail == head
full:  tail - head == C
slot:  counter % C
```

Producer pseudocode:

```text
tail = local_tail
head = head_atomic.load(acquire)
if tail - head == C: return Full
construct slots[tail % C]
tail_atomic.store(tail + 1, release)
```

Consumer pseudocode:

```text
head = local_head
tail = tail_atomic.load(acquire)
if head == tail: return Empty
move value from slots[head % C]; destroy slot
head_atomic.store(head + 1, release)
```

The producer's release publishes construction; the consumer's acquire protects
reading. The consumer's release publishes destruction/free capacity; the
producer's acquire protects reuse. Counter width and wrap arithmetic must be
proved for maximum lag and runtime.

Caching the remote counter locally avoids an acquire load on every successful
operation; refresh only near empty/full. That optimization preserves correctness
because stale knowledge can cause a conservative Empty/Full result, not unsafe
slot reuse—if the ownership proof is otherwise correct.

## Slot lifetime

For nontrivial `T`, ring storage is uninitialized until the producer constructs
a slot and becomes uninitialized again after the consumer destroys it. C++ can
use aligned raw storage plus `construct_at`/`destroy_at`. Rust can encapsulate
`MaybeUninit<T>` behind the SPSC ownership proof.

The producer and consumer may hold distinct mutable access to different slots,
but general container APIs do not express that automatically. This is where a
small, reviewed unsafe core may be appropriate in Rust and careful lifetime code
is mandatory in C++.

## False sharing and counter placement

`head` and `tail` are logically independent writers but may share a cache line.
Each update then transfers ownership between cores. Separate frequently written
counters and keep producer-local/consumer-local cached values close to their
owner.

Padding must be target-aware and measured. Also avoid placing unrelated shared
status beside a hot counter. A layout that reduces coherence traffic may grow
the overall footprint; treat that as an explicit exchange.

## SPSC, MPSC, and MPMC are different algorithms

Adding producers destroys exclusive ownership of `tail` and target slots.
Multiple producers need reservation and a per-slot publication protocol so a
later reservation cannot make an earlier unfinished slot appear ready.

Multiple consumers similarly need exclusive claim of each item before moving
and destroying it. MPMC bounded queues often attach a sequence number to every
slot. Compare-and-swap loops, contention, fairness, and wrap proofs become part
of the design.

Do not generalize an SPSC benchmark to MPSC/MPMC. If the topology is one feed
thread to one engine thread, the simpler algorithm is not a toy—it is the better
contract.

## Locks are a baseline, not a failure

A mutex-protected bounded queue is easy to reason about and establishes
correctness. Under low contention, optimized locks can be competitive. Under
contention, scheduling and priority interactions can create large tails.

Lock-free means system-wide progress: some operation completes despite a paused
thread. It does not mean every operation is bounded, uncontended, wait-free, or
faster. Wait-free provides a per-operation step bound and is a stronger claim.

State the progress guarantee precisely and include a mutex baseline.

## ABA and memory reclamation

Compare-and-swap checks that a value is unchanged. In an ABA event, a pointer or
index changes from A to B and back to A while a thread is paused; equality alone
misses the intervening lifetime.

Concurrent linked structures also cannot reclaim a removed node while another
thread might still read it. Hazard pointers, epochs, quiescent-state schemes,
reference counting, or ownership partitioning address reclamation with different
costs. A fixed pool does not solve reclamation: immediate slot reuse can make
ABA more likely.

Prefer queues whose bounded slots and topology avoid general reclamation before
attempting a lock-free linked list.

## Publishing snapshots

Readers often need a coherent view, not mutation rights. Options include:

- copy a compact top-of-book snapshot, then release-publish its sequence;
- double-buffer state and atomically publish the active buffer index;
- use a sequence counter: writer marks odd, writes, marks even; reader retries
  if the sequence changed or was odd; or
- send immutable events to per-consumer queues.

A sequence-counter reader must copy data that is safe to access under the
language model; a retry loop alone does not legalize data races in portable C++.
Choose a pattern with a sound implementation, not only an appealing diagram.

## Failure modes

- relaxed publication exposes readiness without payload visibility;
- full/empty arithmetic breaks when counters wrap;
- two producers construct the same slot;
- consumer destruction is published after producer reuse;
- head and tail false-share one line;
- a benchmark runs producer and consumer on sibling logical CPUs accidentally;
- a lock-free node is reclaimed while another thread holds its pointer; or
- “works on x86 in testing” substitutes for a language-level proof.

## Build it from a blank file

Implement the same bounded SPSC queue in C++ and Rust:

```text
try_push(value) -> Ok | Full
try_pop()       -> value | Empty
capacity, approximate_len
```

Start with integers, then nontrivial values whose construction/destruction is
counted. Keep monotonic counters, one producer and one consumer, fixed capacity,
and no allocation after construction.

Tests must cover wraparound, full/empty transitions, millions of sequenced
messages, checksum/order validation, producer/consumer pauses, teardown, and a
small counter-width model that forces wrap quickly. Run available race detectors
and model/testing tools, but do not treat their silence as proof.

Then implement a mutex-protected bounded queue with the same API. Do not attempt
MPSC until the SPSC ownership and publication proof can be written line by line.

## Measure the claim

Pin producer and consumer deliberately and report topology. Test same core if
meaningful, sibling logical CPUs, separate physical cores, and cross-NUMA paths
where available. Sweep batch size, message size, queue capacity, producer/
consumer imbalance, and backpressure policy.

Measure throughput and enqueue-to-dequeue latency percentiles, plus Full/Empty
counts, retries, instructions, cache misses, and coherence-related counters when
available. Compare mutex, SPSC, and batch handoff. Include idle-to-active
transitions; a busy-spin steady state is only one operating regime.

## Checkpoint

Explain:

- the exact release/acquire edge that publishes a ring slot;
- why SPSC ownership removes compare-and-swap from the normal path;
- why lock-free does not mean low-tail-latency;
- how false sharing occurs between separate atomic counters; and
- why fixed pooling does not by itself solve ABA or reclamation.
