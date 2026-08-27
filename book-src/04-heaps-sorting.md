# Heaps, priority queues, and sorting

<p class="chapter-subtitle">Maintain only the ordering the workload needs.</p>

A priority queue does not keep every element sorted. It promises access to the
element with greatest—or least—priority and supports inserting new elements.
A binary heap is the usual contiguous representation.

For a max-heap stored in an array, every parent is at least as large as its
children:

```text
heap[parent] ≥ heap[left child]
heap[parent] ≥ heap[right child]
```

The array encodes the tree without pointers:

```text
parent(i) = (i - 1) / 2
left(i)   = 2i + 1
right(i)  = 2i + 2
```

The root at index zero is the maximum. Siblings and separate subtrees have no
required order.

## Repair paths

Insertion appends at the end, then **sifts up** while the new value outranks its
parent. Removing the maximum swaps the last value into the root, removes the
last slot, then **sifts down** through the better child.

```text
push: append → compare with parent → swap upward
pop:  move last to root → compare children → swap downward
```

Only one root-to-leaf path changes, so both operations take `O(log n)`
comparisons in the worst case. Reading the root is `O(1)`.

<div class="ms-lab" data-ms-heap>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Repair a max-heap</h3></div>
    <p>Push, pop, replace the root, or heapify an unsorted batch. Highlighted indices show the most recent repair path.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="push">push next</button>
    <button type="button" data-action="pop">pop max</button>
    <button type="button" data-action="replace">replace root</button>
    <button type="button" data-action="heapify">heapify batch</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>size</span><strong data-stat="size">0</strong></div>
    <div><span>maximum</span><strong data-stat="root">none</strong></div>
    <div><span>comparisons</span><strong data-stat="comparisons">0</strong></div>
    <div><span>swaps</span><strong data-stat="swaps">0</strong></div>
  </div>
  <div class="ms-heap" data-heap-nodes aria-label="Array representation of a max-heap"></div>
  <p class="ms-log" data-heap-log>The heap is empty.</p>
</div>

## Build a heap in linear time

Pushing `n` arbitrary values individually costs `O(n log n)`. Bottom-up
heapify starts at the final parent and sifts each internal node downward:

```text
for i from floor(n / 2) - 1 down to 0:
    sift_down(i)
```

This is `O(n)`, not `O(n log n)`. Most nodes are near the leaves and can move
only a short distance; very few nodes have full tree height available.

Use heapify when a batch already exists. Use repeated push when values arrive
online and the best element must remain available between arrivals.

## C++ `std::priority_queue`

[`std::priority_queue`](https://eel.is/c++draft/priority.queue) is a container
adaptor. By default it uses `std::vector<T>` and `std::less<T>`, producing a
max-priority queue.

```cpp
std::priority_queue<int> max_heap;
max_heap.push(17);
max_heap.push(63);
max_heap.push(42);

assert(max_heap.top() == 63);
max_heap.pop();
```

A min-priority queue reverses the comparator:

```cpp
std::priority_queue<int, std::vector<int>, std::greater<int>> min_heap;
```

The adaptor deliberately does not expose arbitrary iteration, removal, or key
updates. If the workload needs them, the contract is larger than a plain
priority queue.

## Rust `BinaryHeap<T>`

Rust's [`BinaryHeap<T>`](https://doc.rust-lang.org/std/collections/struct.BinaryHeap.html)
is also a max-heap:

```rust
use std::cmp::Reverse;
use std::collections::BinaryHeap;

let mut max_heap = BinaryHeap::from([17, 63, 42]);
assert_eq!(max_heap.peek(), Some(&63));
assert_eq!(max_heap.pop(), Some(63));

let mut min_heap = BinaryHeap::new();
min_heap.push(Reverse(17));
min_heap.push(Reverse(8));
assert_eq!(min_heap.pop(), Some(Reverse(8)));
```

As with a vector, pushing can grow the backing allocation. Reserve capacity or
use a bounded custom heap when allocation must be excluded from a hot path.

## Indexed heaps

A normal heap cannot efficiently find an arbitrary order ID. An **indexed
heap** adds a map from stable ID to current heap position:

```text
heap position 0  1  2  3 ...
ID map       id → current position
```

Every swap must update both affected map entries. The invariants become:

```text
heap order holds at every parent
position[id] points to the element carrying id
every heap element has exactly one position entry
```

Now removing or changing the priority of a known ID can repair from its current
position in `O(log n)`. The extra index, memory traffic, and coupled invariants
are worthwhile only when those operations belong to the workload.

## Why a heap is usually wrong for price-time priority

A heap is excellent when only the globally best priority matters. An order book
also needs:

- FIFO order among orders at the same price;
- cancellation by order ID;
- aggregation by price level; and
- navigation to the next occupied price.

A single heap does not provide those access paths. It may still be useful for
timers, scheduled events, top-`k` selection, or selecting the next task by one
priority.

## Sorting is a different workload

Sorting answers a batch question: arrange every element. A priority queue
answers an online question: keep the best element available as mutations occur.

Comparison sorting has an `Ω(n log n)` lower bound in the general comparison
model. Integer keys can exploit structure:

- counting sort uses a manageable dense key range;
- radix sort processes fixed-width key digits;
- bucket methods exploit known distributions.

Choose along several axes:

| Property | Question |
|---|---|
| stable | must equal keys preserve input order? |
| in-place | how much auxiliary memory is acceptable? |
| online | must best remain available between inserts? |
| key domain | arbitrary comparison or bounded integer? |
| batch size | does setup dominate small batches? |

## The build

Implement a max-heap over contiguous storage with:

```text
push, top, pop, replace_top, heapify, size
```

Then add an indexed version keyed by integer ID. Require:

- a heap-invariant checker after every debug mutation;
- a position-map checker for the indexed version;
- randomized differential tests against `std::priority_queue` and
  `BinaryHeap` behavior;
- duplicate-priority tests; and
- operation sequences that update and remove arbitrary IDs.

## What to measure

- repeated push versus bottom-up heapify;
- push/pop under steady and bursty mixes;
- normal versus indexed heap;
- reserved versus growth-boundary pushes;
- binary heap versus sorted vector for small cardinalities;
- heap sort versus comparison and radix sorts; and
- element payload in-place versus heap entries holding compact handles.

Report comparisons and swaps alongside time. They help separate algorithmic
work from element size and memory effects.

## Checkpoint

1. Which ordering does a binary heap guarantee—and which does it not?
2. Why is bottom-up heapify linear?
3. What invariant must an indexed heap maintain on every swap?
4. Why does a heap expose best price but fail the rest of an order-book
   contract?
5. When does sorting the whole batch beat maintaining an online heap?

Next: [Hashing under pressure](05-hashing.md).
