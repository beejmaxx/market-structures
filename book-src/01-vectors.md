# Vectors

<p class="chapter-subtitle">Contiguous storage, geometric growth, and the real cost hidden inside amortized constant time.</p>

A vector is a sequence of live objects stored next to one another. Its useful
model is three machine words plus a contiguous allocation:

<div class="ms-layout" aria-label="Vector representation">
  <div><strong>data</strong><span>address of slot 0</span></div>
  <div><strong>size</strong><span>live objects</span></div>
  <div><strong>capacity</strong><span>available slots</span></div>
</div>

The contract says “indexed sequence.” Contiguous storage is the representation
choice that makes indexing cheap, scanning predictable, and growth disruptive.

## Start with the invariant

For a vector with storage for `capacity` elements:

```text
0 ≤ size ≤ capacity
slots [0, size)        contain live objects
slots [size, capacity) contain no live objects
logical order equals physical order
```

Those statements are more precise than “the vector owns an array.” They tell
you which objects must be constructed, which must be destroyed, and which
memory may only be treated as raw storage.

## `size` is not `capacity`

If `size == 3` and `capacity == 8`, only the first three slots contain objects.
The remaining five slots are permission to construct future objects without
obtaining another allocation.

<div class="ms-slots static" aria-label="Vector with size three and capacity eight">
  <span class="live">A</span><span class="live">B</span><span class="live">C</span><span></span><span></span><span></span><span></span><span></span>
</div>

Confusing reserved storage with live objects causes double destruction,
uninitialized reads, or impossible generic requirements such as forcing every
element type to have a default value.

## Growth is occasional linear work

When `size < capacity`, appending constructs one object in the next slot. When
`size == capacity`, the vector must:

1. obtain a larger allocation;
2. move or copy every live object into it;
3. destroy the objects in the old allocation;
4. release the old allocation; and
5. construct the new element.

Growing geometrically—commonly by a factor near two—keeps the total movement
across many appends linear. That makes append **amortized** `O(1)`, not
worst-case `O(1)`.

<div class="ms-lab" data-ms-vector>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Watch capacity growth</h3></div>
    <p>Push until a reallocation occurs. The move counter represents existing elements copied or moved into new storage.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="push">push</button>
    <button type="button" data-action="pop">pop</button>
    <button type="button" data-action="reserve">reserve 8</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>size</span><strong data-stat="size">0</strong></div>
    <div><span>capacity</span><strong data-stat="capacity">0</strong></div>
    <div><span>reallocations</span><strong data-stat="reallocations">0</strong></div>
    <div><span>elements moved</span><strong data-stat="moves">0</strong></div>
  </div>
  <div class="ms-slots" data-vector-slots aria-label="Current vector storage"></div>
  <p class="ms-log" data-vector-log>There is no allocation yet.</p>
</div>

`reserve(8)` changes capacity but not size. `pop()` destroys the final object
but normally does not reduce capacity. Both facts matter when you predict
allocator traffic in a hot path.

## Invalidation is part of the API

Reallocation changes the address of every element. Any pointer, reference, or
iterator into the old allocation becomes invalid.

| Operation | References before the operation |
|---|---|
| indexed read or write | remain valid |
| append without growth | remain valid |
| append with growth | all invalid |
| middle insertion without growth | those at or after the insertion may be invalid |
| middle erase | those at or after the erased element may be invalid |

This is the central trade: contiguous storage gives excellent traversal but
does not promise stable addresses.

## C++ and Rust expose the same physical idea

C++:

```cpp
std::vector<Order> orders;
orders.reserve(4096);
orders.push_back(order);

Order* first = &orders[0];
// A later push_back that exceeds capacity invalidates first.
```

Rust:

```rust
let mut orders: Vec<Order> = Vec::with_capacity(4096);
orders.push(order);

// Rust prevents holding a reference into `orders` while mutating it.
// The reallocation hazard still exists; the borrow checker constrains access
// to that hazard rather than changing the representation.
```

The languages differ in how they let you express access and lifetime, but both
containers fundamentally track a pointer, length, and capacity over contiguous
elements.

## Why scans are fast

Contiguous traversal gives the hardware a regular address stream. A fetched
cache line contains several upcoming elements, prefetchers can recognize the
pattern, and each next address requires little dependent work.

That does **not** mean vectors always win. They lose when the workload requires
stable addresses, frequent large middle mutations, or growth that cannot be
kept outside a latency-sensitive boundary.

## The build

Implement two C++ containers before benchmarking either one:

1. `FlatVector<T>` with geometric growth; and
2. `StaticVector<T, N>` with fixed capacity and no allocation.

Support only:

```cpp
size(), capacity(), operator[], emplace_back(), pop_back(), clear()
```

Keep the surface small enough that you can audit every lifetime transition.
Differential-test observable behavior against `std::vector` for operation
sequences that stay within your supported contract.

## What to measure

Measure separate questions instead of producing one “vector benchmark.”

- append with capacity already reserved;
- append across growth boundaries;
- sequential scan as the working set moves from L1-sized to memory-sized;
- random indexed access;
- middle insertion for several element sizes; and
- the fixed-capacity version against the growable version.

Before running, predict where the curves change and which mechanism causes each
change. Report distributions for latency-sensitive operations, not only a
single average.

## Checkpoint

You own this chapter when you can answer without code:

1. Why can amortized `O(1)` append still produce a bad latency outlier?
2. Which exact operations invalidate an address into your implementation?
3. Why might a sorted vector beat a balanced tree for a read-heavy workload?
4. What workload change would make stable-address storage worth its traversal
   cost?

Next: [Linked lists](02-linked-lists.md).
