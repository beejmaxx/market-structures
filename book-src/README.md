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

The first five chapters are complete learning chapters:

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
