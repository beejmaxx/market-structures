# Linked lists

<p class="chapter-subtitle">Stable nodes, explicit rewiring, intrusive ownership, and the cache cost of following pointers.</p>

A linked list stores sequence order in links rather than physical adjacency.
Removing a known node can be constant work because its neighbors can be
rewired without shifting every later element.

That sentence hides the real questions:

- How do we find the node?
- Who owns its storage?
- Are its links singly or doubly directed?
- Can nodes move in memory?
- What does traversal cost when addresses are scattered?

## Three related representations

| Representation | Per-node links | Useful property | Main limitation |
|---|---:|---|---|
| singly linked | `next` | minimal link storage, cheap front insertion | removing a node needs its predecessor |
| doubly linked | `prev`, `next` | constant-time unlink of a known node | more state must remain consistent |
| intrusive doubly linked | links live inside the payload | no separate node allocation; direct unlink | the payload participates in container lifetime |

An intrusive order node might look like this:

```cpp
struct Order {
    OrderId id;
    Price price;
    Quantity quantity;

    Order* prev;
    Order* next;
};
```

The list does not allocate a wrapper around `Order`. The order itself contains
the linkage. This is useful in a preallocated order pool, but it couples the
object to a membership protocol that you must enforce.

## Standard owned linked lists

Before building an intrusive list, know what the standard containers provide.
They own their nodes; the payload does not contain your custom links.

### C++ `std::list<T>`

[`std::list`](https://eel.is/c++draft/list) is a doubly linked sequence with
bidirectional iteration. Inserting or erasing at a known iterator is constant
time, and insertion does not invalidate iterators or references to other
elements.

```cpp
std::list<Order> orders;
orders.push_back(order_a);
orders.push_back(order_b);

auto position = orders.begin();
++position;
orders.insert(position, order_between);
orders.erase(position);
```

It does not provide random access, it owns its node storage, and ordinary
insertion can involve the allocator. That makes it a useful semantic reference
for list operations, not an automatic choice for a preallocated hot path.

### Rust `LinkedList<T>`

Rust provides
[`std::collections::LinkedList<T>`](https://doc.rust-lang.org/std/collections/struct.LinkedList.html),
a doubly linked list with owned nodes:

```rust
use std::collections::LinkedList;

let mut orders = LinkedList::new();
orders.push_back(order_a);
orders.push_front(order_b);

let first = orders.pop_front();
let last = orders.pop_back();
```

The Rust documentation explicitly points out that `Vec` or `VecDeque` is
usually a better default because array-based containers are generally faster
and more memory efficient. `LinkedList` remains relevant when its linked
representation and end operations match the workload.

Neither standard container is intrusive, and neither is the fixed order-pool
design built later in this chapter. Keep these three questions separate:

1. Is list ordering the correct abstract behavior?
2. Should the container own dynamically allocated nodes?
3. Should links live inside preallocated application objects?

## Write the invariants before the helpers

For every live node `x` in a doubly linked list:

```text
x.next != null  implies  x.next.prev == x
x.prev != null  implies  x.prev.next == x
head.prev == null
tail.next == null
following next from head reaches tail exactly once
live nodes and free nodes are disjoint
```

If the list is circular with a sentinel, the endpoint rules change:

```text
sentinel.next.prev == sentinel
sentinel.prev.next == sentinel
empty means sentinel.next == sentinel.prev == sentinel
```

Sentinels remove many special branches. Insertion before any node—including the
sentinel—can use one mutation sequence.

## Insertion is four pointer writes

To insert `node` between `left` and `right`:

```cpp
node->prev = left;
node->next = right;
left->next = node;
right->prev = node;
```

To erase `node`:

```cpp
node->prev->next = node->next;
node->next->prev = node->prev;
```

After erasure, clear or poison the removed links in debug builds. A node that
still appears linked can hide double removal and use-after-release bugs.

<div class="ms-lab" data-ms-list>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Rewire an intrusive list</h3></div>
    <p>The boxes are orders. Their addresses are intentionally non-contiguous. Select a node, insert after it, or unlink it.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="next">select next</button>
    <button type="button" data-action="insert">insert after</button>
    <button type="button" data-action="erase">erase selected</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-list" data-list-nodes aria-label="Intrusive linked list"></div>
  <pre class="ms-writes" data-list-writes aria-live="polite">Select an operation to see the pointer writes.</pre>
</div>

The mutation is constant work only after you possess the node. If cancellation
arrives as an order ID, a separate index—often a hash table—must map that ID to
the node or a stable handle.

## Allocation and linkage are separate decisions

“Use a linked list” does not imply “allocate every node individually.” In a
low-latency system, nodes can live in a fixed array:

```text
pool storage:  [slot 0][slot 1][slot 2] ... [slot N-1]
live order:             slot 1  ─next─▶ slot 7 ─next─▶ slot 3
free stack:    top ─▶ slot 5 ─▶ slot 4 ─▶ slot 2
```

Allocation then means popping a slot index or pointer from a free stack.
Release means incrementing its generation and pushing it back. A LIFO free
stack tends to reuse recently touched storage, although whether that improves
the target workload must still be measured.

## Why a generation belongs in a handle

An array index alone becomes dangerous after reuse:

```text
handle { index: 12 } refers to order A
order A is cancelled
slot 12 is reused for order B
the stale handle silently refers to B
```

Use `{index, generation}` and increment the slot generation on release. A lookup
succeeds only when both fields match. This converts accidental access to a new
occupant into a detectable stale-handle failure.

```cpp
struct Handle {
    std::uint32_t index;
    std::uint32_t generation;
};
```

Rust often expresses the same design with indices rather than self-referential
references:

```rust
struct Handle {
    index: u32,
    generation: u32,
}

struct Order {
    prev: Option<Handle>,
    next: Option<Handle>,
    // payload...
}
```

That is not layout parity with the pointer-based C++ version. It is the same
abstract list with a representation that is easier to make safe under moves
and reuse. Comparing them is useful precisely because the engineering choices
differ.

## Constant-time mutation does not imply fast traversal

Linked-list traversal is a dependent address chain:

```text
load node → read next address → load next node → read next address → ...
```

The next load cannot begin until the current node supplies its address. If
nodes are scattered, each cache line may contribute only one useful node and
hardware prefetchers have little regularity to exploit.

A vector scan performs more predictable work:

```text
base + 0, base + sizeof(T), base + 2*sizeof(T), ...
```

This is why a vector can beat a list even when it performs more nominal
operations. Big-O counts do not describe cache-line utilization, allocation,
branch prediction, or memory-level parallelism.

## Price-time priority needs more than one long list

A single list ordered across every order makes best-order access cheap and
near-head activity potentially reasonable. But finding an arbitrary cancel or
a distant insertion is linear unless additional indexes exist.

A practical representation commonly separates concerns:

```text
order ID ─hash index─▶ stable order handle
price     ─price index─▶ price level
price level           ─▶ FIFO list of orders
book side             ─▶ best occupied price
```

The per-price FIFO preserves time priority. The price index answers price
navigation. The ID index answers cancellation. One structure does not need to
pretend it serves every access path well.

## The build

Build an intrusive doubly linked list over a fixed order pool. Require:

- sentinel-based insertion and erasure;
- a LIFO free stack;
- generational handles;
- an invariant checker after every debug mutation; and
- randomized differential tests against a simple sequence model.

Do not benchmark until the checker survives long randomized traces under
AddressSanitizer and UndefinedBehaviorSanitizer.

## What to measure

Compare mechanisms separately:

- contiguous scan versus sequentially allocated linked nodes;
- contiguous scan versus deliberately scattered nodes;
- front insertion and known-node erasure;
- LIFO reuse versus FIFO or randomized free-slot reuse; and
- cancellation with an ID index versus a linear search.

Keep allocation outside the timed region when measuring list mechanics. Put it
inside only when allocator behavior is the actual question.

## Checkpoint

You own this chapter when you can answer:

1. Which invariant catches each possible missing pointer write?
2. Why is known-node erasure `O(1)` while cancel-by-ID may not be?
3. What problem does a generation solve that an index alone does not?
4. When will LIFO reuse help locality, and when can it concentrate accesses in
   an undesirable way?
5. Which access paths in an order book need their own indexes?

Continue with the [learning roadmap](roadmap.md).
