# Learning roadmap

<p class="chapter-subtitle">The program is eighteen modules. Only finished learning material appears as a chapter in the sidebar.</p>

The earlier prototype displayed every module as though the lesson already
existed. This roadmap separates the curriculum plan from completed chapters.

| Module | Topic | Core question | Status |
|---:|---|---|---|
| 01 | Arrays and vectors | When does fixed contiguous storage become growable, and what does growth invalidate? | **Two chapters available** |
| 02 | Intrusive lists and free lists | What do stable nodes buy, and what does pointer chasing cost? | **Chapter available** |
| 03 | Stacks, queues, deques, and rings | How should LIFO/FIFO order, full, empty, wraparound, and backpressure be represented? | **Two chapters available** |
| 04 | Heaps, priority, and sorting | Which minimum ordering is sufficient for the workload? | **Chapter available** |
| 05 | Hashing under pressure | What happens to lookup tails as clusters form? | **Chapter available** |
| 06 | Balanced search trees | Which invariants keep ordered mutation logarithmic? | **Chapter available** |
| 07 | Tries and radix structures | When can key structure replace comparison? | **Chapter available** |
| 08 | Graph representations | When should relationships be stored densely or sparsely? | **Chapter available** |
| 09 | Bitsets and occupancy maps | How can word-level operations replace searches? | **Chapter available** |
| 10 | Spatial and interval indexes | Which queries justify a specialized multidimensional index? | **Chapter available** |
| 11 | Memory hierarchy | Which observed costs come from cache, TLB, branches, or dependencies? | Planned |
| 12 | Allocation and object pools | How do lifetime and reuse policies affect latency distributions? | Planned |
| 13 | Layout and indirection | When should data be AoS, SoA, packed, indexed, or pointer-linked? | Planned |
| 14 | Concurrency primitives | What memory-order guarantees does the algorithm actually need? | Planned |
| 15 | Benchmark design | Which experiment distinguishes the proposed mechanisms? | Planned |
| 16 | Order-book representations | Which access paths deserve independent indexes? | Planned |
| 17 | C++ and Rust implementations | How do language constraints change the best representation? | Planned |
| 18 | Capstone and defense | Can the system survive correctness, workload, and measurement challenges? | Planned |

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

The next chapter should be **Memory hierarchy**. It will not be linked
from the chapter list until it includes:

- a complete conceptual model;
- mutation invariants;
- C++ and Rust representation choices;
- an interactive cache-line diagram;
- a blank-file build; and
- a measurement plan.

## Coverage audit

Each relevant chapter must name and distinguish the standard-library baseline,
the custom learning implementation, and the low-latency specialization.

| Concept | C++ baseline | Rust baseline | Planned specialization |
|---|---|---|---|
| fixed array/view | built-in array, `std::array`, `std::span` | `[T; N]`, slices | dense grids, AoS/SoA |
| growable array | `std::vector` | `Vec` | static/small vector |
| stack | `std::stack`, vector-backed stack | `Vec` as stack | fixed-capacity stack |
| deque/ring | `std::deque` | `VecDeque` | bounded ring |
| priority queue | `std::priority_queue` | `BinaryHeap` | indexed heap |
| hash map/set | `std::unordered_map/set` | `HashMap/HashSet` | fixed open addressing |
| ordered map/set | `std::map/set` | `BTreeMap/BTreeSet` | flat map, radix, skip list |

Additional structures will appear where their workloads justify them: Bloom
filters under hashing; Fenwick and segment trees under range aggregation;
disjoint sets under graph algorithms; and arenas, slabs, and generational pools
under allocation.
