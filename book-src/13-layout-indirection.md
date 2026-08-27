# Data layout and indirection

<p class="chapter-subtitle">An abstract structure fixes relationships; a physical layout decides which bytes and addresses each operation touches.</p>

Two implementations can both be “an array of orders” while producing different
cache lines, movement, reference stability, and vectorization opportunities.
Language parity at the API level does not imply layout parity.

```text
semantic parity: same operations, results, and failure policy
layout parity:   same field order, size, alignment, padding, and addressing
work parity:     same trace and measured boundary
```

Use semantic and work parity for a fair algorithm comparison. Require layout
parity only when the experiment is specifically about language overhead under
the same representation.

## Array of structures

An array of structures (AoS) stores complete records consecutively:

```text
[id price qty flags][id price qty flags][id price qty flags]
```

It is natural when each operation consumes most fields of one record. Iterating
orders at a price level may need ID, quantity, participant flags, and links
together. One record load can provide them.

If an operation scans only price or quantity, each cache line also carries
unused fields. Large cold metadata dilutes the hot stream.

## Structure of arrays

SoA gives each field its own contiguous array:

```text
ids:    [id id id id ...]
prices: [p  p  p  p  ...]
qtys:   [q  q  q  q  ...]
flags:  [f  f  f  f  ...]
```

Single-field scans become dense and may vectorize easily. Accessing every field
for one element touches several streams and must keep their indices synchronized.
Insertion, swap-removal, and compaction update all component arrays together.

<div class="ms-lab" data-ms-layout-lab>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Expose the bytes an operation needs</h3></div>
    <p>Both layouts contain six orders with ID, price, quantity, and flags. Highlighting shows useful fields, not a claim about exact cache-line size.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="price">scan every price</button>
    <button type="button" data-action="record">read order 2</button>
    <button type="button" data-action="cold">scan flags</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-layout-compare">
    <div><strong>AoS</strong><div class="ms-layout-cells aos" data-layout-aos></div></div>
    <div><strong>SoA</strong><div class="ms-layout-cells soa" data-layout-soa></div></div>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>useful fields</span><strong data-stat="useful">0</strong></div>
    <div><span>field streams</span><strong data-stat="streams">0</strong></div>
    <div><span>records</span><strong data-stat="records">0</strong></div>
    <div><span>access shape</span><strong data-stat="shape">none</strong></div>
  </div>
  <p class="ms-log" data-layout-log>Select an access pattern.</p>
</div>

## AoSoA and blocked layouts

Array-of-structures-of-arrays (AoSoA) groups a small block of records, storing
each field contiguously inside the block. It can match SIMD width or a chosen
cache footprint while keeping blocks independently movable.

```text
block 0: ids[8], prices[8], qtys[8], flags[8]
block 1: ids[8], prices[8], qtys[8], flags[8]
```

Blocked layouts are not automatically better. They add index arithmetic and
tail handling. Choose block size from the operation and target, then sweep it in
measurements.

## Hot/cold splitting

Often the best first layout change is to move rarely touched fields away:

```text
HotOrder  { remaining_qty, next, prev, side, state }
ColdOrder { client_tag, original_qty, audit metadata, timestamps... }
```

The hot record becomes denser without forcing a full SoA rewrite. Link cold data
by the same pool index or a compact optional index. The split adds one
indirection only on the cold path.

Field order can reduce padding, but group by access pattern before shaving a few
bytes. A smaller record that forces an extra hot load can be worse than a
slightly padded coherent record.

## Padding and alignment

Each field has an alignment requirement. A struct may insert bytes between
fields and at the end so array elements remain aligned:

```text
u8 flag | padding | u64 id | u32 qty | tail padding
```

Measure `sizeof`, alignment, and field offsets. Do not reorder protocol or file
formats casually; their layout is an external contract. Do not serialize native
struct bytes unless representation, endianness, padding initialization, and
versioning are explicitly defined.

Packing attributes can remove padding but may create misaligned loads, inhibit
atomic access, or violate target requirements. Use an explicit byte decoder for
wire formats and a separate aligned in-memory form.

## Pointers, indices, and offsets

A pointer directly names an address. An index names an element relative to a
base. An offset names a byte or element displacement.

| Reference | Strength | Cost / constraint |
|---|---|---|
| pointer | direct dereference, natural C++ links | width, relocation, provenance, stale reuse |
| 32-bit index | compact, relocatable arena | bounds/base lookup, capacity limit |
| index + generation | rejects recycled slots | larger handle, generation policy |
| relative offset | mmap/serialization friendly | arithmetic, range and alignment checks |

Indices do not guarantee locality by themselves. They make dense placement and
relocation easier. A random permutation of arena indices is still a random
access stream.

Pointers can be perfectly appropriate when nodes never move, capacity is stable,
and direct intrusive manipulation is valuable. The question is what invariant
each external reference relies on.

## One index per access path

An order object may participate in multiple relationships:

```text
ID table:      order_id -> handle
price queue:   prev_at_price / next_at_price
pool:          handle -> storage slot
instrument:    instrument_id -> book state
```

Intrusive links put relationship metadata in the object and avoid separate link
allocations. They also couple the object to those relationships and require
every unlink before retirement. An order cannot be in two lists using the same
link fields.

External indexes keep domain objects simpler and can support alternate views,
but add lookups and synchronized mutation. The representation should mirror the
declared access paths, not an aesthetic preference for “one structure.”

## C++ layout controls

For ordinary in-memory types, inspect and constrain selectively:

```cpp
struct OrderHot {
    std::uint64_t order_id;
    std::uint32_t quantity;
    std::uint32_t next;
    std::uint32_t prev;
    std::uint8_t side;
};

static_assert(std::is_standard_layout_v<OrderHot>);
static_assert(alignof(OrderHot) >= alignof(std::uint64_t));
```

`std::vector<OrderHot>` supplies dense AoS. Parallel vectors or a custom struct
of vectors supply SoA. `std::span` expresses borrowed contiguous views without
ownership. Standard-layout status enables some interoperability properties; it
does not promise a particular total size across ABIs unless you assert and test
that target contract.

## Rust layout controls

Rust's default representation does not promise C-compatible field layout.
`#[repr(C)]` requests C ABI layout rules for interoperability; `#[repr(align(N))]`
raises alignment; `#[repr(transparent)]` supports certain one-field wrappers.

```rust
#[repr(C)]
struct OrderHot {
    order_id: u64,
    quantity: u32,
    next: u32,
    prev: u32,
    side: u8,
}
```

`Vec<OrderHot>` is dense AoS; a struct containing `Vec` per field is SoA. Rust
references carry validity and aliasing requirements that raw pointers and
indices do not erase. Keep unsafe pointer derivation inside a small API and use
checked generational handles at broader boundaries.

Matching `repr(C)` declarations can make cross-language records interoperable,
but also match integer widths, enum representation, endianness, alignment,
compiler target, and initialization. A shared semantic test is still required.

## Compression and decoding cost

Narrow indices, fixed-point prices, bit-packed flags, and delta encoding reduce
footprint and bandwidth. They add masks, shifts, overflow checks, and sometimes
stateful decoding. Compression helps when bytes avoided are more expensive than
decode work.

Keep frequently compared keys in a directly usable form unless measurement says
otherwise. Compress cold audit data aggressively; compress hot mutable state only
with a clear bound and failure policy.

## Failure modes

- an SoA mutation updates three arrays and forgets the fourth;
- swap-removal changes an index still stored externally;
- a raw pointer survives vector growth or pool recycling;
- a packed protocol struct performs unsafe misaligned access;
- layout equivalence is assumed from similar source declarations;
- padding bytes leak into hashing, equality, or serialization;
- hot/cold splitting moves a field that is actually touched every operation; or
- a benchmark changes both layout and algorithm, then attributes the result to
  one mechanism.

## Build it from a blank file

Represent the same order state four ways in C++ and Rust:

1. AoS vector;
2. SoA parallel arrays;
3. hot/cold split using a shared index; and
4. fixed pool with 32-bit generational handles and intrusive price links.

Implement identical trace semantics: add, reduce quantity, cancel by ID, scan
all quantities, and traverse one price queue. Write structural validators and
cross-implementation state hashes after every trace prefix.

Record type sizes, alignments, offsets where meaningful, total allocated bytes,
and reference invalidation rules. If a C++/Rust same-layout experiment is
desired, add compile-time size/alignment assertions plus a cross-language byte-
fixture test—separate from each language's idiomatic version.

## Measure the claim

Time each operation family separately and in realistic mixes. Sweep live order
count, hot/cold field ratio, cancellation rate, and scan width. Record latency
percentiles, bytes touched if instrumented, cache/TLB counters, branch misses,
allocations, and checksum.

Compare semantic parity first. Then use a controlled layout-equivalent pair to
ask whether language-generated work differs. Finally compare idiomatic best
versions to learn which language constraints enable or complicate the chosen
design. These are three experiments, not one leaderboard.

## Checkpoint

Explain:

- when AoS, SoA, and hot/cold splitting each fit;
- why an index is not inherently more local than a pointer;
- what `repr(C)` does and does not guarantee;
- how intrusive links couple an object to access paths; and
- why semantic parity and layout parity answer different questions.
