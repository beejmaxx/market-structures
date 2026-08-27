# Learning roadmap

<p class="chapter-subtitle">The program is eighteen modules. Only finished learning material appears as a chapter in the sidebar.</p>

The earlier prototype displayed every module as though the lesson already
existed. This roadmap separates the curriculum plan from completed chapters.

| Module | Topic | Core question | Status |
|---:|---|---|---|
| 01 | Vectors | When does contiguous movement beat pointer stability? | **Chapter available** |
| 02 | Intrusive lists and free lists | What do stable nodes buy, and what does pointer chasing cost? | **Chapter available** |
| 03 | Queues, deques, and rings | How should full, empty, wraparound, and backpressure be represented? | **Chapter available** |
| 04 | Heaps, priority, and sorting | Which minimum ordering is sufficient for the workload? | Planned |
| 05 | Hashing under pressure | What happens to lookup tails as clusters form? | Planned |
| 06 | Balanced search trees | Which invariants keep ordered mutation logarithmic? | Planned |
| 07 | Tries and radix structures | When can key structure replace comparison? | Planned |
| 08 | Graph representations | When should relationships be stored densely or sparsely? | Planned |
| 09 | Bitsets and occupancy maps | How can word-level operations replace searches? | Planned |
| 10 | Spatial and interval indexes | Which queries justify a specialized multidimensional index? | Planned |
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

The next chapter should be **Heaps, priority, and sorting**. It will not be linked
from the chapter list until it includes:

- a complete conceptual model;
- mutation invariants;
- C++ and Rust representation choices;
- an interactive heap-repair diagram;
- a blank-file build; and
- a measurement plan.
