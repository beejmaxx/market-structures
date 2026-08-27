# Allocation, arenas, slabs, and pools

<p class="chapter-subtitle">Make capacity, lifetime, reuse, and failure policy part of the representation.</p>

General allocation solves a broad problem: variable sizes, arbitrary lifetimes,
multiple threads, and memory returned in unpredictable order. That generality
can introduce synchronization, size-class metadata, page acquisition, and
latency variance. A specialized pool narrows the contract.

```text
general allocator: request size -> find storage -> metadata -> object
fixed pool:        pop free slot -> construct object
```

The goal is not “never allocate” as a slogan. It is to place capacity acquisition
outside the operation whose latency budget cannot tolerate it and to make
exhaustion observable.

## Four related designs

**Arena / region:** acquire large blocks and carve objects sequentially. Free
everything together. Individual deallocation is absent or only runs destructors.

**Monotonic allocator:** an arena whose allocation cursor only advances. Reset
reclaims the whole region. Excellent for one message batch or request lifetime.

**Slab:** storage is divided into slots for one object layout or size class.
Metadata tracks free slots. Pages/slabs may be added as capacity grows.

**Fixed object pool:** a bounded set of equal-size slots plus a free structure.
Allocate pops one slot; deallocate destroys the object and returns its slot.

These solve different lifetime problems. An order pool needs individual reuse;
a per-packet decode arena may only need bulk reset.

<div class="ms-lab" data-ms-pool>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Reuse the top of a LIFO free list</h3></div>
    <p>Click a live slot to select it. Freeing increments its generation and pushes it onto the stack; the next allocation reuses that slot.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="allocate">allocate</button>
    <button type="button" data-action="free">free selected</button>
    <button type="button" data-action="stale">check stale handle</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>live objects</span><strong data-stat="live">0</strong></div>
    <div><span>free slots</span><strong data-stat="free">8</strong></div>
    <div><span>free-list top</span><strong data-stat="top">0</strong></div>
    <div><span>selected</span><strong data-stat="selected">none</strong></div>
  </div>
  <div class="ms-pool" data-pool-slots aria-label="Eight reusable object slots"></div>
  <p class="ms-log" data-pool-log>All slots are free; allocation will pop slot 0.</p>
</div>

## The pool invariants

For `N` slots:

1. every slot is exactly one of live or free;
2. every free slot appears exactly once in the free structure;
3. every live slot contains one constructed object;
4. allocation constructs only in a free slot;
5. deallocation destroys exactly once before returning the slot; and
6. a handle is accepted only when its slot is live and its generation matches.

The partition is a useful accounting identity:

```text
live_count + free_count = capacity
```

A slow validator should walk the free list, detect cycles and duplicates, then
cross-check slot state. Run it after every mutation in tests.

## LIFO reuse and locality

A free stack returns the most recently released slot first. That storage and
its surrounding cache line may still be hot. Repeated add/cancel activity can
therefore reuse a small working set even when the pool's maximum capacity is
large.

FIFO reuse delays return and spreads allocations over more slots. It can expose
use-after-free bugs sooner and distribute wear in nonvolatile contexts, but it
usually enlarges the active cache footprint. Random reuse has different
security/debugging properties. Reuse order is a policy to benchmark, not an
allocator law.

If nodes are grouped by instrument during a quiet-period compaction, external
pointers and intrusive links make movement dangerous. Integer handles allow
relocation only if every internal and external reference is updated through a
controlled indirection. “Cleanup” is a full graph rewrite, not a harmless swap.

## Handles and generations

A raw index becomes ambiguous after its slot is recycled:

```text
old order A -> slot 7
free A
new order B -> slot 7
stale cancel(A) accidentally cancels B
```

Pair the index with a generation counter:

```text
Handle { index, generation }
valid = slot.live && slot.generation == handle.generation
```

Increment the generation on retirement or reuse. The counter can wrap; choose
width based on worst-case reuse and stale-handle lifetime. A generation catches
many temporal mistakes but does not replace ownership, protocol sequence checks,
or synchronization.

## Object lifetime is separate from storage

Raw pool bytes do not automatically contain live objects. In C++, construct
with `std::construct_at` (or placement construction) and end lifetime with
`std::destroy_at`:

```cpp
alignas(Order) std::byte storage[sizeof(Order) * Capacity];

Order* order = std::construct_at(slot_ptr(index), args...);
std::destroy_at(order);
free_stack.push(index);
```

Alignment and pointer derivation must be correct. Exceptions during construction
must leave the slot free. Destruction policy must be explicit at pool teardown.

Rust represents uninitialized slots with `MaybeUninit<T>`:

```rust
struct Slot<T> {
    value: std::mem::MaybeUninit<T>,
    generation: u32,
    live: bool,
}
```

Writing creates `T`; `assume_init_ref`/`assume_init_mut` are safe only under the
pool invariant; `assume_init_drop` ends lifetime. Encapsulate every `unsafe`
operation behind checked handles and test the state machine. The compiler will
not prove a custom pool's initialization bitmap correct for you.

## C++ polymorphic allocation resources

The C++ standard
[`<memory_resource>`](https://eel.is/c++draft/mem.res) library separates
allocation policy from `std::pmr` containers.

```cpp
std::array<std::byte, 1 << 20> buffer;
std::pmr::monotonic_buffer_resource arena(buffer.data(), buffer.size());
std::pmr::vector<Event> events{&arena};
events.reserve(expected_events);
```

`monotonic_buffer_resource` makes individual deallocation a no-op and releases
on reset/destruction. An upstream resource may allocate when the supplied buffer
is exhausted unless configured otherwise. `unsynchronized_pool_resource` pools
size classes for single-threaded access; `synchronized_pool_resource` supports
multiple threads with corresponding costs.

These resources help control standard-container allocation. They do not provide
stable object handles, fixed-capacity rejection, or order-specific slot metadata
by themselves.

## Rust allocation baselines

`Box<T>`, `Vec<T>`, and standard collections use the selected global allocator.
`Vec::with_capacity` and `reserve` move capacity acquisition before insertion,
but removing from a `Vec<T>` still follows vector movement/invalidation rules.

A `Vec<Slot<T>>` can own a fixed pool after construction. A monotonic arena can
be modeled as a byte buffer plus aligned cursor, but producing references whose
lifetimes and aliasing remain sound requires careful API design. For learning,
start with typed slots and indices before writing a generic byte arena.

## Intrusive free lists

A free slot does not hold a live `Order`, so its storage can carry the next free
index:

```text
free head -> slot 3 -> slot 8 -> slot 2 -> none
```

Allocation reads `head`, replaces it with `slot.next_free`, then constructs the
object. Deallocation destroys the object, writes the old head into the slot's
free metadata, then publishes that slot as head.

In single-threaded code this is simple. A lock-free concurrent free list adds
ABA and memory-reclamation problems: head can change away and back while a
thread is paused. Tagged heads, ownership partitioning, or a well-audited queue
algorithm are required. The concurrency chapter develops publication separately.

## Capacity and backpressure

A bounded pool forces an honest full-state policy:

- reject the new operation;
- shed lower-priority work;
- route to a reserved slow path;
- disconnect because an upstream limit was violated; or
- trigger a controlled resize outside the active engine.

Silently falling back to the general allocator defeats the latency contract.
Silently overwriting a live slot defeats correctness. Expose high-water mark,
exhaustion count, and per-instrument usage so capacity can be engineered.

## Failure modes

- a slot is returned twice and the free list contains a duplicate;
- construction throws/panics across an inconsistent live flag;
- destruction is skipped for a resource-owning object;
- stale raw pointers survive slot reuse;
- generation width wraps inside the threat window;
- a `pmr` upstream allocation enters the timed hot path;
- cross-thread frees contend on one free-list head; or
- a compaction moves intrusive nodes without repairing every reference.

## Build it from a blank file

Build fixed pools in C++ and Rust with the same public contract:

```text
allocate(args...) -> Handle | Full
get(handle)       -> reference | Stale
get_mut(handle)   -> mutable reference | Stale
free(handle)      -> value/ok | Stale
capacity, live_count, high_water
```

Use typed storage, LIFO free indices, and 32-bit generations. Test nontrivial
destructors/drop counters, full capacity, double free, stale handles, randomized
allocate/free traces, and teardown with live objects. Keep a reference model of
optional values by slot.

Then compare LIFO, FIFO, and instrument-partitioned free policies without
changing the object or trace.

## Measure the claim

Preallocate before timing. Replay bursty allocation lifetimes, repeated reuse of
a small live set, random churn across full capacity, and cross-thread remote-free
scenarios if supported. Report latency percentiles for allocate/free, footprint,
cache/TLB misses, high-water mark, and failure count.

Compare general allocation, reserved vector slots, `pmr` resources where
applicable, and the fixed pool. Include object construction/destruction either
in all variants or in none. The allocator is only one part of lifetime cost.

## Checkpoint

Explain:

- why a LIFO free list may preserve a smaller hot working set;
- how storage lifetime differs from object lifetime;
- what a generation handle detects and cannot detect;
- how an arena differs from an individually reusable pool; and
- what the system does when fixed capacity is exhausted.

Next: [Data layout and indirection](13-layout-indirection.md).
