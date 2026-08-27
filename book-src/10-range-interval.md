# Range and interval structures

<p class="chapter-subtitle">Precompute exactly enough structure for the aggregate or overlap query you actually ask.</p>

An array gives `value[i]`. Many workloads ask a larger question:

```text
sum values in [left, right)
minimum over [left, right)
add delta to one position
find every interval overlapping a point
```

The right structure depends on whether data mutates, which algebra the aggregate
supports, and whether the query is about values at points or intervals spanning
points.

## Prefix sums

For an immutable or batch-refreshed array, build:

```text
prefix[0] = 0
prefix[i + 1] = prefix[i] + values[i]
sum(left, right) = prefix[right] - prefix[left]
```

Construction is `O(n)` and each range sum is `O(1)`. Changing one input makes
every later prefix stale, so a point update is `O(n)`. Prefix sums are the
baseline to beat when updates are rare or can be batched.

Use a wider accumulator when sums can exceed element width. Specify overflow,
floating-point order, and whether ranges are half-open. Half-open `[left,
right)` composes cleanly and represents empty ranges without special indices.

## Fenwick tree

A Fenwick tree (binary indexed tree) stores partial aggregates in a flat array.
For one-based index `i`, `lowbit(i) = i & -i`. Entry `tree[i]` covers:

```text
[i - lowbit(i) + 1, i]
```

A prefix query repeatedly removes the lowest set bit; a point update repeatedly
adds it:

```text
prefix(i): while i > 0: sum += tree[i]; i -= lowbit(i)
add(i,d):  while i <= n: tree[i] += d; i += lowbit(i)
```

Both touch `O(log n)` densely stored entries. A range sum is the difference of
two prefixes. This relies on an inverse operation such as subtraction; a plain
Fenwick tree is not a general drop-in for every range aggregate.

<div class="ms-lab" data-ms-range>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Walk Fenwick update and query paths</h3></div>
    <p>The values and tree are separate arrays. Highlighted tree entries are exactly those touched by the operation.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="prefix">prefix sum [0, 5)</button>
    <button type="button" data-action="range">range sum [2, 7)</button>
    <button type="button" data-action="update">add 4 at index 3</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>operation</span><strong data-stat="operation">none</strong></div>
    <div><span>answer</span><strong data-stat="answer">none</strong></div>
    <div><span>tree entries touched</span><strong data-stat="touched">0</strong></div>
    <div><span>total value</span><strong data-stat="total">18</strong></div>
  </div>
  <div class="ms-range-row"><strong>values</strong><div class="ms-range-slots" data-range-values></div></div>
  <div class="ms-range-row"><strong>Fenwick</strong><div class="ms-range-slots" data-range-tree></div></div>
  <p class="ms-log" data-range-log>Select a query or point update.</p>
</div>

## Segment trees

A segment tree recursively partitions a range. Leaves represent elements;
internal nodes store the combination of their children:

```text
                    [0, 8)
              /                 \
          [0, 4)                [4, 8)
         /      \              /      \
      [0,2)    [2,4)        [4,6)    [6,8)
```

For an associative combine operation with an identity—a **monoid**—range query
and point update take `O(log n)`. Sum, minimum, maximum, greatest common divisor,
and small custom summaries can fit this contract.

An iterative segment tree stores leaves in the second half of one array and
parents before them. It is dense and avoids pointer recursion. A recursive node
tree is flexible for huge sparse coordinate spaces but pays allocation and
indirection.

**Lazy propagation** delays a whole-range update by attaching a pending tag to
an internal node. A later partial query or update pushes the tag to children.
The tag's composition with existing tags and aggregates is the core invariant;
“lazy” reduces work only when updates cover ranges.

## Sparse tables

If values never change and the operation is idempotent, such as minimum or
maximum, a sparse table precomputes aggregates for power-of-two blocks. A range
minimum uses two overlapping blocks in `O(1)`. Build and storage are `O(n log
n)`. It is a useful reminder that immutability can buy a simpler, faster query
than any dynamic tree.

## Interval overlap is a different query

An interval collection stores objects like `[start, end)`. Typical queries ask
which intervals contain a point or overlap another interval. Sorting only by
start cannot stop after the first early start because an older interval may
extend far to the right.

An interval tree augments an ordered tree with the maximum endpoint in each
subtree:

```text
node.max_end = max(node.end, left.max_end, right.max_end)
```

When searching for overlap with `[q_start, q_end)`, a subtree whose `max_end <=
q_start` can be skipped. Reporting `k` overlaps still costs at least `O(k)`.
Mutation must repair both balance metadata and `max_end` along affected paths.

Use cases include validity windows, reservations, scheduled risk limits, and
time-range diagnostics. This is not what a Fenwick or ordinary segment sum tree
answers, despite all three being called “range structures.”

## C++ and Rust baselines

Neither standard library provides Fenwick, segment, or interval trees. Begin
with contiguous storage:

```cpp
template<class T>
struct Fenwick {
    std::vector<T> tree; // tree[0] unused
};
```

```rust
struct Fenwick<T> {
    tree: Vec<T>, // tree[0] unused
}
```

For an interval baseline, sort a standard vector by start and scan it. For an
ordered mutable baseline, use `std::map` or `BTreeMap` plus a deliberately slow
full scan to validate the augmented custom tree. Standard containers are the
building material and correctness oracle even when they do not expose the final
specialized contract.

## Aggregate market depth

Suppose `volume[tick]` stores aggregate quantity at each price. Then:

- direct array access gives volume at one price;
- a prefix or Fenwick tree gives volume across a price band;
- a segment tree can also track maximum level size or a composite summary;
- an occupancy bitmap finds the next nonempty price; and
- FIFO lists at each price preserve order priority.

A Fenwick tree does not replace the volume array: it is an auxiliary index.
Every add, cancel, fill, and level deletion must update both sources exactly
once. Cached total volume offers an `O(1)` whole-book sum but not arbitrary
bands; again, match index cost to query shape.

## Custom bounded design

When price ticks occupy a fixed window, allocate the value array, Fenwick tree,
and occupancy bitmap together. Convert external price to internal index with a
checked mapping. A window move can rebuild all derived indexes outside the hot
path or reject out-of-window prices according to an explicit policy.

Store the narrowest safe aggregate type, not the narrowest input type. In a
single-writer engine, ordinary integer arrays avoid synchronization. Readers can
consume snapshots or published summaries rather than racing individual tree
entries during a multi-entry update.

## Failure modes

- zero-based and one-based Fenwick indices are mixed, causing an infinite loop;
- `[left, right]` and `[left, right)` contracts are confused;
- aggregate arithmetic overflows silently;
- a point value changes but its auxiliary tree does not;
- a segment-tree identity is wrong for empty overlap;
- lazy tags compose in the wrong order;
- interval endpoints use inconsistent open/closed semantics; or
- a benchmark compares a dynamic tree with prefix sums but times prefix rebuilds
  inconsistently.

## Build it from a blank file

Implement and retain four versions over the same integer array:

1. direct range scan;
2. prefix sums;
3. Fenwick tree; and
4. iterative segment tree.

Support point assignment, point addition, and half-open range sum where the
representation permits it. Differential-test every randomized operation
against direct scan. Validate every Fenwick entry against its stated coverage
range and every segment parent against the combination of its children.

Then build an interval-overlap index augmented with `max_end`. Compare reported
interval identities—not just counts—against a full scan.

## Measure the claim

Sweep array size, update/query ratio, and range width. Separate construction,
point updates, prefix queries, narrow ranges, wide ranges, and full-range queries.
Record latency percentiles, entries touched, bytes, cache misses, and allocations.

For depth experiments, replay the same price updates through direct scan,
Fenwick, and segment representations. Include the update cost required to keep
each auxiliary index correct. A query-only benchmark would answer a different
question.

## Checkpoint

Explain:

- why prefix sums give constant queries but linear point updates;
- what interval each Fenwick entry covers;
- which algebra a segment tree requires;
- how `max_end` prunes an interval search; and
- why occupancy, FIFO, ID lookup, and range volume deserve separate indexes.
