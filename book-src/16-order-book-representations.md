# Order-book representations

<p class="chapter-subtitle">Price-time priority is one semantic contract implemented by several cooperating indexes.</p>

A limit order book is not one data structure. It is mutable state with several
independent access paths:

```text
best price / next price  -> ordered price index or occupancy bitmap
FIFO at one price        -> queue of orders
cancel by order ID       -> exact ID index
object lifetime          -> allocator or fixed pool
aggregate depth          -> fields at levels and optional range index
```

The engineering question is which representation serves each access path under
the actual price domain, cardinality, operation mix, and latency objective.

## Freeze the semantic contract

This chapter's learning engine uses:

- integer tick prices and quantities;
- unique order IDs;
- bids match the lowest ask at or below their limit;
- asks match the highest bid at or above their limit;
- resting orders at one price execute FIFO;
- quantity reduction keeps priority;
- price change is cancel plus new order and loses priority;
- zero remainder retires the order and an empty level; and
- invalid duplicate/cancel/modify operations return explicit errors.

Real venues differ. The important step is to choose rules before comparing
implementations.

<div class="ms-lab" data-ms-book>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE TRACE</span><h3>Watch the indexes change together</h3></div>
    <p>Step through adds, a crossing order, cancellation, quantity reduction, and a sell that walks multiple bid levels.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="step">next operation</button>
    <button type="button" data-action="run">run all</button>
    <button type="button" data-action="validate">validate invariants</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-book">
    <section><strong>ASKS · low to high</strong><div data-book-asks></div></section>
    <section><strong>BIDS · high to low</strong><div data-book-bids></div></section>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>trace position</span><strong data-stat="position">0 / 8</strong></div>
    <div><span>live orders</span><strong data-stat="live">0</strong></div>
    <div><span>best bid / ask</span><strong data-stat="bbo">— / —</strong></div>
    <div><span>trades</span><strong data-stat="trades">0</strong></div>
  </div>
  <p class="ms-log" data-book-log>The book is empty.</p>
</div>

One input can mutate many structures. A fully filled maker leaves its FIFO,
ID index, and pool; its price level and occupancy bit disappear only if it was
the final order at that price. Correctness lives in those coupled transitions.

## The core invariants

After every operation:

1. bid prices do not cross ask prices after matching finishes;
2. each live order appears in exactly one side and price-level queue;
3. queue order equals accepted time priority under the chosen modification rule;
4. the ID index contains every live order exactly once and no retired order;
5. each level's aggregate equals the sum of remaining quantities in its queue;
6. cached best pointers/indices name the correct nonempty level or none;
7. occupancy agrees with nonempty levels; and
8. live pool slots plus free slots equal capacity.

Write a slow validator that derives all secondary state from queue contents.
Run it after every trace prefix in tests, never only at the end.

## Representation A: one globally sorted order list

The original motivating design stores orders in bid and ask linked lists sorted
by price then time, with cached heads and a LIFO pool. It has real strengths:

- best bid/ask is the head;
- head-near activity can traverse a short hot path;
- insert/erase after locating a position uses local link writes;
- stable pooled nodes exclude general allocation; and
- a recently freed node can be immediately reused.

Its cost is **distance to insertion or cancellation target** unless auxiliary
indexes exist. Orders at the same price are adjacent, but aggregating a level
scans its orders unless totals are cached. Cancellation by ID requires an ID
map. Many instruments need separate heads or segmentation; interleaving pool
slots can hurt locality.

This is an excellent experiment because its success depends on the empirical
claim “most mutations occur near the head.” Instrument traversal distance by
operation and price distance. Do not replace that claim with a generic `O(n)`
dismissal—or with an unmeasured “hot cache” assertion.

## Representation B: ordered levels plus FIFO queues

The common decomposed design is:

```text
bids: ordered price -> PriceLevel
asks: ordered price -> PriceLevel

PriceLevel { aggregate_qty, count, head_order, tail_order }
Order { id, price, remaining, prev, next, level_handle }
ID map { order_id -> order_handle }
pool { order_handle -> Order storage }
```

An AVL/red-black/B-tree/radix index navigates occupied prices. The level FIFO
handles time priority. The ID map makes cancellation expected constant or
logarithmic according to its representation. Direct `level_handle` makes unlink
and aggregate repair local after the ID lookup.

This design's complexity is coupled metadata: one cancel updates the queue,
aggregate, ID map, possibly price tree, cached best, and pool. Its strength is
that each access path has an explicit index.

## Representation C: dense levels plus occupancy

When price ticks fit a bounded window:

```text
levels[price - base] -> PriceLevel
occupied bitmap      -> live price navigation
ID map                -> cancellation handle
pool                  -> stable order slots
```

Level access is direct indexing. A cached best plus hierarchical bitmap repairs
best-price deletion quickly. There are no price-tree node allocations or
rotations. Empty levels still consume level-array space, so window width and
level record size determine viability.

External prices require checked conversion. An out-of-window order must be
rejected, routed to sparse overflow, or trigger controlled rebasing. Moving the
window while live orders exist is a state migration, not an index subtraction.

## Representation D: flat and batched indexes

A sorted vector of live price levels gives dense scans and binary search.
Inserting a new price shifts later levels; inserting another order at an existing
price does not. If the number of live price levels is small and price creation/
deletion is rare relative to order churn, this can be a formidable baseline.

A small mutable delta plus periodically merged sorted base can serve read-heavy
analytics or snapshots. It is less natural for an always-current matching path
because every query must reconcile sources. Separate the live engine from
published analytical views when their update contracts differ.

## Why heaps alone do not solve it

A heap exposes one best key but does not naturally support:

- FIFO order at equal price;
- cancellation of an arbitrary known ID;
- ordered next-price navigation after arbitrary deletion;
- aggregation and iteration by distinct price level; or
- in-place priority-preserving quantity changes.

An indexed heap can add arbitrary removal, but it still does not make equal-
price FIFO and level aggregation disappear. Heaps remain useful for timers,
auctions, and priority worklists around the engine.

## Matching as a state transition

For an incoming bid:

```text
while incoming.remaining > 0:
    best = lowest ask
    if no best or best.price > incoming.limit: break
    maker = best.head
    traded = min(incoming.remaining, maker.remaining)
    decrement both; emit trade
    if maker empty: unlink and retire maker
    if best level empty: remove level and repair best ask
if incoming remains: append it at its bid level and index by ID
```

The ask path is symmetric. Resting/maker order sets execution price under this
contract. Market orders omit the stopping price but need a policy for unfilled
remainder. Every emitted trade and rejection is part of the semantic checksum.

## Modification semantics matter

Quantity reduction can update the order and level aggregate without relinking
when the contract preserves time priority. Quantity increase commonly loses
priority; price change necessarily moves levels. A replace can also change ID or
carry venue-specific rules.

Benchmark labels must distinguish these paths. Calling every case “modify” hides
which indexes moved and whether object identity was preserved.

## C++ representation sketch

C++ can express direct intrusive pointers over stable pooled nodes:

```cpp
struct Order {
    OrderId id;
    Price price;
    Quantity remaining;
    Order* prev;
    Order* next;
    PriceLevel* level;
};
```

Or it can use compact generational handles and arena arrays. Standard baselines
are `std::map<Price, Level>` plus `std::unordered_map<OrderId, Handle>` and an
ordinary allocator, then reserved/pool variants. Separate side maps avoid a
comparator that embeds side-specific reversal everywhere.

Raw pointers are safe only while pool nodes and levels remain stable and unlink
precedes retirement. If levels live directly inside a moving flat vector, an
order's level pointer cannot remain valid across insertion.

## Rust representation sketch

Rust naturally favors handles over self-referential safe references:

```rust
struct Order {
    id: OrderId,
    price: Price,
    remaining: Quantity,
    prev: Option<OrderHandle>,
    next: Option<OrderHandle>,
    level: LevelHandle,
}
```

`BTreeMap<Price, LevelHandle>`, `HashMap<OrderId, OrderHandle>`, and a
`Vec<Slot<Order>>` pool form the standard learning baseline. Each mutation uses
short borrows: fetch handles, mutate one slot, release the borrow, then mutate
the next structure. Carefully scoped unsafe code can implement pointer-based
intrusion, but it should earn its place with measured benefit.

The Rust version need not imitate C++ pointers to be comparable. First match
semantics and workload. Add a handle-based C++ version for layout equivalence if
the language-specific representation is the experimental question.

## Study the existing engines in this order

These repositories answer different questions; they are not drop-in benchmark
competitors.

1. [`brprojects/Limit-Order-Book`](https://github.com/brprojects/Limit-Order-Book)
   is the compact structural study. Read `Order.hpp` for intrusive FIFO links,
   `Limit.hpp` for aggregate/head/tail plus AVL links, and `Book.hpp`/`Book.cpp`
   for price trees, cached edges, hash indexes, matching, and rotations. Draw
   every structure an order participates in before following functions.

2. [`enewhuis/liquibook`](https://github.com/enewhuis/liquibook) is the behavioral
   matching-engine study. In `src/book/order_book.h`, follow the `Tracker`,
   `std::multimap` bid/ask representation, matching paths, deferred behavior,
   callbacks, and depth wrappers. It has a larger semantic surface, so isolate a
   comparable subset before timing it against a smaller book.

3. [`exchange-core/exchange-core`](https://github.com/exchange-core/exchange-core)
   separates baseline and specialized Java books. Compare `OrderBookNaiveImpl`
   (ordered price buckets plus ID map) with `OrderBookDirectImpl` (adaptive radix
   tree maps, direct order chains, and object pooling). Then study
   `MatchingEngineRouter`, `RiskEngine`, and `ExchangeCore` to see how book
   representation sits inside a staged system. Its end-to-end architecture is a
   different benchmark boundary from an isolated C++ book.

4. [`theerajchandra/limit-order-book`](https://github.com/theerajchandra/limit-order-book)
   provides a Rust implementation to inspect for ownership and representation
   decisions. Treat it as another design, not “the Rust version” of the first
   repository unless semantic and structural equivalence are proven.

For each repository, fill one sheet: semantic features, price index, FIFO
representation, ID index, allocation policy, concurrency boundary, benchmark
trace, and validation evidence. Only compare rows whose contracts align.

## Failure modes

- cached best points to an empty or retired level;
- an order is unlinked from FIFO but remains in the ID map;
- aggregate quantity drifts after partial fill or reduction;
- a price-changing modify retains forbidden priority;
- pool reuse makes a stale ID handle target a new order;
- crossing stops after one maker instead of walking levels;
- a global list's near-head assumption is never instrumented; or
- engines with different order types and callback work are ranked by raw time.

## Build two defended books

Implement one semantic contract in C++ and Rust, then provide at least two
representations per language:

1. ordered price levels + FIFO + ID hash + fixed pool; and
2. bounded dense levels + hierarchical occupancy + FIFO + the same ID/pool
   policies.

Optionally add the globally sorted intrusive list as the hypothesis-driven third
design. Instrument traversal distance, level count, and hot-price distance.

Use a slow reference book built from ordinary ordered containers. Differential-
test every operation result, trade sequence, BBO, depth, and final canonical
state. Run validators after each randomized operation in test builds.

## Measure the representations

Replay identical versioned traces and sweep:

- live orders and live price levels independently;
- narrow dense versus wide sparse price domains;
- add/cancel/modify/match ratios;
- top-of-book versus far-from-touch mutations;
- one versus many interleaved instruments;
- rapid LIFO slot reuse versus long lifetimes; and
- valid, missing, and duplicate IDs.

Report latency by operation path, not only overall: add-existing-level, add-new-
level, cancel, reduce, move price, partial match, full match, level deletion, and
failed lookup. Include traversal/probe counts, allocations, pool high-water,
bytes, cache/TLB/branch counters, and trade/state checksums.

## Checkpoint

Explain:

- why a book needs separate price, FIFO, ID, and lifetime access paths;
- the exact evidence that could support the globally sorted list;
- when dense levels plus occupancy beat an ordered price tree;
- why repository benchmark numbers are not comparable by default; and
- which invariant each fill, cancel, and price-level deletion must repair.

Next: [C++ and Rust engineering](17-cpp-rust-engineering.md).
