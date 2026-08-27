# Hashing under pressure

<p class="chapter-subtitle">Constant time is a workload-dependent observation, not a contractual latency bound.</p>

A hash table implements a map or set by turning a key into a candidate storage
location. Equality still decides whether a candidate is the key. The complete
lookup is therefore:

```text
key -> hash bits -> initial bucket -> collision policy -> equality check
```

The table is correct only if insertion and lookup follow compatible paths. Its
speed depends on hash quality, load factor, collision pattern, deletion history,
and memory layout.

## Two collision strategies

**Separate chaining** stores a collection at each bucket. Colliding keys share
the bucket but occupy distinct nodes or a small contiguous bucket container.
The bucket array stays simple; traversal adds indirection and allocation unless
nodes come from a pool.

**Open addressing** stores entries directly in the table. A collision advances
through a deterministic probe sequence until it finds the key or a stopping
state. It often has excellent locality, but its capacity and deletion states are
part of the algorithm.

<div class="ms-layout">
  <div><strong>empty</strong><span>lookup may stop here</span></div>
  <div><strong>occupied</strong><span>compare key; otherwise probe</span></div>
  <div><strong>tombstone</strong><span>lookup continues; insert may reuse</span></div>
</div>

For linear probing with capacity `m`:

```text
index(i) = (hash(key) + i) mod m
```

The essential lookup invariant is: **never stop at a tombstone**. A later key
may have crossed that slot when it was occupied.

<div class="ms-lab" data-ms-hash>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Probe an open-addressed table</h3></div>
    <p>Every demonstration key hashes to bucket 2. Watch collisions form a cluster, then delete through it.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="insert">insert next</button>
    <button type="button" data-action="find">find 34</button>
    <button type="button" data-action="delete">delete 26</button>
    <button type="button" data-action="miss">find missing 50</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>live entries</span><strong data-stat="size">0</strong></div>
    <div><span>load factor</span><strong data-stat="load">0.00</strong></div>
    <div><span>probes</span><strong data-stat="probes">0</strong></div>
    <div><span>tombstones</span><strong data-stat="tombstones">0</strong></div>
  </div>
  <div class="ms-hash" data-hash-slots aria-label="Eight slot open-addressed hash table"></div>
  <p class="ms-log" data-hash-log>Every slot is empty.</p>
</div>

## Tombstones and deletion

Suppose `18`, `26`, and `34` all begin at bucket 2 and occupy buckets 2, 3,
and 4. Replacing bucket 3 with `empty` when deleting `26` makes a lookup for
`34` stop too early. A tombstone preserves reachability:

```text
before: [18][26][34][empty]
wrong:  [18][empty][34]       lookup(34) reports absent
right:  [18][tomb][34]        lookup crosses the tombstone
```

Insertion remembers the first tombstone but continues probing until it proves
the key is absent. Otherwise it can create duplicate keys. Backward-shift
deletion is another option: move later entries toward their ideal buckets while
preserving every probe path. It avoids tombstone buildup but makes erase more
expensive and subtle.

## Load and clustering

Load factor is `live entries / capacity`. In an open-addressed table, empty
slots are termination evidence. As they disappear, successful and especially
unsuccessful probes grow. Linear probing also creates **primary clusters**:
keys that collide with either the ideal bucket or the edge of an existing run
extend the same run.

Track more than the mean:

- probe-count histogram for hit and miss operations;
- maximum probe distance;
- tombstone count and age;
- rehash frequency and bytes moved; and
- latency by table occupancy and key distribution.

An average lookup can remain attractive while the rare failed lookup crosses a
large cluster. That tail is often the important observation in a latency budget.

## Robin Hood hashing

Robin Hood insertion compares each entry's distance from its ideal bucket. If
the newcomer has probed farther than the resident, they swap; the displaced
entry continues probing.

```text
distance(entry, slot) = (slot - ideal(entry) + capacity) mod capacity
```

This tends to reduce variance in probe lengths by taking slots from entries
that are "richer"—closer to home—and giving them to entries farther away.
Lookup may stop when the current probe distance exceeds the resident's distance,
provided deletion and metadata preserve that invariant.

## C++ standard baseline

[`std::unordered_map`](https://eel.is/c++draft/unord.map) and
[`std::unordered_set`](https://eel.is/c++draft/unord.set) provide average
constant-time key lookup. The standard specifies observable behavior, not one
particular bucket representation.

```cpp
std::unordered_map<std::uint64_t, OrderHandle> orders;
orders.reserve(expected_orders);
orders.max_load_factor(0.70f);

auto [it, inserted] = orders.try_emplace(order_id, handle);
if (!inserted) return DuplicateOrderId{};

if (auto found = orders.find(order_id); found != orders.end()) {
    cancel(found->second);
    orders.erase(found);
}
```

`reserve` controls expected element count; `rehash` controls bucket count.
Rehashing invalidates iterators and can create a large latency event. Measure
your library implementation and allocator rather than inferring its layout from
the type name.

## Rust standard baseline

[`HashMap`](https://doc.rust-lang.org/std/collections/struct.HashMap.html) and
[`HashSet`](https://doc.rust-lang.org/std/collections/struct.HashSet.html) are
the standard hash collections. `entry` combines lookup with insert-or-update:

```rust
use std::collections::HashMap;

let mut orders = HashMap::with_capacity(expected_orders);
match orders.entry(order_id) {
    std::collections::hash_map::Entry::Vacant(slot) => {
        slot.insert(handle);
    }
    std::collections::hash_map::Entry::Occupied(_) => {
        return Err(DuplicateOrderId);
    }
}
```

The default hasher is selected for resistance to adversarial collision attacks,
not guaranteed to be the fastest choice for small trusted integer keys. Changing
the hasher changes the threat model as well as performance. Iteration order is
not an application invariant in either language.

## A bounded ID index

For a hot-path `order_id -> pool handle` index, a custom fixed-capacity table can
exclude growth and allocation. A slot might store:

```text
state: empty | occupied | tombstone
fingerprint: selected hash bits
order_id: 64 bits
handle: slot index + generation
```

The fingerprint can reject most nonmatches before loading the full key. A power-
of-two capacity replaces modulo with a mask only when hash bits are adequately
mixed. Capacity exhaustion must have an explicit policy: reject, rebuild outside
the hot path, or switch to reserved overflow storage.

Correctness properties to test:

1. every inserted live key is found exactly once;
2. deleted keys are absent while keys beyond their tombstones remain reachable;
3. duplicate insertion follows the chosen replace-or-reject contract;
4. full-table lookup terminates; and
5. wraparound probing visits each slot at most once.

## Bloom filters: a different promise

A Bloom filter is a compact probabilistic membership prefilter. Insert sets `k`
bit positions derived from the key; query checks those positions.

```text
any required bit is zero -> definitely absent
all required bits are one -> possibly present
```

It stores no value and can return false positives. A conventional Bloom filter
does not return false negatives for inserted items, assuming correct operation
and no unsupported deletion. Clearing shared bits can create false negatives;
a counting Bloom filter uses counters when deletion is required.

Use one only when avoiding enough expensive negative lookups repays its hashing
and cache traffic. It does not replace the authoritative map.

## Failure modes

- a weak low-bit hash meets a power-of-two mask and forms deterministic clusters;
- a table reaches full occupancy and an unbounded probe loop never terminates;
- erase writes `empty` and disconnects keys later in the cluster;
- tombstones accumulate, making an apparently low live load misleading;
- a surprise rehash allocates and moves work into the hot path;
- hostile keys collapse expected constant time; or
- a benchmark uses uniform random keys while production keys share structure.

## Build it from a blank file

Implement a fixed-capacity linear-probing map from `u64`/`std::uint64_t` to a
32-bit handle in both languages. Do not resize in version one.

Required operations:

```text
insert(key, value) -> inserted | duplicate | full
find(key)          -> value | absent
erase(key)         -> erased | absent
clear()
```

Then add, one at a time:

1. tombstone reuse without duplicate insertion;
2. probe-count instrumentation;
3. backward-shift deletion;
4. stored fingerprints; and
5. Robin Hood displacement metadata.

Keep each version so the benchmark compares representations, not recollections.

## Measure the claim

Pre-generate identical traces containing hits, misses, inserts, and erases.
Sweep occupancy from 25% through the highest load the design supports. Test
uniform keys, sequential keys, deliberately colliding keys, and a production-
shaped distribution if one exists.

Report throughput plus p50, p95, p99, p99.9, and maximum operation latency.
Also report probes per operation, bytes per entry, allocation count, and rehash
events. Compare against the standard containers with capacity prepared before
the timed region.

## Checkpoint

Before continuing, explain without notes:

- why an empty slot terminates lookup but a tombstone does not;
- why `O(1)` expected time permits bad latency tails;
- what Robin Hood displacement changes;
- when standard-container rehashing can enter a latency trace; and
- why a Bloom filter cannot serve as the order-ID map.

If those answers are precise, you understand the table's invariants rather than
only its API.

Next: [Ordered indexes](06-ordered-indexes.md).
