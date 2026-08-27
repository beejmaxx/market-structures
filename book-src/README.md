# Market Structures

<div class="chapter-meta"><span>Data structures</span><span>Low latency</span><span>C++ and Rust</span></div>

Fast systems are not produced by memorizing that one language, container, or
algorithm is “faster.” They are produced by connecting four things:

```text
workload → invariants → representation → measured behavior
```

This book teaches that connection through the data structures that appear in
low-latency market systems. Each finished chapter explains the structure,
builds it from first principles, attacks its invariants, and measures the
machine behavior that asymptotic notation leaves out.

The first eighteen chapters are complete learning chapters:

- **Arrays and memory layout** develops fixed extent, slices and spans, stride,
  multidimensional layout, and AoS versus SoA.
- **Vectors** develops the contiguous-storage model, growth, invalidation,
  movement, and cache behavior.
- **Linked lists** develops pointer rewiring, sentinels, intrusive ownership,
  free-list reuse, and the cost of scattered traversal.
- **Stacks** develops LIFO semantics, container adaptors, fixed capacity, and
  free-slot reuse.
- **Queues, deques, and ring buffers** develops wraparound state, bounded
  capacity, backpressure semantics, and object lifetime inside fixed storage.
- **Heaps, priority queues, and sorting** develops partial order, repair paths,
  indexed updates, heapify, and batch-versus-online choices.
- **Hashing under pressure** develops collision policies, probe invariants,
  tombstones, load-sensitive tails, and bounded ID indexes.
- **Ordered indexes** connects balanced trees, B-trees, flat maps, ordered
  navigation, and the price-level access path.
- **Tries and radix structures** uses key digits, prefix sharing, compression,
  and compact child layouts for string and integer indexes.
- **Graphs and disjoint sets** develops packed adjacency, traversal worklists,
  reachability, shortest paths, and amortized connectivity.
- **Bitsets and occupancy maps** develops word-level set operations, bit scans,
  hierarchical summaries, and bounded price navigation.
- **Range and interval structures** separates prefix, Fenwick, segment, and
  overlap indexes by update pattern and query contract.
- **Memory hierarchy** connects cache lines, TLBs, branches, dependencies,
  prefetching, and coherence to representation choices.
- **Allocation, arenas, slabs, and pools** makes lifetime, LIFO reuse,
  generations, bounded capacity, and failure policy explicit.
- **Data layout and indirection** separates semantic parity from physical
  parity while comparing AoS, SoA, hot/cold, pointers, and handles.
- **Concurrency and atomics** derives publication ordering from ownership and
  builds toward a bounded SPSC queue without hand-waving the memory model.
- **Benchmark design** turns language and representation claims into controlled,
  falsifiable experiments with durable evidence.
- **Order-book representations** assembles price navigation, FIFO, ID lookup,
  pooling, matching semantics, and repository study into one defended system.

The [learning roadmap](roadmap.md) shows where the book goes next. A topic is
listed as a chapter only after it contains enough material to learn from; the
roadmap is deliberately not presented as finished instruction.

## The standard of evidence

For every representation, be able to answer:

1. What operations must the abstract data type provide?
2. What workload—operation mix, cardinality, locality, and key distribution—do
   we actually expect?
3. What invariants make every mutation correct?
4. What does the representation force the machine to do?
5. Which measurement could prove our prediction wrong?

The goal is not “know every data structure.” It is to choose and defend a
representation under real constraints.
