# Graphs and disjoint sets

<p class="chapter-subtitle">Separate the abstract relationships from the representation used to walk them.</p>

A graph is a set of vertices and edges. Edges may be directed or undirected,
weighted or unweighted, unique or repeated. Those choices are part of the data
model, not implementation trivia.

```text
feed ──> normalizer ──> book ──> strategy
  └────────> recorder <─────────────┘
```

Dependency graphs, network routes, build pipelines, instrument relationships,
and state-machine reachability all use graph thinking. The graph itself need
not belong in a nanosecond hot path for its lessons about layout and worklists
to matter there.

## Representation first

For `V` vertices and `E` edges:

| Representation | Space | Edge test | Iterate neighbors | Best fit |
|---|---:|---:|---:|---|
| adjacency matrix | `O(V²)` | `O(1)` | `O(V)` | small dense graphs |
| adjacency list | `O(V+E)` | degree-dependent | `O(degree)` | mutable sparse graphs |
| edge list | `O(E)` | `O(E)` | `O(E)` | batch algorithms, sorting |
| CSR / packed offsets | `O(V+E)` | degree-dependent | dense sequential range | static sparse graphs |

Compressed sparse row (CSR) stores all destinations contiguously and gives each
vertex an offset range:

```text
offsets: [0, 2, 4, 7, 8]
edges:   [B, C, A, D, A, D, E, C]
neighbors(v) = edges[offsets[v] .. offsets[v+1]]
```

It removes per-vertex allocations and pointer chasing. Inserting a new edge may
shift a suffix or require rebuilding, so CSR is strongest when the graph is
built in a batch and traversed many times.

<div class="ms-lab" data-ms-graph>
  <div class="ms-lab-head">
    <div><span>INTERACTIVE</span><h3>Change the worklist, change the traversal</h3></div>
    <p>BFS uses a FIFO queue; DFS uses a LIFO stack. The graph and start vertex stay fixed.</p>
  </div>
  <div class="ms-controls">
    <button type="button" data-action="bfs">run BFS</button>
    <button type="button" data-action="dfs">run DFS</button>
    <button type="button" data-action="union">union next edge</button>
    <button type="button" data-action="reset">reset</button>
  </div>
  <div class="ms-graph" data-graph-nodes aria-label="Six graph vertices"></div>
  <div class="ms-stats" aria-live="polite">
    <div><span>algorithm</span><strong data-stat="algorithm">none</strong></div>
    <div><span>visited</span><strong data-stat="visited">0</strong></div>
    <div><span>components</span><strong data-stat="components">6</strong></div>
    <div><span>edges examined</span><strong data-stat="edges">0</strong></div>
  </div>
  <p class="ms-log" data-graph-log>Edges: A-B, A-C, B-D, C-D, C-E, D-F, E-F.</p>
</div>

## Breadth-first search

BFS discovers vertices by increasing unweighted distance from the source. Its
frontier is a FIFO queue:

```text
mark source discovered; enqueue source
while queue not empty:
    v = dequeue
    for each neighbor u of v:
        if u not discovered:
            mark u discovered
            parent[u] = v
            enqueue u
```

Mark on enqueue, not dequeue. Otherwise multiple parents can enqueue the same
vertex and inflate the worklist. At completion, `parent` reconstructs a shortest
unweighted path and `distance[u] = distance[parent[u]] + 1`.

With adjacency lists, BFS is `O(V+E)`. That notation does not show scattered
node loads, queue capacity growth, or the advantage of packed neighbor ranges.

## Depth-first search

DFS uses a call stack or explicit LIFO stack. It explores one path deeply before
backtracking. A three-color state is useful for directed graphs:

```text
white = unseen
gray  = entered, not finished
black = finished
```

An edge to a gray vertex reveals a directed cycle. Reverse finishing order on a
directed acyclic graph gives a topological order. Recursive DFS is concise, but
graph depth can overflow the program stack; an explicit bounded stack makes
capacity and failure policy visible.

## Weighted shortest paths

Dijkstra's algorithm repeatedly extracts the unsettled vertex with minimum
tentative distance, then relaxes outgoing edges. A binary heap supplies that
priority queue. Without decrease-key, push the improved pair again and discard
stale entries when popped:

```text
pop (distance, vertex)
if distance != best[vertex]: continue
for edge vertex -> next with weight w:
    candidate = distance + w
    if candidate < best[next]: update and push
```

Weights must be nonnegative. Overflow handling belongs in the correctness
contract. This is a concrete example of one data structure—heap—serving an
algorithm whose other dominant structure is an adjacency representation.

## Disjoint-set union

A disjoint-set union (DSU, or union-find) maintains a partition under:

```text
find(x)     -> representative of x's component
union(a,b) -> merge components if distinct
```

Each set is a parent tree. Roots point to themselves. **Union by size/rank**
attaches the smaller tree below the larger. **Path compression** rewrites nodes
encountered by `find` to point closer to the root.

```text
before find(D): D -> C -> B -> A
after  find(D): D ---------> A
               C ---------> A
```

Together these yield nearly constant amortized time. DSU answers connectivity,
not the path connecting two vertices, and it does not naturally support edge
deletion.

## Standard-language baselines

Neither the C++ nor Rust standard library provides a graph container. Build the
representation from standard contiguous collections first:

```cpp
using Vertex = std::uint32_t;
std::vector<std::vector<Vertex>> adjacency;
std::deque<Vertex> queue;
std::vector<std::uint8_t> visited;
```

```rust
type Vertex = usize;
let adjacency: Vec<Vec<Vertex>> = vec![vec![]; vertex_count];
let mut queue = std::collections::VecDeque::new();
let mut visited = vec![false; vertex_count];
```

For CSR, use one offsets vector and one edge vector in either language. Reserve
worklist and output capacity outside the timed region. Libraries can add rich
algorithms, but a standard-container baseline exposes the actual representation
well enough to learn from it.

## Custom bounded traversal

When maximum vertices and edges are known, assign dense integer vertex IDs and
preallocate:

```text
offsets[V + 1]
destinations[E]
visited_epoch[V]
worklist[V]
```

An epoch array can avoid clearing `V` booleans per query: a vertex is visited
for the current traversal when `visited_epoch[v] == epoch`. Increment the epoch
for each run and handle wraparound with a full clear. This replaces bulk writes
with one write per reached vertex.

## Failure modes

- directed edges are accidentally inserted in both directions;
- vertex IDs index outside packed arrays;
- BFS marks on dequeue and duplicates frontier work;
- recursive DFS exhausts the call stack;
- topological ordering is returned without detecting a cycle;
- Dijkstra is used with a negative edge or overflowing distance;
- DSU rank/size is updated on the wrong root; or
- a benchmark times graph construction while claiming traversal performance.

## Build it from a blank file

Implement one directed graph twice: adjacency vectors and CSR. Add iterative
BFS, iterative DFS, cycle detection, topological sort, and path reconstruction.
Validate every destination, offset monotonicity, and `offsets[V] == E`.

Separately implement DSU with union by size and path compression. Differential-
test connectivity against a slow component relabeling model after randomized
unions. Instrument parent links traversed before and after compression.

## Measure the claim

Generate graphs with identical vertices and edges in both representations:
sparse random, grid-like, high-degree hubs, long chains, and disconnected
components. Measure traversal latency distributions, edges per second, bytes per
edge, worklist maximum, allocations, and cache misses.

For DSU, compare naive linking, union by size only, compression only, and both.
Include adversarial union order. Plot links traversed per `find` over time; the
amortization becomes visible before wall-clock noise does.

## Checkpoint

Explain:

- why CSR accelerates traversal but complicates mutation;
- why BFS needs a queue and DFS a stack;
- when a visited mark must be written;
- what DSU cannot answer despite fast connectivity; and
- which costs `O(V+E)` hides on real hardware.

Next: [Bitsets and occupancy maps](09-bitsets-occupancy.md).
