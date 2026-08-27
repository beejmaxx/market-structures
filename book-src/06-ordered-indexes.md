# Ordered indexes

<p class="chapter-subtitle">Pay for maintained order only when the workload uses ordered questions.</p>

A hash table answers “is key `k` present?” An ordered index additionally
answers:

```text
minimum / maximum
predecessor / successor
first key >= k
iterate [lo, hi) in key order
```

That contract is useful for price levels, time ranges, and sparse occupied
indices. It is larger than exact lookup, so it usually costs more metadata,
comparisons, or movement.

## The binary-search-tree invariant

For every node:

```text
all keys in left subtree  < node.key
all keys in right subtree > node.key
```

Equal keys need an explicit policy: reject them, replace the value, store a
count, or keep a secondary collection. Search follows one root-to-leaf path.
Its cost is proportional to tree height—not automatically `log n`.

```text
balanced insertion:       4           sorted insertion: 1
                        /   \                            \
                       2     6                            2
                      / \   / \                            \
                     1   3 5   7                            3 ...
```

The second tree is a linked list wearing a tree API.

<div class="ms-lab" data-ms-ordered>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Two representations, one ordered search</h3></div>
    <p>Compare the nodes touched by binary search in a sorted array with a balanced pointer tree.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-key="29">find 29</button>
    <button type="button" data-key="55">find 55</button>
    <button type="button" data-key="24">lower_bound 24</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-ordered-row"><strong>sorted array</strong><div class="ms-ordered-slots" data-ordered-array></div></div>
  <div class="ms-ordered-row"><strong>balanced tree</strong><div class="ms-ordered-slots tree" data-ordered-tree></div></div>
  <p class="ms-log" data-ordered-log>Select a query to expose both access paths.</p>
</div>

The comparison count may be similar. The machine work is not: binary search
jumps within one allocation, while a node tree follows separately addressed
objects. The array has better density; the tree can insert without shifting all
later values and keeps node references stable under ordinary insertion.

## AVL and red-black trees

Self-balancing trees constrain height using local metadata and rotations.

An **AVL tree** stores or derives a balance factor:

```text
balance(node) = height(left) - height(right)
allowed: -1, 0, +1
```

Insertion or deletion updates ancestors and rotates where the constraint is
violated. The strict height bound gives short lookup paths but may require more
rebalancing work.

A **red-black tree** uses color and path rules. A common formulation requires:

1. every node is red or black;
2. the root is black;
3. no red node has a red child; and
4. every path from a node to an absent leaf contains the same black count.

These rules keep height logarithmic with a looser bound and often fewer update
rotations. Both designs require parent/child links, balancing metadata, and
careful rewiring. The exact standard-container implementation is not promised
by either language API.

## C++ `map`, `set`, and flat alternatives

[`std::map`](https://eel.is/c++draft/map) and
[`std::set`](https://eel.is/c++draft/set) maintain sorted keys and logarithmic
search, insertion, and erasure. Iterators traverse in key order; references to
other elements survive ordinary insert and erase operations.

```cpp
std::map<Price, PriceLevel> asks;

auto [level, inserted] = asks.try_emplace(price);
level->second.enqueue(order);

auto best = asks.begin();                 // minimum ask
auto first_crossing = asks.lower_bound(limit_price);
```

[`std::flat_map`](https://eel.is/c++draft/flat.map) stores sorted key/value
sequences. Lookup is logarithmic, iteration is dense, and insertion may be
linear because later elements move. It is attractive when reads and scans
dominate mutations or when updates can be batched.

## Rust `BTreeMap` and sorted slices

Rust's [`BTreeMap`](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html)
and [`BTreeSet`](https://doc.rust-lang.org/std/collections/struct.BTreeSet.html)
provide ordered maps and sets:

```rust
use std::collections::BTreeMap;

let mut asks: BTreeMap<Price, PriceLevel> = BTreeMap::new();
asks.entry(price).or_default().enqueue(order);

let best = asks.first_key_value();
for (price, level) in asks.range(lo..hi) {
    consume(*price, level);
}
```

A sorted `Vec<(K, V)>` plus [`slice::binary_search_by_key`](https://doc.rust-lang.org/std/primitive.slice.html#method.binary_search_by_key)
is the direct flat baseline. Search is logarithmic; insert and erase shift a
suffix. `partition_point` is useful for lower-bound style queries.

## Why B-trees exist

A binary node spends one comparison step per node and carries a small number of
links. A B-tree node holds many sorted keys and many child links:

```text
[ 12 | 27 | 41 ]
  /     |    |   \
 <12  12..27  ... >41
```

High fanout reduces height and amortizes each pointer traversal across several
comparisons. Nodes can be sized for cache lines, pages, or storage blocks. On
insertion, a full node splits and promotes a separator. On deletion, sparse
siblings may borrow or merge.

A B+ tree keeps values in linked leaves and separators in internal nodes, which
makes ordered range scans especially natural. The central tradeoff is more
complex in-node mutation for fewer levels and denser traversal.

## Other ordered representations

**Skip lists** layer progressively sparser forward links over a sorted base
list. Randomized heights give expected logarithmic search. Their simple local
link changes can help concurrent designs, but multiple pointers per node and
random traversal still cost space and locality.

**Treaps** combine the BST key invariant with heap order on a priority. Random
priorities give expected logarithmic height and rotations with a compact proof.

**Dense direct indexing** uses the key itself—or `key - base`—as an array
index. When the price domain is bounded and reasonably dense, this can beat all
general ordered structures. Occupancy metadata is then needed to find the next
live price efficiently; the bitset chapter develops that design.

## Price levels are not orders

For price-time priority, use two levels of structure:

```text
ordered index by price
    price -> FIFO queue of orders at that price
```

The tree or flat index finds the best occupied price. The per-price queue
preserves time priority. An order-ID map supplies cancellation without searching
either structure. One structure should not be stretched to fake all three
access paths.

## Custom representation choices

A bounded tree can store nodes in a preallocated array and use integer indices:

```text
Node { key, value, left_index, right_index, parent_index, balance }
```

Indices reduce pointer width when capacity permits, serialize cleanly, and pair
with a free-list allocator. A generation must accompany an externally retained
index if slots can be recycled. Rotations update the same graph edges as pointer
trees; index zero or a dedicated sentinel can represent “none.”

For read-heavy data, a sorted vector with a delta buffer is another custom
design. Mutations collect in a small hot buffer; a quiet-period merge restores
one dense sorted run. Queries search both sources. This trades simple worst-case
bounds for explicit batching and locality.

## Failure modes

- an unbalanced BST receives monotonic keys and becomes linear;
- a rotation updates children but forgets the root or parent link;
- a comparator violates strict weak ordering;
- price and time priority are conflated in one comparison key;
- a node-oriented baseline is judged only by comparison count;
- flat insertion unexpectedly moves large values or invalidates references; or
- an iterator crosses a mutation whose invalidation rule was assumed, not read.

## Build it from a blank file

Implement three ordered sets over 32-bit integer keys:

1. a sorted vector with binary search;
2. an unbalanced BST from a fixed node pool; and
3. an AVL tree using the same pool.

Required queries are `contains`, `insert`, `erase`, `lower_bound`, and in-order
iteration. After every mutation, write a slow validator that recursively checks
key ranges, parent links, stored heights, balance factors, reachability, and that
every live pool node appears exactly once.

Differential-test the operation stream against `std::set` in C++ and `BTreeSet`
in Rust. Feed ascending, descending, alternating-extreme, duplicate-heavy, and
random sequences—not just uniform random insertion.

## Measure the claim

Benchmark exact hits, misses, lower bounds, inserts, erases, and full sorted
scans separately. Sweep cardinality and mutation ratio. Record comparisons,
nodes or cache lines touched, bytes per key, allocations, latency percentiles,
and iterator throughput.

The interesting crossover is not “tree versus vector” in general. It is the
point where movement from mutations outweighs the dense lookup and scan path for
your key/value sizes and operation mix.

## Checkpoint

Before continuing, explain:

- why the BST invariant alone does not give logarithmic lookup;
- how AVL and red-black constraints bound height differently;
- why a B-tree can outperform a binary tree without fewer comparisons;
- when a sorted vector is the strongest baseline; and
- why a price-level index still needs FIFO queues and an order-ID map.

Next: [Tries and radix structures](07-tries-radix.md).
