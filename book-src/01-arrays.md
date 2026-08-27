# Arrays and memory layout

<p class="chapter-subtitle">Fixed extent, address arithmetic, cache lines, and the difference between owning storage and viewing it.</p>

An array is a fixed number of same-typed elements stored contiguously. If the
first element begins at address `base`, element `i` begins at:

```text
base + i × sizeof(T)
```

That equation explains constant-time indexing. It also explains why arrays are
the foundation beneath vectors, ring buffers, binary heaps, hash tables, dense
bitmaps, matrices, and structure-of-arrays layouts.

## The contract and the representation

The abstract contract is a fixed-size indexed sequence:

```text
length is N
valid indices are [0, N)
index i refers to the same logical position for the array's lifetime
```

The contiguous representation adds stronger physical facts:

```text
elements appear in logical order with no gaps between elements
the address of element i is derivable from base, i, and sizeof(T)
all N element lifetimes belong to the array's lifetime
```

An element type can contain internal or trailing padding. The array does not
insert extra padding between elements beyond `sizeof(T)`; any padding is already
part of each element's size.

## Array does not mean “on the stack”

Contiguity and storage duration are separate decisions. An array can live:

- as a local automatic object, commonly in a thread's stack region;
- inside another object;
- in static storage;
- inside a heap allocation; or
- in memory mapped from a file or device.

“Stack array” describes one placement, not the data structure.

## The C++ family

C++ has several related tools with different ownership and safety properties.

### Built-in arrays

```cpp
Order orders[1024];

static_assert(std::size(orders) == 1024);
orders[17].quantity = 50;
```

The extent is part of the type: `Order[1024]`. But built-in arrays frequently
**decay** to pointers when passed to functions, losing the extent:

```cpp
void wrong(Order* orders);                 // length is not represented
void fixed(Order (&orders)[1024]);         // reference preserves this extent
void view(std::span<Order> orders);         // runtime-sized non-owning view
```

Decay is why `sizeof(parameter)` inside a function can report pointer size
rather than the caller's array size.

### `std::array<T, N>`

```cpp
std::array<Order, 1024> orders;

orders[17].quantity = 50;
orders.at(17).quantity = 50; // checked access
```

`std::array` keeps the extent in the type, behaves like a regular value, works
with iterators and algorithms, and does not grow. Its elements still live
inline wherever the `std::array` object itself lives.

### `std::span<T>`

```cpp
void process(std::span<const Order> orders) {
    for (const Order& order : orders) {
        consume(order);
    }
}
```

A span is not an array owner. It is a borrowed contiguous view: conceptually a
pointer plus a length, or a pointer alone when its static extent is encoded in
the type. The caller must keep the underlying storage alive.

## The Rust family

Rust's owning fixed array type is `[T; N]`:

```rust
let mut quantities: [u32; 8] = [0; 8];
quantities[3] = 50;

assert_eq!(quantities.len(), 8);
```

The length is part of the type. `[u32; 8]` and `[u32; 16]` are different types.
A slice, `&[T]` or `&mut [T]`, is the borrowed runtime-sized view:

```rust
fn sum(values: &[u32]) -> u32 {
    values.iter().sum()
}

let values = [10, 20, 30, 40];
assert_eq!(sum(&values), 100);
assert_eq!(sum(&values[1..3]), 50);
```

The slice carries a data pointer and a length. It does not own, resize, or
extend the array it views.

## Bounds are part of correctness

For an array of length `N`, `i < N` is a precondition of unchecked indexing.

C++ `operator[]` on built-in arrays and `std::array` does not provide ordinary
runtime bounds checking. An out-of-range access is undefined behavior. `.at()`
checks and throws on failure.

Rust indexing checks and panics when the index is out of bounds. `get(i)`
returns `Option<&T>` instead. Unsafe Rust can perform unchecked indexing, but
then the proof obligation has merely moved to the programmer.

Do not remove a bounds check until measurement identifies it and surrounding
invariants make the unchecked access locally provable.

## Sequential access and stride

Processors move memory in cache-line-sized units rather than fetching one
field at a time from main memory. On a machine with 64-byte cache lines, a
sequential scan of 8-byte elements can use eight elements from each fetched
line. A large stride may fetch the same number of lines while using only one
element from each.

<div class="ms-lab" data-ms-array>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Walk an array by stride</h3></div>
    <p>The model uses 16 elements and 64-byte cache lines. Change element size and stride, then compare useful bytes with bytes fetched.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="step">step</button>
    <button type="button" data-action="run">run scan</button>
    <button type="button" data-action="reset">reset</button>
    <label class="ms-policy">element size
      <select data-array-element-size>
        <option value="8">8 bytes</option>
        <option value="16">16 bytes</option>
        <option value="32">32 bytes</option>
      </select>
    </label>
    <label class="ms-policy">stride
      <select data-array-stride>
        <option value="1">1 element</option>
        <option value="2">2 elements</option>
        <option value="4">4 elements</option>
        <option value="8">8 elements</option>
      </select>
    </label>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>elements read</span><strong data-stat="reads">0</strong></div>
    <div><span>cache lines</span><strong data-stat="lines">0</strong></div>
    <div><span>useful bytes</span><strong data-stat="useful">0</strong></div>
    <div><span>bytes fetched</span><strong data-stat="fetched">0</strong></div>
  </div>
  <div class="ms-array" data-array-slots aria-label="Array and cache-line layout"></div>
  <p class="ms-log" data-array-log>No elements have been read.</p>
</div>

This visual is a cost model, not a cycle-accurate cache simulator. Hardware can
prefetch, multiple accesses can overlap, and real cache state depends on the
surrounding program. The point is to connect access pattern to the minimum data
movement it demands.

## Multidimensional arrays are still linear storage

C++ built-in multidimensional arrays and Rust nested arrays are arrays of
arrays. Their last dimension is contiguous:

```cpp
std::array<std::array<int, 4>, 3> matrix{};
// matrix[row][column]
```

```rust
let matrix: [[i32; 4]; 3] = [[0; 4]; 3];
// matrix[row][column]
```

Scanning rows follows physical order. Scanning columns jumps by an entire row.
For a small matrix both may remain in cache; for a large matrix the traversal
order can dominate the arithmetic.

## Array of structures versus structure of arrays

Suppose every order contains:

```cpp
struct Order {
    std::uint64_t id;
    std::int64_t price;
    std::uint32_t quantity;
    std::uint32_t flags;
};
```

An array of structures keeps complete orders together:

```text
[id price qty flags][id price qty flags][id price qty flags] ...
```

A structure of arrays keeps each field together:

```text
ids:        [id][id][id]...
prices:     [px][px][px]...
quantities: [qt][qt][qt]...
flags:      [fl][fl][fl]...
```

AoS is often convenient when an operation consumes most fields of one order.
SoA can reduce fetched bytes and enable vectorization when an operation scans
one or two fields across many orders. Neither layout wins without an access
pattern.

## Arrays in low-latency systems

Fixed arrays are useful when a bound is real and enforceable:

- preallocated order slots;
- direct lookup by dense instrument ID;
- fixed price grids;
- per-core counters;
- packet batches; and
- the backing storage of bounded rings and heaps.

The danger is replacing “we observed at most N” with “the system guarantees at
most N.” Exceeding capacity must have declared behavior rather than an
out-of-bounds write.

## The build

Build three focused exercises rather than reimplementing `std::array`:

1. Write C++ functions over `std::span<T>` and Rust functions over `&[T]` so
   the same logic accepts arrays, vectors, and subranges without owning them.
2. Implement row-major matrix indexing from a flat array and assert the mapping
   `offset = row × columns + column`.
3. Represent the same order batch as AoS and SoA with identical observable
   behavior.

For every view, test empty, one-element, full-range, and interior subrange
cases. Run C++ exercises under AddressSanitizer and UndefinedBehaviorSanitizer.

## What to measure

- sequential scans over several working-set sizes;
- strides of 1, 2, 4, 8, and one page;
- row-major versus column-major matrix traversal;
- AoS versus SoA when reading one field and when reading every field;
- checked versus unchecked access only after correctness is established; and
- element sizes that place many, few, or one element per cache line.

Record element count, bytes touched, working-set size, alignment, compiler
settings, and the exact operation performed. “Array traversal” alone does not
define a reproducible workload.

## Checkpoint

You own this chapter when you can answer:

1. Why is an array not inherently stack-allocated?
2. What information is lost when a C++ built-in array decays to a pointer?
3. How do `std::span<T>` and Rust `&[T]` differ from an owning array?
4. Why can two `O(n)` scans have very different memory traffic?
5. When would SoA reverse an AoS design choice, and what ergonomics would it
   cost?

Next: [Vectors](01-vectors.md).
