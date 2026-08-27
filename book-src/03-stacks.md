# Stacks

<p class="chapter-subtitle">LIFO order, container adaptors, fixed-capacity storage, and why “the stack” can mean three different things.</p>

A stack is an abstract data type with one accessible end:

```text
push(x)  add x to the top
top()    inspect the newest element
pop()    remove the newest element
empty()  report whether a top exists
```

Its ordering rule is **last in, first out**. If `A`, `B`, and `C` are pushed in
that order, pops return `C`, then `B`, then `A`.

## Separate three meanings of “stack”

The word is overloaded:

| Meaning | What it is |
|---|---|
| stack ADT | a LIFO operation contract |
| call stack | execution frames used for calls, returns, and automatic locals |
| free stack | a LIFO collection of reusable slots or handles |

A `std::stack<Order>` can allocate its storage on the heap. A local
`std::array<Order, 64>` can live in a call frame without providing stack
operations. Storage location and access order are independent choices.

<div class="ms-stack-meanings" aria-label="Three meanings of stack">
  <div><strong>container stack</strong><span>push C</span><span>push B</span><span>push A</span><small>explicit data</small></div>
  <div><strong>call stack</strong><span>parse()</span><span>decode()</span><span>main()</span><small>execution frames</small></div>
  <div><strong>free stack</strong><span>slot 7</span><span>slot 2</span><span>slot 9</span><small>reusable storage</small></div>
</div>

## The contiguous representation

A stack needs no new physical structure when a growable array already exists:

```text
push  = append at index size
top   = element at index size - 1
pop   = destroy element at index size - 1; size -= 1
```

For fixed capacity `N`, the invariants are:

```text
0 ≤ size ≤ N
slots [0, size) contain live elements
slots [size, N) contain no live elements
top exists iff size > 0
top index is size - 1
```

This is the same lifetime model as a vector without middle operations.

## C++ `std::stack<T>` is an adaptor

[`std::stack`](https://eel.is/c++draft/stack) wraps another sequence container
and deliberately exposes only LIFO operations. Its default underlying
container is `std::deque<T>`.

```cpp
std::stack<OrderId> pending;
pending.push(41);
pending.push(84);

const OrderId newest = pending.top(); // 84
pending.pop();                        // pop returns void
```

The underlying container must provide `back`, `push_back`, and `pop_back`.
Choosing the representation is explicit:

```cpp
std::stack<OrderId, std::vector<OrderId>> contiguous;
std::stack<OrderId, std::deque<OrderId>> segmented;
```

The adaptor has no iterators because arbitrary traversal is not part of the
stack contract. If callers require indexing or iteration, either expose a
different abstraction or admit that the object is not being used solely as a
stack.

### Why C++ `pop()` returns `void`

Read the top, then remove it:

```cpp
OrderId value = std::move(pending.top());
pending.pop();
```

Separating access from removal avoids requiring one operation to both mutate
the container and return a potentially throwing copy or move. The tradeoff is
that the caller must not call `top()` on an empty stack.

## Rust uses `Vec<T>` as the standard stack

Rust has no separate standard `Stack<T>` type. [`Vec<T>`](https://doc.rust-lang.org/std/vec/struct.Vec.html)
already provides the required end operations:

```rust
let mut pending = Vec::with_capacity(1024);
pending.push(41_u64);
pending.push(84_u64);

assert_eq!(pending.last(), Some(&84));
assert_eq!(pending.pop(), Some(84));
assert_eq!(pending.pop(), Some(41));
assert_eq!(pending.pop(), None);
```

`last()` returns a borrowed top. `pop()` combines removal and return as
`Option<T>`, making the empty case explicit. The physical representation and
growth behavior are still those of `Vec`: exceeding capacity can reallocate.

## Fixed capacity makes overflow semantic

A bounded stack cannot silently pretend it is unbounded. `push` must declare
one of these outcomes:

```text
success
rejection / error
process failure
spill to a slower structure
```

Overwriting the bottom is rarely a valid stack operation because it destroys
an element that is still logically present. A free-slot stack may fail fast if
exhaustion proves a violated system bound; a parser may return a nesting-depth
error.

<div class="ms-lab" data-ms-stack>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Operate a fixed stack</h3></div>
    <p>Capacity is eight. Push and pop to see the live-object boundary move without shifting any existing element.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="push">push</button>
    <button type="button" data-action="peek">peek</button>
    <button type="button" data-action="pop">pop</button>
    <button type="button" data-action="fill">fill</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>size</span><strong data-stat="size">0 / 8</strong></div>
    <div><span>top index</span><strong data-stat="top">none</strong></div>
    <div><span>next slot</span><strong data-stat="next">0</strong></div>
    <div><span>rejected pushes</span><strong data-stat="rejected">0</strong></div>
  </div>
  <div class="ms-stack" data-stack-slots aria-label="Fixed-capacity stack"></div>
  <p class="ms-log" data-stack-log>The stack is empty.</p>
</div>

Observe that a pop destroys only the current top. It does not shift the lower
elements and it does not reduce fixed capacity.

## Alternative representations

| Backing representation | Push/pop at top | Growth | Locality | Stable node addresses |
|---|---|---|---|---|
| fixed array | constant, bounded | never | strong | array address stable; elements fixed |
| vector | amortized constant | may reallocate | strong | no across growth |
| deque | constant at end | grows by segments | good but segmented | rules depend on operation |
| linked nodes | constant with allocation | per node | weak | nodes stable until erased |

A linked stack is useful for teaching link mechanics, but it is usually a poor
default when the workload only pushes and pops at one end. Contiguous storage
uses less metadata and traverses more efficiently when inspection is needed.

## LIFO reuse in an order pool

The free-slot design that motivated this book is a stack:

```text
allocate order: pop free slot
release order:  push released slot
```

LIFO reuse tends to select the most recently released storage. That can keep a
small active working set hot, but it is a hypothesis about the workload—not a
universal law. It can also repeatedly concentrate use on the same slots while
other storage remains cold.

If external code holds handles, pair the slot index with a generation. LIFO
ordering does not prevent stale-handle aliasing after reuse.

## Common uses and misuses

Stacks naturally model:

- nested parsing and delimiter matching;
- depth-first traversal;
- expression evaluation;
- undo history;
- backtracking; and
- free-slot reuse.

They do not model arrival-order processing. A pipeline that must service the
oldest accepted message first needs a queue, not a stack.

## The build

Implement `StaticStack<T, N>` in C++ and Rust with:

```text
try_push, top/last, try_pop, size, capacity, clear
```

Start with a correctness-first representation that makes occupancy explicit.
Then implement manual object lifetime over raw storage (`std::construct_at` /
`std::destroy_at` in C++, `MaybeUninit<T>` in Rust).

Require:

- rejection at capacity;
- an empty pop with no undefined access;
- destruction of exactly the live elements;
- randomized differential tests against vector-backed stack behavior; and
- tests using move-only values and values that count construction/destruction.

## What to measure

- fixed stack versus pre-reserved vector-backed stack;
- vector pushes that do and do not cross growth boundaries;
- element sizes from one word through several cache lines;
- manual lifetime storage versus an explicit optional per slot;
- LIFO, FIFO, and randomized free-slot reuse under the same trace; and
- empty/full boundary paths separately from steady state.

Do not benchmark `std::stack` without naming its underlying container. The
adaptor contract is the same while the representation can differ.

## Checkpoint

You own this chapter when you can answer:

1. Why is a stack ADT unrelated to whether storage lives on the call stack?
2. What representation does a default `std::stack<T>` adapt?
3. Why can Rust use `Vec<T>` directly without a stack wrapper?
4. What happens when a fixed stack is full, and who observes that outcome?
5. When does LIFO free-slot reuse help locality, and what correctness problem
   does it not solve?

Next: [Queues, deques, and ring buffers](03-queues-rings.md).
