# Queues, deques, and ring buffers

<p class="chapter-subtitle">Bounded flow, wraparound state, and the moment capacity becomes part of correctness.</p>

A queue is a contract about order:

```text
enqueue at the back
dequeue from the front
the first item accepted is the first item returned
```

A deque extends the contract with insertion and removal at both ends. A ring
buffer is one representation for either contract: fixed contiguous storage
whose logical end wraps back to physical slot zero.

The important distinction is:

```text
queue or deque = behavior promised to callers
ring buffer    = storage and indexing strategy
```

## Why a ring exists

Erasing the front of a vector shifts every surviving element. A ring keeps the
allocation fixed and moves a small amount of metadata instead:

```text
physical slots:  0   1   2   3   4   5   6   7
logical queue:               [A] [B] [C]
                              ▲           ▲
                            head     next write
```

After two dequeues and several enqueues, logical order can cross the end of the
allocation:

```text
physical slots: [F] [G]  ·   ·   ·  [C] [D] [E]
logical order:   C → D → E → F → G
```

No element moved merely because an index wrapped.

## Pick one state encoding

With capacity `N`, this chapter uses:

```text
head = physical index of the front element
size = number of live elements
tail = (head + size) mod N   // next write position
```

The invariants are:

```text
0 ≤ head < N
0 ≤ size ≤ N
empty iff size == 0
full  iff size == N
exactly size slots are live in logical order from head
tail identifies the next insertion slot when not full
```

This encoding uses every physical slot because `size` distinguishes empty from
full. Another valid design stores only `head` and `tail`, keeps one slot unused,
and declares full when advancing `tail` would equal `head`. A third uses
monotonically increasing read and write counters and masks only when accessing
storage.

All three can work. Mixing their rules cannot.

## Wraparound is ordinary arithmetic

For an arbitrary capacity:

```cpp
index = (index + 1) % capacity;
```

For a power-of-two capacity:

```cpp
index = (index + 1) & (capacity - 1);
```

The mask is correct only when capacity is a power of two. Do not replace `%`
on intuition alone: compilers already optimize many constant divisors, and the
dominant cost may be elsewhere.

<div class="ms-lab" data-ms-ring>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Drive a bounded ring</h3></div>
    <p>Capacity is eight. Watch head and next-write wrap independently of logical FIFO order, then choose what full means.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="enqueue">enqueue</button>
    <button type="button" data-action="dequeue">dequeue</button>
    <button type="button" data-action="burst">enqueue burst of 5</button>
    <button type="button" data-action="drain">drain</button>
    <button type="button" data-action="reset">reset</button>
    <label class="ms-policy">when full
      <select data-ring-policy>
        <option value="reject">reject new item</option>
        <option value="overwrite">overwrite oldest</option>
      </select>
    </label>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>head</span><strong data-stat="head">0</strong></div>
    <div><span>next write</span><strong data-stat="tail">0</strong></div>
    <div><span>size</span><strong data-stat="size">0</strong></div>
    <div><span>rejected</span><strong data-stat="rejected">0</strong></div>
  </div>
  <div class="ms-ring" data-ring-slots aria-label="Ring-buffer storage"></div>
  <p class="ms-log" data-ring-log>The ring is empty. Head and next-write both name slot 0.</p>
</div>

The physical slot order is not the queue order after wraparound. Reconstruct
logical order by starting at `head` and walking `size` positions modulo `N`.

## Full is a policy boundary

Fixed capacity removes growth and allocator traffic, but it forces a decision
that an unbounded container can postpone. When the ring is full, an enqueue can:

- **reject** the new item and let the producer decide;
- **block or wait**, coupling producer progress to consumer progress;
- **overwrite** the oldest item, preserving newest-state semantics while
  losing history;
- **drop the new item**, preserving existing history;
- **spill** to another structure, reintroducing a slower path; or
- **fail the process**, appropriate only when loss makes continued operation
  invalid.

Those choices are not performance tweaks. They change observable behavior.

For market data, overwriting might be defensible for a stream of replaceable
snapshots but disastrous for an ordered sequence of incremental updates. For an
order-entry path, silently losing either old or new messages is generally a
correctness failure.

## Deque operations use the same storage

With `head` and `size`, a bounded deque can implement:

```text
push_back:  construct at (head + size) mod N; size += 1
pop_front:  destroy at head; head = (head + 1) mod N; size -= 1
push_front: head = (head - 1) mod N; construct at head; size += 1
pop_back:   destroy at (head + size - 1) mod N; size -= 1
```

Unsigned subtraction needs deliberate wraparound. One safe expression for
moving backward is `(index + N - 1) % N`; a power-of-two implementation can use
wrapping arithmetic followed by a mask.

## Rust's `VecDeque<T>` is the standard reference

Rust already provides [`std::collections::VecDeque<T>`](https://doc.rust-lang.org/std/collections/struct.VecDeque.html),
a double-ended queue implemented with a **growable ring buffer**.

```rust
use std::collections::VecDeque;

let mut updates = VecDeque::with_capacity(8);
updates.push_back("add 101");
updates.push_back("cancel 84");
updates.push_front("snapshot boundary");

assert_eq!(updates.front(), Some(&"snapshot boundary"));
assert_eq!(updates.pop_front(), Some("snapshot boundary"));
assert_eq!(updates.pop_back(), Some("cancel 84"));
```

It is the right correctness oracle for a custom Rust deque. It is not the same
thing as the bounded ring in the interactive lab:

| Property | `VecDeque<T>` | Fixed `Ring<T, N>` |
|---|---|---|
| capacity | growable | compile-time or construction-time bound |
| allocation | may allocate when capacity grows | none after construction |
| full state | normally grows instead | must have an explicit policy |
| front/back operations | amortized constant time | constant work under the declared policy |
| wrapped storage | possible | possible |
| concurrency | none by itself | none by itself |

### Wrapped contents are two slices

Logical queue order can cross the physical end of the allocation. `as_slices()`
exposes that layout without rearranging it:

```rust
let (first, second) = updates.as_slices();

for update in first.iter().chain(second.iter()) {
    process(update);
}
```

The logical sequence is `first` followed by `second`. Either slice can be
empty. Code that assumes the entire deque is represented by one slice is
incorrect after wraparound.

When an algorithm truly requires one contiguous slice, `make_contiguous()`
rearranges the elements and returns `&mut [T]`:

```rust
let contiguous: &mut [&str] = updates.make_contiguous();
contiguous.sort_unstable();
```

That rearrangement can move elements. It is a deliberate conversion cost, not
a free property of ring storage.

### Reserving is not bounding

`VecDeque::with_capacity(8)` creates space for at least eight elements, and
`reserve` can move growth outside a known phase. Neither call establishes a
maximum. A later `push_front` or `push_back` may still grow the allocation.

That makes `VecDeque` useful for:

- a reference model for operation-sequence tests;
- queues that should grow rather than reject work;
- studying wrapped storage through `as_slices()`; and
- measuring the difference between pre-reserved and growth-boundary traffic.

It is not, by itself, proof that an enqueue on the production hot path cannot
allocate.

## Object lifetime still exists inside fixed storage

An array of `N` slots is not necessarily an array of `N` live `T` objects. A
generic ring must construct on enqueue and destroy on dequeue.

A correctness-first C++ reference can represent slots as optionals:

```cpp
template<class T, std::size_t N>
class Ring {
    static_assert(N > 0);

    std::array<std::optional<T>, N> slots_;
    std::size_t head_ = 0;
    std::size_t size_ = 0;

public:
    bool try_push(T value) {
        if (size_ == N) return false;
        const auto tail = (head_ + size_) % N;
        slots_[tail].emplace(std::move(value));
        ++size_;
        return true;
    }

    std::optional<T> try_pop() {
        if (size_ == 0) return std::nullopt;
        auto value = std::move(slots_[head_]);
        slots_[head_].reset();
        head_ = (head_ + 1) % N;
        --size_;
        return value;
    }
};
```

After the behavior is tested, a lower-level version can use raw storage and
explicit construction. That removes the per-slot optional state only if your
metadata already proves which slots are live.

A safe Rust reference can likewise use `Vec<Option<T>>`. A compact generic
version usually reaches for `MaybeUninit<T>`, which makes the same lifetime
invariant an `unsafe` obligation:

```rust
// Conceptual representation; the safety proof belongs to the implementation.
struct Ring<T, const N: usize> {
    slots: [std::mem::MaybeUninit<T>; N],
    head: usize,
    len: usize,
}
```

Rust does not eliminate the representation problem. It makes the boundary
between checked use and manually proven lifetime management explicit.

## Bounded does not mean concurrent

A single-threaded ring and a concurrent queue are different stages of work.
Adding atomic indices is not enough. A concurrent design must specify:

- one or many producers;
- one or many consumers;
- when a written element becomes visible;
- when a consumed slot becomes reusable;
- the memory ordering that establishes those relationships; and
- behavior when either side outruns the other.

Build and prove the sequential state machine first. The concurrency module will
reuse it while adding publication and ownership transfer.

## The build

Implement three versions with the same FIFO contract:

1. a growable reference queue;
2. `Ring<T, N>` using explicit occupancy such as `optional`; and
3. an optimized fixed-capacity ring with manual lifetime management.

Require:

- `try_push`, `front`, `try_pop`, `size`, `capacity`, and `clear`;
- a declared full policy;
- an invariant checker after every debug mutation;
- C++ operation-sequence differential tests against `std::deque`;
- Rust operation-sequence differential tests against `VecDeque`; and
- wraparound tests that cross the physical boundary repeatedly.

Then extend the ring to a deque. Do not begin with concurrency.

## What to measure

Separate these questions:

- steady one-push/one-pop traffic;
- producer and consumer bursts;
- empty and full boundary behavior;
- power-of-two masking versus modulo for several capacities;
- different element sizes and move costs;
- fixed ring versus `std::deque`; and
- fixed Rust ring versus `VecDeque`, both pre-reserved and across growth;
- the cost of the chosen full policy.

Pre-fill structures before timing steady-state operations. Report the latency
distribution, not only total throughput. A ring designed to avoid allocation
is specifically making a claim about predictability.

## Checkpoint

You own this chapter when you can answer:

1. How does your representation distinguish empty from full?
2. Which metadata identifies the next logical element and the next physical
   write slot?
3. Why is overwriting acceptable for some streams and invalid for others?
4. Which slots contain live objects after an arbitrary wrapped sequence?
5. Why can `VecDeque::as_slices()` return two non-empty slices, and what does
   `make_contiguous()` cost conceptually?
6. What new proof obligations appear when producer and consumer become
   different threads?

Next planned module: **Heaps, priority, and sorting**.
