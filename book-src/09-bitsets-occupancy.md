# Bitsets and occupancy maps

<p class="chapter-subtitle">Pack boolean state into machine words, then let word operations do the searching.</p>

An array of booleans answers one question per element. A bitset packs many
answers into each machine word:

```text
bit index i
word index = i / 64
bit offset = i % 64
mask       = 1 << bit_offset
```

Set, clear, test, union, intersection, and difference become arithmetic on
whole words. The representation is strongest when the key domain is bounded and
dense enough that one bit per possible key is affordable.

## The basic invariants

For a bitset of logical length `N` stored in `ceil(N / 64)` words:

1. bit `i` lives in exactly one word and offset;
2. no operation reads or writes beyond the allocated word range;
3. unused high bits in the final word are masked when they could affect results;
4. a summary bit is set exactly when its represented lower word is nonzero; and
5. concurrent bit updates follow an explicitly atomic or single-owner contract.

```text
set(i):    words[i / 64] |=  1 << (i % 64)
clear(i):  words[i / 64] &= ~(1 << (i % 64))
test(i):  (words[i / 64] >> (i % 64)) & 1
```

<div class="ms-lab" data-ms-bitmap>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Scan occupied price ticks</h3></div>
    <p>Set and clear levels, then use a masked word scan to find the next or previous occupied tick.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="set">set next level</button>
    <button type="button" data-action="clear">clear current</button>
    <button type="button" data-action="next">next occupied</button>
    <button type="button" data-action="previous">previous occupied</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-stats" aria-live="polite">
    <div><span>cursor</span><strong data-stat="cursor">0</strong></div>
    <div><span>occupied</span><strong data-stat="occupied">0</strong></div>
    <div><span>word value</span><strong data-stat="word">0x0</strong></div>
    <div><span>result</span><strong data-stat="result">none</strong></div>
  </div>
  <div class="ms-bitmap" data-bitmap-bits aria-label="Thirty-two price occupancy bits"></div>
  <p class="ms-log" data-bitmap-log>No levels are occupied.</p>
</div>

## Finding the next set bit

To find the first set bit at or above position `p`, clear bits below `p` in its
word, then count trailing zeros:

```text
candidate = word & (~0 << offset)
if candidate != 0:
    answer = word_base + countr_zero(candidate)
else:
    scan later nonzero words
```

For a previous set bit, mask bits above `p` and use the most significant set
bit, obtained from a leading-zero count. Define whether the starting position is
inclusive. Handle a zero word before calling operations whose zero behavior is
not guaranteed by a lower-level intrinsic.

These scans turn up to 64 boolean checks into one load, mask, branch, and bit-
count instruction. A long empty domain can still require scanning many zero
words.

## Hierarchical occupancy

A summary bitmap marks which data words are nonzero:

```text
level 1: one bit per level-0 word
level 0: one bit per price tick
```

When a level-0 word changes from zero to nonzero, set its summary bit. When its
last bit clears, clear the summary bit. To find the next occupied price, scan the
current data word; if empty, scan the summary for the next nonempty word, then
scan that word.

If the summary itself spans many words, add another level. Each tier covers 64
times the domain of the tier below. Mutation now has a coupled invariant across
levels, but sparse navigation touches logarithmically few words with a very
large base.

## C++ baselines

[`std::bitset<N>`](https://eel.is/c++draft/template.bitset) has compile-time
extent and supports indexed access, bitwise operations, shifts, `count`, `any`,
and `none`:

```cpp
std::bitset<4096> occupied;
occupied.set(tick);
occupied.reset(tick);
if (occupied.test(tick)) { /* level exists */ }
```

Its public API does not expose a portable “find next set bit.” A custom
`std::array<std::uint64_t, Words>` supplies word access and standard C++20
[`std::countr_zero`](https://eel.is/c++draft/bit.count) / `std::countl_zero`.

`std::vector<bool>` is a dynamic packed-bit specialization, not an ordinary
`vector<bool>` of independently addressable `bool` objects. Its proxy reference
semantics matter in generic code. Use it as a behavioral baseline, not as proof
of a particular word layout or scan API.

## Rust baseline

Rust's standard library has no general dynamic bitset. Fixed and dynamic custom
forms are straightforward over `[u64; WORDS]` or `Vec<u64>`:

```rust
let word = index / 64;
let offset = index % 64;
words[word] |= 1_u64 << offset;

let candidate = words[word] & (!0_u64 << offset);
if candidate != 0 {
    let answer = word * 64 + candidate.trailing_zeros() as usize;
}
```

Integer methods such as `count_ones`, `leading_zeros`, and `trailing_zeros`
define the word-level primitives. Wrap raw access in a type that enforces
logical length and masks the last word.

## Set algebra

With equal domains, many queries are one loop over words:

```text
union:        a | b
intersection: a & b
difference:   a & ~b
symmetric:    a ^ b
cardinality:  sum(popcount(word))
```

This is useful for subscription sets, feature flags, eligibility masks, CPU
affinity, and graph frontiers. SIMD can process several words at once, but first
measure whether memory bandwidth or scalar instruction count is limiting.

## Rank and select

`rank(i)` counts set bits before `i`; `select(k)` finds the position of the
`k`th set bit. A plain bitset computes rank by popcounting preceding words.
Prefix counts over blocks accelerate it at the cost of update work. Select uses
the counts to locate a block, then word-level bit selection.

This is the same recurring tradeoff: extra indexes speed a declared query while
adding storage and coupled mutation invariants.

## Occupancy in an order book

For integer tick prices in a bounded range:

```text
levels[tick]    -> aggregate + FIFO head/tail
occupied[tick]  -> whether the level is live
order_id_index  -> order handle for cancellation
```

Best ask is the lowest set ask bit; best bid is the highest set bid bit. On the
first order at a price, initialize the level and set occupancy. On removal of
the last order, clear it. The bitmap navigates prices but does not preserve FIFO
or locate orders by ID.

The domain cost is explicit. Ten million possible ticks require about 1.25 MB
for one bitmap before summaries—often reasonable, sometimes not. Mapping a
wide external price range into a narrow active window adds window-shift and
out-of-range policies.

## Atomic bitsets

Multiple threads updating separate bits in the same word still perform a
read-modify-write on shared storage. Non-atomic `|=` races even when bit indices
differ. Atomic `fetch_or` and `fetch_and` can preserve updates, but contention
on the word creates cache-line ownership traffic. Shard by owner or word range
when possible; “packed” can create false sharing as easily as it saves memory.

## Failure modes

- shifting a signed `1` or shifting by the word width triggers language hazards;
- a next scan accidentally includes or excludes the starting bit;
- unused final-word bits appear as real members after complement;
- occupancy is cleared while the price level still contains orders;
- a summary bit becomes stale after zero/nonzero transition;
- a zero candidate reaches an unsafe bit-scan intrinsic; or
- atomic bits share a hot word and serialize independent producers.

## Build it from a blank file

Implement a bounded bitset with `set`, `clear`, `test`, `count`, `any`, `next`,
`previous`, union, intersection, and iteration over set positions. Test sizes
around word boundaries: 0, 1, 63, 64, 65, 127, and 129 bits.

Then build a two-level hierarchical bitmap. After every randomized mutation,
validate each summary bit against `lower_word != 0` and differential-test scans
against a slow boolean array. Finally attach it to an array of price levels.

## Measure the claim

Compare a boolean array scan, flat bitset scan, hierarchical bitset, ordered set,
and direct cached best-price variable under dense, sparse, clustered, and moving-
window occupancy. Record next/previous latency distributions, words inspected,
bytes, branch misses, cache misses, and mutation overhead.

The cached best price is an important baseline: it wins the exact best query but
requires repair when that price empties. The bitmap supplies that repair path.

## Checkpoint

Explain:

- how masking plus trailing zeros finds the next set bit;
- when a summary bit must change;
- why a bitmap handles price navigation but not FIFO or cancellation;
- how packing can create atomic contention; and
- when domain size makes an ordered sparse structure preferable.
