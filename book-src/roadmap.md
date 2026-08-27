# Learning roadmap

<p class="chapter-subtitle">Eighteen modules connect core structures to one evidence-driven market-system capstone.</p>

Every module now has complete learning material. Modules 01 and 03 use two
chapters so arrays/vectors and stack/queue contracts remain distinct.

| Module | Topic | Core question | Status |
|---:|---|---|---|
| 01 | Arrays and vectors | When does fixed contiguous storage become growable, and what does growth invalidate? | **Two chapters available** |
| 02 | Intrusive lists and free lists | What do stable nodes buy, and what does pointer chasing cost? | **Chapter available** |
| 03 | Stacks, queues, deques, and rings | How should LIFO/FIFO order, full, empty, wraparound, and backpressure be represented? | **Two chapters available** |
| 04 | Heaps, priority, and sorting | Which minimum ordering is sufficient for the workload? | **Chapter available** |
| 05 | Hashing under pressure | What happens to lookup tails as clusters form? | **Chapter available** |
| 06 | Ordered indexes | Which invariants and layouts support ordered navigation? | **Chapter available** |
| 07 | Tries and radix structures | When can key structure replace comparison? | **Chapter available** |
| 08 | Graph representations | When should relationships be stored densely or sparsely? | **Chapter available** |
| 09 | Bitsets and occupancy maps | How can word-level operations replace searches? | **Chapter available** |
| 10 | Range and interval indexes | Which aggregates and overlap queries justify an auxiliary index? | **Chapter available** |
| 11 | Memory hierarchy | Which observed costs come from cache, TLB, branches, or dependencies? | **Chapter available** |
| 12 | Allocation and object pools | How do lifetime and reuse policies affect latency distributions? | **Chapter available** |
| 13 | Layout and indirection | When should data be AoS, SoA, packed, indexed, or pointer-linked? | **Chapter available** |
| 14 | Concurrency primitives | What memory-order guarantees does the algorithm actually need? | **Chapter available** |
| 15 | Benchmark design | Which experiment distinguishes the proposed mechanisms? | **Chapter available** |
| 16 | Order-book representations | Which access paths deserve independent indexes? | **Chapter available** |
| 17 | C++ and Rust implementations | How do language constraints change the best representation? | **Chapter available** |
| 18 | Capstone and defense | Can the system survive correctness, workload, and measurement challenges? | **Chapter available** |

## Gates

The program has four practical gates.

### Gate A — core mechanics

Build a vector, intrusive list, ring buffer, heap, and open-addressed hash table
from blank files. State the invariants and run randomized differential tests.

### Gate B — ordered and indexed data

Choose among balanced trees, radix structures, occupancy bitmaps, and flat
sorted storage for a declared key distribution. Defend the rejected choices.

### Gate C — machine behavior

Measure layout, allocation, cache, TLB, and branch effects without smuggling
setup work into or out of the timed boundary.

### Gate D — market structure capstone

Implement and compare at least two order-book representations under one frozen
trace and one common semantic contract. Report throughput, median and tail
latency, memory use, correctness evidence, and threats to validity.

## What comes next

The curriculum is complete. Start with the [diagnostic](diagnostic.md), follow
the chapter checkpoints, and use the [capstone](18-capstone-defense.md) to choose
one falsifiable representation question. New chapters should be added only when
they introduce a distinct workload, invariant, or machine mechanism.

## Coverage audit

Each relevant chapter must name and distinguish the standard-library baseline,
the custom learning implementation, and the low-latency specialization.

| Concept | C++ baseline | Rust baseline | Low-latency specialization |
|---|---|---|---|
| fixed array/view | built-in array, `std::array`, `std::span` | `[T; N]`, slices | dense grids, AoS/SoA |
| growable array | `std::vector` | `Vec` | static/small vector |
| linked sequence | `std::forward_list`, `std::list` | `LinkedList` | intrusive pooled list |
| stack | `std::stack`, vector-backed stack | `Vec` as stack | fixed-capacity stack |
| deque/ring | `std::deque` | `VecDeque` | bounded ring |
| priority queue | `std::priority_queue` | `BinaryHeap` | indexed heap |
| hash map/set | `std::unordered_map/set` | `HashMap/HashSet` | fixed open addressing |
| ordered map/set | `std::map/set` | `BTreeMap/BTreeSet` | flat map, radix, skip list |
| prefix/radix lookup | ordered/hash maps | ordered/hash maps | arena radix/trie |
| graph traversal | vectors, deque | `Vec`, `VecDeque` | CSR + bounded worklist |
| packed membership | `std::bitset`, word arrays | word arrays | hierarchical occupancy |
| range aggregate | vector + direct scan | `Vec` + direct scan | Fenwick/segment tree |
| allocation policy | allocator, `std::pmr` | reserved `Vec`, typed slots | arena/slab/generational pool |
| concurrent handoff | mutex, `std::atomic` | mutex, standard atomics | bounded ownership-specific SPSC |
