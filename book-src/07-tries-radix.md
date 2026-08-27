# Tries and radix structures

<p class="chapter-subtitle">Use structure inside the key when comparisons repeat the same prefix work.</p>

A comparison tree asks whether an entire key is less than another key. A
**trie** follows one key unit at a time—character, byte, bit, or digit.

For keys `AMD`, `AMZN`, and `ASK`, common prefixes share nodes:

```text
root
  └─ A
     ├─ M ─┬─ D  [value: AMD]
     │     └─ Z ─ N  [value: AMZN]
     └─ S ─ K  [value: ASK]
```

The path itself encodes the key. A terminal marker distinguishes a stored key
from a mere prefix. Lookup cost is `O(L)` key units for length `L`, independent
of the number of stored keys—but each step's layout can still be expensive.

<div class="ms-lab" data-ms-trie>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Follow a shared prefix</h3></div>
    <p>Exact lookup must consume the path and reach a terminal. Prefix lookup stops earlier and returns a subtree.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-word="AMD">find AMD</button>
    <button type="button" data-word="AMZN">find AMZN</button>
    <button type="button" data-prefix="AM">prefix AM</button>
    <button type="button" data-word="META">find META</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-trie-path" data-trie-path aria-label="Trie traversal path"></div>
  <p class="ms-log" data-trie-log>Select a key or prefix.</p>
</div>

## Invariants

For an ordinary trie:

1. each outgoing edge from a node has a distinct label;
2. concatenating edge labels from the root yields that node's prefix;
3. a terminal/value marker exists exactly for stored keys; and
4. every reachable child has exactly one parent unless sharing is deliberate.

Insertion follows existing edges, creates the missing suffix, then marks the
terminal. Deletion clears the terminal and removes now-childless, nonterminal
ancestors. Removing a prefix node too early deletes other keys.

## Child representation is the design

A node with one pointer for every possible byte offers direct child indexing:

```text
children[256] -> next node or none
```

It is fast and predictably addressed but extremely sparse for most key sets. A
small sorted vector of `(label, child)` pairs is dense and searchable, but
insertion shifts entries. A hash map handles wide unpredictable branching but
adds hashing machinery at every level. A bitmap plus packed child array gives a
useful hybrid:

```text
bit[label] = child exists
packed index = popcount(bits below label)
```

The bitmap rejects missing edges and maps a label into dense child storage. The
right choice depends on alphabet size, fanout distribution, mutation rate, and
whether nodes can be built offline.

## Radix compression

A radix tree compresses chains of single-child nodes into one labeled edge:

```text
ordinary: root -A- M -Z- N
radix:    root --"AM"-- branch --"ZN"--> terminal
```

Lookup compares the edge label against the remaining key. Insertion that
partially matches an edge splits it at the first differing unit. Compression
reduces nodes and pointer traversals; it adds variable-length label comparison
and split/merge cases.

A **Patricia trie** is a compressed binary radix tree. Internal nodes record
the discriminating bit position rather than storing every bit along the path.
Fixed-width integer keys can use several bits per level: a radix of 256 consumes
one byte per step, while a radix of 16 consumes a nibble.

## Ordered integer radix

For unsigned fixed-width integers, examine digits from most significant to
least significant to preserve numeric order. A 32-bit price key split into four
bytes has at most four levels:

```text
price = [byte 3][byte 2][byte 1][byte 0]
         root -> child -> child -> leaf
```

Signed integers and floating-point encodings require a deliberate order-
preserving transform. Endianness of memory is separate from the logical digit
order chosen by the algorithm.

Radix structures can support successor/predecessor by maintaining occupancy
metadata at each node and searching the next eligible child when the exact path
ends. That is more machinery than exact lookup; write the navigation contract
before choosing the representation.

## C++ baseline and ownership

The C++ standard library has no general trie container. The first baseline is
usually `std::map<std::string, V>` for ordered navigation or
`std::unordered_map<std::string, V>` for exact lookup. They establish
correctness and a performance point.

A simple owning trie can use `std::unique_ptr` children:

```cpp
struct Node {
    std::array<std::unique_ptr<Node>, 26> child;
    std::optional<Value> value;
};
```

This makes lifetime obvious but performs many allocations and reserves 26
pointers per node. A production experiment should next replace individual
ownership with an arena and store compact node indices. The root owns the arena;
edges describe connectivity, not ownership.

## Rust baseline and arena representation

Rust likewise has no standard trie. `BTreeMap<String, V>` and `HashMap<String,
V>` are the baselines. An arena avoids self-referential borrowing:

```rust
struct Node<V> {
    children: Vec<(u8, NodeId)>,
    value: Option<V>,
}

struct Trie<V> {
    nodes: Vec<Node<V>>,
    root: NodeId,
}
```

`NodeId` is an integer index. Mutations can borrow the arena briefly, release
that borrow, then access another node. If deleted slots are reused and IDs
escape the structure, pair the index with a generation.

## Prefix queries and strings

A symbol directory may need exact symbol lookup, while a user interface needs
prefix completion. A trie naturally locates the prefix subtree, but returning
all descendants can dominate the lookup itself. Bound output, paginate it, or
store a ranked summary at prefix nodes.

Unicode text must specify its unit. Bytes, Unicode scalar values, and grapheme
clusters produce different paths and semantics. Market protocol identifiers
often have a fixed byte grammar; exploit that only after validating input.

## Failure modes

- terminal state is omitted, so `AM` is confused with stored key `AMD`;
- deletion removes a prefix still shared by another key;
- a dense child array explodes memory and cache footprint;
- edge labels borrow storage that later moves or expires;
- a radix split loses the old value or child suffix;
- signed or byte-order assumptions destroy ordered iteration; or
- `O(L)` is advertised without counting allocations and cache misses per level.

## Build it from a blank file

Build a byte trie for ASCII symbols with `insert`, `find`, `erase`, and
`keys_with_prefix`. Implement two child layouts:

1. a 256-entry direct array; and
2. a sorted compact vector of `(byte, child_index)`.

Then add path compression. After every mutation, validate unique outgoing
labels, reachable arena nodes, correct terminal counts, and that no compressed
edge has an empty label. Differential-test exact lookup against a standard hash
map and sorted iteration against a standard ordered map.

For the integer extension, build a four-level byte radix set for 32-bit prices.
Add `minimum`, `maximum`, `lower_bound`, and erase-time node cleanup.

## Measure the claim

Use at least three key sets: long shared prefixes, random bytes, and realistic
symbol-like identifiers. Record lookup latency distributions for hits, misses
at each prefix depth, inserts, deletes, and prefix enumeration. Report nodes,
edges, allocated bytes, average fanout, path length, and cache misses.

Compare direct children, compact children, compressed paths, `std::map`/
`BTreeMap`, and hash-map exact lookup. Separate construction from steady-state
query timing if the intended workload builds once and reads often.

## Checkpoint

Explain without notes:

- why a trie lookup depends on key length rather than collection size;
- how a terminal marker differs from reaching a node;
- what path compression saves and complicates;
- how a bitmap can index packed children; and
- why an arena is useful in both C++ and Rust even for different language
  reasons.
