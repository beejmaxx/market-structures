'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type StartPage = {
  id: string;
  group: 'START HERE';
  number: string;
  title: string;
  shortTitle: string;
  tracked?: false;
};

type Chapter = {
  id: string;
  group: 'FOUNDATIONS' | 'ORDER & INDEX' | 'LOW LATENCY' | 'HFT LABS';
  number: string;
  title: string;
  shortTitle: string;
  deck: string;
  question: string;
  concepts: string[];
  build: string;
  invariants: string[];
  measure: string;
  defend: string;
  read: string;
  lab?: 'pool' | 'hash' | 'book';
  tracked: true;
};

type BookPage = StartPage | Chapter;
type Scores = Record<string, number>;
type Layout = 'contiguous' | 'linked';
type BookLayout = 'chain' | 'levels' | 'grid';

const startPages: StartPage[] = [
  { id: 'shape-of-speed', group: 'START HERE', number: '00', title: 'The Shape of Speed', shortTitle: 'The Shape of Speed' },
  { id: 'how-to-use', group: 'START HERE', number: 'A', title: 'How to Use This Book', shortTitle: 'How to Use This Book' },
  { id: 'diagnostic', group: 'START HERE', number: 'B', title: 'The Diagnostic', shortTitle: 'Diagnostic' },
];

const chapters: Chapter[] = [
  {
    id: 'arrays', group: 'FOUNDATIONS', number: '01', title: 'Arrays & Cost Models', shortTitle: 'Arrays & Cost Models',
    deck: 'Learn where asymptotics stop and concrete machine costs begin.',
    question: 'When does contiguous movement beat pointer stability?',
    concepts: ['ADT versus representation', 'geometric growth and amortization', 'object lifetime and invalidation', 'working-set size'],
    build: 'Implement a restricted FlatVector<T> and a fixed-capacity variant. Differential-test both against std::vector.',
    invariants: ['0 ≤ size ≤ capacity', 'elements [0, size) are live', 'growth preserves order exactly once'],
    measure: 'Append, scan, random lookup, and middle erase from L1-sized inputs through memory-sized inputs.',
    defend: 'Explain why one O(1) access can be materially slower than another and when a sorted vector beats a tree.',
    read: 'WEEK 01 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'intrusive-lists', group: 'FOUNDATIONS', number: '02', title: 'Intrusive Lists & Free Lists', shortTitle: 'Intrusive Lists',
    deck: 'Put links inside the object, remove allocator traffic, and own the lifetime risks.',
    question: 'What do stable addresses buy, and what does pointer chasing cost?',
    concepts: ['intrusive ownership', 'sentinels and link symmetry', 'LIFO slot reuse', 'generational handles'],
    build: 'Build an intrusive doubly linked list over a fixed order pool with a LIFO free stack and stale-handle detection.',
    invariants: ['next.prev and prev.next agree', 'every slot is exactly live or free', 'a generation changes on reuse'],
    measure: 'Compare contiguous traversal, scattered nodes, recently reused nodes, and allocation outside the timed path.',
    defend: 'Construct workloads where LIFO reuse helps, does nothing, and hurts.',
    read: 'WEEK 02 · 8–12 HOURS', lab: 'pool', tracked: true,
  },
  {
    id: 'queues-rings', group: 'FOUNDATIONS', number: '03', title: 'Queues, Deques & Rings', shortTitle: 'Queues & Rings',
    deck: 'Model bounded flow before atomics make the state machine harder to see.',
    question: 'How should full, empty, wraparound, and backpressure be represented?',
    concepts: ['circular indexing', 'full versus empty states', 'bounded capacity', 'backpressure semantics'],
    build: 'Implement a fixed-capacity ring and growable deque. Keep both single-threaded this week.',
    invariants: ['head and tail stay in range', 'logical size agrees with occupied slots', 'wraparound preserves FIFO'],
    measure: 'Compare ring, deque, and list under steady FIFO traffic, bursts, and changing element sizes.',
    defend: 'Explain what bounded capacity buys besides speed and where backpressure belongs in a trading pipeline.',
    read: 'WEEK 03 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'heaps-sorting', group: 'FOUNDATIONS', number: '04', title: 'Heaps, Priority & Sorting', shortTitle: 'Heaps & Sorting',
    deck: 'Turn partial order into useful operations—and recognize when it is the wrong order.',
    question: 'Which minimum ordering is sufficient for the workload?',
    concepts: ['implicit binary heaps', 'heapify', 'comparison lower bound', 'integer sorting'],
    build: 'Implement a min-heap with replace_top, linear heapify, and an ID-to-index map for priority updates.',
    invariants: ['every parent dominates its children', 'ID index points to the correct heap position', 'size matches storage'],
    measure: 'Compare repeated push/pop with batch heapify and comparison sorting with radix/counting sorting.',
    defend: 'Explain why a heap exposes best price well but is usually wrong for price-time cancellation.',
    read: 'WEEK 04 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'hashing', group: 'FOUNDATIONS', number: '05', title: 'Hashing Under Pressure', shortTitle: 'Hashing',
    deck: 'Expected O(1) is a distributional claim. Instrument the distribution.',
    question: 'What happens to successful and failed lookup tails as clusters form?',
    concepts: ['open addressing', 'load factor and clustering', 'tombstones', 'Robin Hood and hostile inputs'],
    build: 'Build a fixed-capacity linear-probing map from order ID to pool handle with probe instrumentation.',
    invariants: ['search never stops before a reachable key', 'deletion preserves probe chains', 'keys are unique'],
    measure: 'Report lookup time and probe-count distributions by load factor, hit rate, and hash quality.',
    defend: 'Repair a broken deletion and explain why low average probes can coexist with terrible failed-lookup p99.',
    read: 'WEEK 05 · GATE A', lab: 'hash', tracked: true,
  },
  {
    id: 'balanced-trees', group: 'ORDER & INDEX', number: '06', title: 'Balanced Search Trees', shortTitle: 'Balanced Trees',
    deck: 'Maintain order through mutation without trusting lucky insertion sequences.',
    question: 'What metadata and rotations keep height bounded?',
    concepts: ['BST ordering', 'AVL rotations', 'red-black invariants', 'predecessor and successor'],
    build: 'Implement an AVL map with insertion, erasure, predecessor, successor, and a complete invariant checker.',
    invariants: ['in-order traversal is sorted', 'stored height is exact', '|left height − right height| ≤ 1'],
    measure: 'Compare AVL, std::map, sorted vector, and hash map across lookup-heavy and mutation-heavy traces.',
    defend: 'Prove that a double rotation preserves key order and identify locality costs hidden by O(log n).',
    read: 'WEEK 06 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'btrees-flat', group: 'ORDER & INDEX', number: '07', title: 'B-Trees & Flat Maps', shortTitle: 'B-Trees & Flat Maps',
    deck: 'Trade pointer depth for fanout, comparisons, and controlled movement.',
    question: 'When does moving keys beat following more pointers?',
    concepts: ['multiway nodes', 'split and merge', 'fanout', 'Eytzinger and flat layouts'],
    build: 'Implement a small fixed-order B-tree or 2-3-4 tree and a sorted flat map.',
    invariants: ['keys partition child ranges', 'occupancy bounds hold', 'all leaves share a depth'],
    measure: 'Count comparisons and bytes moved for lookup and insertion over small, medium, and large sets.',
    defend: 'Explain why asymptotically equivalent ordered maps differ and why bigger nodes eventually hurt.',
    read: 'WEEK 07 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'tries-bitmaps', group: 'ORDER & INDEX', number: '08', title: 'Tries, Bitsets & Price Grids', shortTitle: 'Tries & Bitmaps',
    deck: 'Exploit a bounded integer universe when the memory budget and sparsity permit it.',
    question: 'When can direct addressing replace comparison?',
    concepts: ['radix decomposition', 'dense bitsets', 'find-first-set', 'hierarchical occupancy summaries'],
    build: 'Build permanent integer-price slots with a two-level occupancy bitmap and next/previous occupied queries.',
    invariants: ['summary bits agree with leaf words', 'empty slots hold no live level', 'best bid/ask matches occupancy'],
    measure: 'Compare bitmap, tree, and scan under dense, sparse, clustered, and moving price distributions.',
    defend: 'Explain what a 100× wider, 99.9% sparse domain does to the design.',
    read: 'WEEK 08 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'range-structures', group: 'ORDER & INDEX', number: '09', title: 'Augmentation & Range Queries', shortTitle: 'Range Structures',
    deck: 'Pay mutation cost now—or recompute derived state when someone asks.',
    question: 'Which aggregates deserve permanent maintenance?',
    concepts: ['Fenwick trees', 'segment trees', 'prefix search', 'augmented metadata'],
    build: 'Implement volume-by-price point update, range volume, prefix volume, and inverse prefix search.',
    invariants: ['tree metadata equals its represented range', 'updates touch exactly the dependent nodes', 'reference scan agrees'],
    measure: 'Vary update/query mix, price-domain size, and requested depth. Compare against scanning top N.',
    defend: 'Name the query frequency at which maintaining aggregation stops paying.',
    read: 'WEEK 09 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'graphs', group: 'ORDER & INDEX', number: '10', title: 'Graphs & Disjoint Sets', shortTitle: 'Graphs & DSU',
    deck: 'Close the general algorithms gap and reuse your own heap under a different abstraction.',
    question: 'How should connectivity be stored for this density and operation mix?',
    concepts: ['adjacency representations', 'BFS and DFS', 'Dijkstra', 'union by rank and path compression'],
    build: 'Implement adjacency list/matrix, BFS, iterative DFS, Dijkstra, and disjoint set union.',
    invariants: ['frontier state is consistent', 'settled distances never improve', 'DSU roots represent components'],
    measure: 'Locate the empirical adjacency-list/matrix crossover as graph density changes.',
    defend: 'Explain stale heap entries in Dijkstra and the amortized behavior of union-find.',
    read: 'WEEK 10 · GATE B', tracked: true,
  },
  {
    id: 'pools-handles', group: 'LOW LATENCY', number: '11', title: 'Pools, Slabs & Handles', shortTitle: 'Pools & Handles',
    deck: 'Make capacity, lifetime, and reuse explicit instead of paying an allocator by default.',
    question: 'Can fixed capacity simplify both performance and correctness?',
    concepts: ['arenas and slabs', 'fragmentation', 'alignment and lifetime', 'pointer versus index handles'],
    build: 'Turn the intrusive pool into a fixed-capacity typed slot map with generational handles.',
    invariants: ['every slot is free or live', 'live count is exact', 'stale generations are rejected'],
    measure: 'Compare new/delete, arena allocation, FIFO reuse, and LIFO reuse under hot churn and broad cold sets.',
    defend: 'Compare pointer and 32-bit index links across size, relocation, validation, and address calculation.',
    read: 'WEEK 11 · C++ + SELECTIVE RUST', lab: 'pool', tracked: true,
  },
  {
    id: 'cache-layout', group: 'LOW LATENCY', number: '12', title: 'Cache-Aware Data Layout', shortTitle: 'Cache-Aware Layout',
    deck: 'Shape the bytes around the operations that dominate the workload.',
    question: 'Which fields travel together through the hot path?',
    concepts: ['cache lines and TLBs', 'AoS versus SoA', 'hot/cold splitting', 'branch and prefetch behavior'],
    build: 'Implement AoS, SoA, and hot/cold order layouts under one generated operation trace.',
    invariants: ['all layouts produce one checksum', 'field semantics are identical', 'setup stays outside timing'],
    measure: 'Scan, point lookup, and mutate across working sets; capture available hardware counters.',
    defend: 'Separate fewer instructions, fewer cache misses, lower mean, and lower tail latency.',
    read: 'WEEK 12 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'measurement', group: 'LOW LATENCY', number: '13', title: 'Measurement Without Self-Deception', shortTitle: 'Measurement',
    deck: 'A benchmark is an argument. Make every premise inspectable.',
    question: 'What narrow conclusion does this experiment actually support?',
    concepts: ['timed boundaries', 'warmup and batching', 'latency distributions', 'bias and falsification'],
    build: 'Build a trace-driven harness with correctness hashes, randomized contender order, metadata, and raw output.',
    invariants: ['contenders consume identical work', 'all final states agree', 'setup is excluded from the timed region'],
    measure: 'Try to falsify an earlier performance claim with four workloads and three working-set sizes.',
    defend: 'Critique the workspace harnesses and state which cross-language comparisons are justified.',
    read: 'WEEK 13 · GATE C', tracked: true,
  },
  {
    id: 'memory-model', group: 'LOW LATENCY', number: '14', title: 'Concurrency & the Memory Model', shortTitle: 'The Memory Model',
    deck: 'Draw synchronization before optimizing synchronization.',
    question: 'Which edge makes a write visible, and to whom?',
    concepts: ['data races', 'happens-before', 'condition variables', 'acquire/release and SC'],
    build: 'Build a bounded mutex/condition-variable queue with explicit close, drain, blocking, and shutdown semantics.',
    invariants: ['wait predicates guard every wake', 'publication happens before consumption', 'shutdown wakes both sides'],
    measure: 'Separate direct service time from queue delay and end-to-end latency.',
    defend: 'Draw the happens-before graph before naming a memory order.',
    read: 'WEEK 14 · 8–12 HOURS', tracked: true,
  },
  {
    id: 'spsc', group: 'LOW LATENCY', number: '15', title: 'SPSC Rings & Ownership', shortTitle: 'SPSC Rings',
    deck: 'Use single-writer ownership to remove coordination you do not need.',
    question: 'Which fields belong exclusively to producer and consumer?',
    concepts: ['monotonic sequences', 'publication order', 'false sharing', 'batching and wait policy'],
    build: 'Begin with SC atomics, prove publication, then weaken only the operations justified by the proof.',
    invariants: ['producer never overwrites unread data', 'consumer never reads unpublished data', 'sequence distance stays bounded'],
    measure: 'Compare direct call, mutex queue, SPSC, and batched SPSC under balanced and overloaded rates.',
    defend: 'Explain every atomic order and why the SPSC result says nothing automatic about MPMC.',
    read: 'WEEK 15 · GATE D · C++ + RUST', tracked: true,
  },
  {
    id: 'order-books', group: 'HFT LABS', number: '16', title: 'Order-Book Representations', shortTitle: 'Order Books',
    deck: 'One matching rule; several radically different ways to make its operations cheap.',
    question: 'Which index serves add, cancel, best-price, FIFO, and depth under this workload?',
    concepts: ['price-time priority', 'ID and price indexes', 'intrusive FIFO', 'chain, levels, and grid tradeoffs'],
    build: 'Specify semantics, predict each representation, reproduce the controlled experiment, then add an adversarial trace.',
    invariants: ['best prices are exact', 'FIFO is preserved within price', 'ID index and live orders agree'],
    measure: 'Test top-heavy, deep-cancel, wide-sparse, and moving-center workloads separately.',
    defend: 'Recommend representations for three venues without claiming one universal winner.',
    read: 'WEEK 16 · WORKSPACE LAB', lab: 'book', tracked: true,
  },
  {
    id: 'market-replay', group: 'HFT LABS', number: '17', title: 'Market-Data Replay', shortTitle: 'Market Replay',
    deck: 'Maintain a trustworthy participant view while messages, gaps, and recovery change state.',
    question: 'When is the local book valid enough to publish a feature?',
    concepts: ['snapshot plus incrementals', 'sequence gaps', 'recovery state machine', 'normalized features'],
    build: 'Trace decoded update → local book → feature and reimplement one critical operation without looking.',
    invariants: ['sequences are contiguous while live', 'gapped state publishes nothing trusted', 'snapshot resets the base'],
    measure: 'Separate decoder, book update, feature, batch, and end-to-end costs.',
    defend: 'Redesign for a 100× wider and 99.9% sparse price domain.',
    read: 'WEEK 17 · WORKSPACE LAB', tracked: true,
  },
  {
    id: 'exchange-capstone', group: 'HFT LABS', number: '18', title: 'Exchange Capstone & Defense', shortTitle: 'Exchange Capstone',
    deck: 'Turn the workspace into an artifact you can explain, challenge, and improve deliberately.',
    question: 'What is the first evidence-backed change worth making?',
    concepts: ['journal and replay', 'matching invariants', 'threaded pipeline', 'proposal and falsification'],
    build: 'Trace one command end to end, reproduce baselines, write a one-page optimization proposal, then implement it.',
    invariants: ['replay regenerates state', 'direct and threaded outputs agree', 'every result has a correctness hash'],
    measure: 'Compare only frozen semantics and workloads; separate throughput, service, queue, and end-to-end latency.',
    defend: 'Give a 45-minute defense with a blank-file implementation and live benchmark critique.',
    read: 'WEEK 18 · FINAL DEFENSE', tracked: true,
  },
];

const allPages: BookPage[] = [...startPages, ...chapters];
const groupOrder: BookPage['group'][] = ['START HERE', 'FOUNDATIONS', 'ORDER & INDEX', 'LOW LATENCY', 'HFT LABS'];

function MemoryWalk() {
  const [layout, setLayout] = useState<Layout>('contiguous');
  const [cursor, setCursor] = useState(0);
  const [misses, setMisses] = useState(1);
  const addresses = useMemo(() => layout === 'contiguous'
    ? ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']
    : ['A0', 'F7', 'C2', 'H4', 'B9', 'E1', 'G6', 'D3'], [layout]);

  function choose(next: Layout) { setLayout(next); setCursor(0); setMisses(1); }
  function step() {
    if (cursor === addresses.length - 1) { setCursor(0); setMisses(1); return; }
    setCursor((value) => value + 1);
    if (layout === 'linked' || (layout === 'contiguous' && cursor === 3)) setMisses((value) => value + 1);
  }

  return (
    <section className="lab-card" aria-labelledby="memory-walk-title">
      <div className="lab-heading">
        <div><span className="eyebrow">INTERACTIVE · MEMORY WALK</span><h2 id="memory-walk-title">Same O(n). Different machine.</h2></div>
        <div className="segmented" aria-label="Memory layout">
          <button aria-pressed={layout === 'contiguous'} onClick={() => choose('contiguous')}>Contiguous</button>
          <button aria-pressed={layout === 'linked'} onClick={() => choose('linked')}>Linked</button>
        </div>
      </div>
      <p className="lab-copy">Step through eight logical elements. Big-O counts eight visits in both cases; layout changes how many cache lines the machine may fetch.</p>
      <div className={`memory-map ${layout}`}>
        {addresses.map((address, index) => (
          <div className="memory-hop" key={`${layout}-${address}`}>
            <div className={`memory-cell ${index === cursor ? 'active' : ''} ${index < cursor ? 'visited' : ''}`}>
              <span className="cell-index">ORDER {index + 1}</span><strong>{address}</strong>
            </div>
            {index < addresses.length - 1 && <span className="hop-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>
      <div className="lab-footer">
        <button className="step-button" onClick={step}>{cursor === addresses.length - 1 ? 'Reset walk' : 'Visit next'} <span aria-hidden="true">→</span></button>
        <dl className="lab-stats">
          <div><dt>elements visited</dt><dd>{cursor + 1} / 8</dd></div>
          <div><dt>illustrative line fetches</dt><dd>{misses}</dd></div>
          <div><dt>asymptotic work</dt><dd>O(n)</dd></div>
        </dl>
      </div>
    </section>
  );
}

function PoolLab() {
  const [slots, setSlots] = useState<(string | null)[]>(['O-104', 'O-107', null, null, null, null]);
  const [free, setFree] = useState([5, 4, 3, 2]);
  const [nextId, setNextId] = useState(108);
  const [event, setEvent] = useState('The free stack points at slot 2. The next allocation touches the most recently released slot.');

  function allocate() {
    if (!free.length) { setEvent('Capacity exhausted. Fixed capacity makes failure explicit.'); return; }
    const nextFree = free[free.length - 1];
    const order = `O-${nextId}`;
    setSlots((current) => current.map((value, index) => index === nextFree ? order : value));
    setFree((current) => current.slice(0, -1));
    setNextId((value) => value + 1);
    setEvent(`${order} reused slot ${nextFree}; no general allocation occurred.`);
  }

  function release(index: number) {
    const order = slots[index];
    if (!order) return;
    setSlots((current) => current.map((value, slot) => slot === index ? null : value));
    setFree((current) => [...current, index]);
    setEvent(`${order} was released. Slot ${index} is now the top of the LIFO free stack.`);
  }

  function reset() { setSlots(['O-104', 'O-107', null, null, null, null]); setFree([5, 4, 3, 2]); setNextId(108); setEvent('Reset. Release a live order or allocate from the stack.'); }

  return (
    <section className="lab-card pool-lab">
      <div className="lab-heading"><div><span className="eyebrow">INTERACTIVE · SLOT POOL</span><h2>Make reuse visible.</h2></div><button className="quiet-button" onClick={reset}>Reset</button></div>
      <p className="lab-copy">Click a live order to release it, then allocate. Watch the free stack—not an allocator—decide which address is touched next.</p>
      <div className="pool-stage">
        <div><span className="stage-label">PREALLOCATED SLOTS</span><div className="slot-row">
          {slots.map((order, index) => <button className={`pool-slot ${order ? 'live' : 'free'}`} key={index} onClick={() => release(index)} disabled={!order}><small>SLOT {index}</small><strong>{order ?? 'FREE'}</strong></button>)}
        </div></div>
        <div className="free-stack"><span className="stage-label">FREE STACK · TOP →</span><div>{[...free].reverse().map((slot, index) => <span className={index === 0 ? 'top' : ''} key={slot}>{slot}</span>)}</div></div>
      </div>
      <div className="lab-footer"><button className="step-button" onClick={allocate}>Allocate order →</button><p className="event-log">{event}</p></div>
    </section>
  );
}

type HashCell = number | 'DEL' | null;

function probePath(table: HashCell[], key: number, inserting: boolean) {
  const path: number[] = [];
  for (let offset = 0; offset < table.length; offset += 1) {
    const index = (key + offset) % table.length;
    path.push(index);
    if (table[index] === key) break;
    if (table[index] === null) break;
    if (inserting && table[index] === 'DEL') break;
  }
  return path;
}

function HashLab() {
  const initial: HashCell[] = [16, 9, null, 3, 11, null, null, null];
  const [table, setTable] = useState<HashCell[]>(initial);
  const [key, setKey] = useState(19);
  const [mode, setMode] = useState<'find' | 'insert' | 'delete'>('find');
  const [path, setPath] = useState<number[]>(probePath(initial, 19, false));
  const [cursor, setCursor] = useState(0);
  const currentIndex = path[Math.min(cursor, path.length - 1)];

  function prepare(nextMode: 'find' | 'insert' | 'delete', nextKey = key) {
    setMode(nextMode); setPath(probePath(table, nextKey, nextMode === 'insert')); setCursor(0);
  }
  function advance() {
    if (cursor < path.length - 1) { setCursor((value) => value + 1); return; }
    const index = path[path.length - 1];
    if (mode === 'insert' && table[index] !== key) setTable((current) => current.map((cell, slot) => slot === index ? key : cell));
    if (mode === 'delete' && table[index] === key) setTable((current) => current.map((cell, slot) => slot === index ? 'DEL' : cell));
  }
  function reset() { setTable(initial); setKey(19); setMode('find'); setPath(probePath(initial, 19, false)); setCursor(0); }
  const cell = table[currentIndex];
  const status = cell === key ? `Key ${key} found at slot ${currentIndex}.` : cell === null ? `Empty slot ${currentIndex} terminates the search.` : cell === 'DEL' ? `Tombstone at ${currentIndex}; a lookup must continue.` : `Collision with ${cell} at slot ${currentIndex}.`;

  return (
    <section className="lab-card hash-lab">
      <div className="lab-heading"><div><span className="eyebrow">INTERACTIVE · OPEN ADDRESSING</span><h2>Follow the probe, not the slogan.</h2></div><button className="quiet-button" onClick={reset}>Reset</button></div>
      <div className="hash-controls">
        <label>KEY<input type="number" min="0" value={key} onChange={(event) => { const value = Number(event.target.value); setKey(value); setPath(probePath(table, value, mode === 'insert')); setCursor(0); }} /></label>
        <div className="segmented"><button aria-pressed={mode === 'find'} onClick={() => prepare('find')}>Find</button><button aria-pressed={mode === 'insert'} onClick={() => prepare('insert')}>Insert</button><button aria-pressed={mode === 'delete'} onClick={() => prepare('delete')}>Delete</button></div>
      </div>
      <div className="hash-function"><code>slot = (key + probe) &amp; 7</code><span>start: {key & 7}</span></div>
      <div className="hash-table">
        {table.map((value, index) => <div className={`hash-cell ${index === currentIndex ? 'active' : ''} ${path.slice(0, cursor).includes(index) ? 'visited' : ''}`} key={index}><small>{index}</small><strong>{value ?? '∅'}</strong></div>)}
      </div>
      <div className="lab-footer"><button className="step-button" onClick={advance}>{cursor < path.length - 1 ? 'Next probe →' : mode === 'find' ? 'Search complete' : `${mode} here →`}</button><p className="event-log">{status} <span>Probe {cursor + 1} of {path.length}.</span></p></div>
    </section>
  );
}

type Order = { id: string; side: 'B' | 'S'; price: number; qty: number; seq: number };
const bookOps = [
  'ADD B1 · BUY 101 × 5', 'ADD B2 · BUY 100 × 8', 'ADD B3 · BUY 101 × 3',
  'ADD S1 · SELL 103 × 4', 'ADD S2 · SELL 102 × 7', 'CANCEL B1', 'MARKET SELL × 5',
];

function bookAt(step: number) {
  let orders: Order[] = [];
  for (let index = 0; index < step; index += 1) {
    if (index === 0) orders.push({ id: 'B1', side: 'B', price: 101, qty: 5, seq: 1 });
    if (index === 1) orders.push({ id: 'B2', side: 'B', price: 100, qty: 8, seq: 2 });
    if (index === 2) orders.push({ id: 'B3', side: 'B', price: 101, qty: 3, seq: 3 });
    if (index === 3) orders.push({ id: 'S1', side: 'S', price: 103, qty: 4, seq: 4 });
    if (index === 4) orders.push({ id: 'S2', side: 'S', price: 102, qty: 7, seq: 5 });
    if (index === 5) orders = orders.filter((order) => order.id !== 'B1');
    if (index === 6) {
      let remaining = 5;
      orders = [...orders].sort((a, b) => a.side === 'B' && b.side === 'B' ? b.price - a.price || a.seq - b.seq : a.seq - b.seq).map((order) => {
        if (order.side !== 'B' || remaining === 0) return order;
        const fill = Math.min(order.qty, remaining); remaining -= fill;
        return { ...order, qty: order.qty - fill };
      }).filter((order) => order.qty > 0);
    }
  }
  return orders;
}

function OrderBookLab() {
  const [layout, setLayout] = useState<BookLayout>('levels');
  const [step, setStep] = useState(0);
  const orders = bookAt(step);
  const prices = [103, 102, 101, 100, 99];
  const bestBid = Math.max(...orders.filter((order) => order.side === 'B').map((order) => order.price), -Infinity);
  const bestAsk = Math.min(...orders.filter((order) => order.side === 'S').map((order) => order.price), Infinity);
  const representation = {
    chain: ['HEAD', ...orders.slice().sort((a, b) => a.side.localeCompare(b.side) || (a.side === 'B' ? b.price - a.price : a.price - b.price) || a.seq - b.seq).map((order) => `${order.id}@${order.price}`)],
    levels: prices.filter((price) => orders.some((order) => order.price === price)).map((price) => `${price} [${orders.filter((order) => order.price === price).map((order) => order.id).join('→')}]`),
    grid: prices.map((price) => `${price}:${orders.some((order) => order.price === price) ? '1' : '0'}`),
  }[layout];

  return (
    <section className="lab-card book-lab">
      <div className="lab-heading"><div><span className="eyebrow">INTERACTIVE · ORDER BOOK</span><h2>Freeze semantics. Change representation.</h2></div><div className="segmented"><button aria-pressed={layout === 'chain'} onClick={() => setLayout('chain')}>Chain</button><button aria-pressed={layout === 'levels'} onClick={() => setLayout('levels')}>Levels</button><button aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button></div></div>
      <p className="lab-copy">Replay one price-time-priority trace. The visible book must remain identical while the internal path changes.</p>
      <div className="book-stage">
        <div className="price-ladder"><div className="ladder-head"><span>BID FIFO</span><span>PRICE</span><span>ASK FIFO</span></div>{prices.map((price) => {
          const bids = orders.filter((order) => order.side === 'B' && order.price === price).sort((a, b) => a.seq - b.seq);
          const asks = orders.filter((order) => order.side === 'S' && order.price === price).sort((a, b) => a.seq - b.seq);
          return <div className={`price-row ${price === bestBid ? 'best-bid' : ''} ${price === bestAsk ? 'best-ask' : ''}`} key={price}><div>{bids.map((order) => <span key={order.id}>{order.id}·{order.qty}</span>)}</div><strong>{price}</strong><div>{asks.map((order) => <span key={order.id}>{order.id}·{order.qty}</span>)}</div></div>;
        })}</div>
        <div className="representation-panel"><span className="stage-label">{layout.toUpperCase()} REPRESENTATION</span><div className={`representation ${layout}`}>{representation.length ? representation.map((node, index) => <div className="representation-hop" key={`${node}-${index}`}><span>{node}</span>{index < representation.length - 1 && <b>→</b>}</div>) : <em>empty</em>}</div><p>{layout === 'chain' ? 'Cheap head access; traversal depends on distance from top of book.' : layout === 'levels' ? 'Ordered active prices plus FIFO orders inside each level.' : 'Permanent price slots; occupancy bitmap finds the next active price.'}</p></div>
      </div>
      <div className="trace-player"><span className="stage-label">TRACE</span><ol>{bookOps.map((op, index) => <li className={index === step ? 'next' : index < step ? 'done' : ''} key={op}><span>{String(index + 1).padStart(2, '0')}</span>{op}</li>)}</ol></div>
      <div className="lab-footer"><div className="player-buttons"><button className="quiet-button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</button><button className="step-button" onClick={() => setStep(step === bookOps.length ? 0 : step + 1)}>{step === bookOps.length ? 'Reset trace' : 'Apply next →'}</button></div><dl className="lab-stats"><div><dt>best bid</dt><dd>{bestBid === -Infinity ? '—' : bestBid}</dd></div><div><dt>best ask</dt><dd>{bestAsk === Infinity ? '—' : bestAsk}</dd></div><div><dt>live orders</dt><dd>{orders.length}</dd></div></dl></div>
    </section>
  );
}

function ShapeChapter() {
  return <>
    <p className="breadcrumb">START HERE <span>/</span> CHAPTER 00</p>
    <h1>The Shape<br />of Speed</h1>
    <p className="chapter-deck">A data structure is not a vocabulary word. It is a bet about the workload, the machine, and what must never break.</p>
    <div className="chapter-meta"><span>12 MIN READ</span><span>1 INTERACTIVE LAB</span><span>NO PREREQUISITES</span></div>
    <div className="opening-grid"><p className="dropcap">The useful skill is not knowing that a hash table has expected constant-time lookup. It is knowing when that sentence predicts reality, when it hides the tail, and which experiment would prove you wrong.</p><aside className="margin-note"><span>THE RULE</span>Never optimize a structure you cannot specify, test, and defend.</aside></div>
    <div className="equation-strip" aria-label="The book's reasoning loop"><div><span>01</span><strong>WORKLOAD</strong><small>What actually happens?</small></div><b>→</b><div><span>02</span><strong>INVARIANTS</strong><small>What must remain true?</small></div><b>→</b><div><span>03</span><strong>REPRESENTATION</strong><small>Where does state live?</small></div><b>→</b><div><span>04</span><strong>EVIDENCE</strong><small>Did the bet pay off?</small></div></div>
    <h2 className="section-title">Complexity is the beginning</h2><p>Asymptotic analysis tells you how work scales. Low-latency engineering asks a second set of questions: how many dependent loads, branches, cache lines, allocations, and contended ownership transfers sit inside that work?</p>
    <MemoryWalk />
    <div className="takeaway"><span>TAKEAWAY 00</span><p>Count operations on paper. Then account for the machine. You need both.</p></div>
  </>;
}

function ProgramPage({ scores, navigate }: { scores: Scores; navigate: (id: string) => void }) {
  const mastered = chapters.filter((chapter) => (scores[chapter.id] ?? 0) >= 3).length;
  return <>
    <p className="breadcrumb">START HERE <span>/</span> THE PROGRAM</p><h1 className="compact-title">Learn by<br />owning it.</h1>
    <p className="chapter-deck">Eighteen modules take you from operation costs to an evidence-backed HFT capstone. Reading never completes a module; demonstrated ownership does.</p>
    <div className="mastery-scale">{[
      ['0', 'UNSEEN'], ['1', 'DESCRIBE'], ['2', 'BUILD WITH NOTES'], ['3', 'BUILD + DEFEND'], ['4', 'SELECT + MEASURE'],
    ].map(([score, label]) => <div key={score}><strong>{score}</strong><span>{label}</span></div>)}</div>
    <div className="program-progress"><span style={{ width: `${(mastered / chapters.length) * 100}%` }} /><p><b>{mastered}</b> of {chapters.length} modules at mastery 3+</p></div>
    <h2 className="section-title">The loop never changes</h2>
    <div className="learning-loop">{['Specify the ADT', 'State the workload', 'Predict', 'Write invariants', 'Build a reference', 'Implement', 'Attack it', 'Analyze', 'Measure', 'Defend'].map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></div>)}</div>
    <h2 className="section-title phase-heading">The 18-module route</h2>
    <div className="curriculum-map">{groupOrder.slice(1).map((group) => <section key={group}><header><span>{group}</span><b>{chapters.filter((chapter) => chapter.group === group).length} modules</b></header>{chapters.filter((chapter) => chapter.group === group).map((chapter) => <button key={chapter.id} onClick={() => navigate(chapter.id)}><span>{chapter.number}</span><div><strong>{chapter.shortTitle}</strong><small>{chapter.question}</small></div><b className={`score-dot score-${scores[chapter.id] ?? 0}`}>{scores[chapter.id] ?? 0}</b></button>)}</section>)}</div>
    <div className="ai-contract"><span>THE AI CONTRACT</span><h2>The agent is a tutor until you own the core.</h2><ul><li>45 minutes on theory and 90 minutes on implementation before requesting a solution.</li><li>Ask for one hint, adversarial tests, a review, or an oral exam—not an instant replacement.</li><li>Every generated hot path requires a trace, invariant rewrite, behavior change, and predicted test failure.</li></ul></div>
  </>;
}

function DiagnosticPage({ navigate }: { navigate: (id: string) => void }) {
  const tasks = [
    ['00:30', 'Cost map', 'Compare arrays, lists, heaps, hashes, and balanced trees. Give one losing workload for each.'],
    ['01:30', 'Blank-file heap', 'Implement fixed-capacity push, top, and pop. Write the heap invariant first.'],
    ['01:00', 'Linear probing', 'Implement a fixed integer set with empty, occupied, and deleted states.'],
    ['00:30', 'Benchmark critique', 'Find the timed boundary, oracle, workload assumption, and one threat in a local harness.'],
    ['00:30', 'Oral defense', 'Explain both implementations aloud and record honest 0–4 scores.'],
  ];
  return <>
    <p className="breadcrumb">START HERE <span>/</span> BASELINE</p><h1 className="compact-title">Four hours.<br />No preparation.</h1>
    <p className="chapter-deck">This is a baseline, not a verdict. Timebox each task, preserve the first attempt, then run tests and sanitizers afterward.</p>
    <div className="diagnostic-total"><strong>04:00</strong><span>TOTAL TIMEBOX</span><p>Do not look up implementations. Record where reasoning stops.</p></div>
    <div className="diagnostic-list">{tasks.map(([time, title, copy], index) => <section key={title}><span>{time}</span><div><small>TASK {index + 1}</small><h2>{title}</h2><p>{copy}</p></div></section>)}</div>
    <div className="takeaway"><span>WHEN FINISHED</span><p>Keep the mistakes. They become your first study plan.</p></div>
    <button className="next-chapter" onClick={() => navigate('arrays')}><span>BEGIN WEEK 01</span><strong>Arrays & Cost Models →</strong></button>
  </>;
}

function LessonPage({ chapter }: { chapter: Chapter }) {
  const [hint, setHint] = useState(false);
  return <>
    <p className="breadcrumb">{chapter.group} <span>/</span> MODULE {chapter.number}</p><h1 className="lesson-title">{chapter.title}</h1><p className="chapter-deck">{chapter.deck}</p>
    <div className="chapter-meta"><span>{chapter.read}</span><span>BLANK-FILE BUILD</span><span>ORAL DEFENSE</span></div>
    <section className="driving-question"><span>DRIVING QUESTION</span><h2>{chapter.question}</h2></section>
    <div className="concept-grid"><section><span>YOU NEED TO OWN</span><ul>{chapter.concepts.map((concept) => <li key={concept}>{concept}</li>)}</ul></section><section><span>YOU WILL BUILD</span><p>{chapter.build}</p></section></div>
    <h2 className="section-title">Mutation contract</h2><p>Before code, make the state rules executable. The invariant checker runs after every randomized operation, outside the timed benchmark.</p>
    <div className="invariant-diagram"><div className="operation-node">OPERATION<small>one state transition</small></div><b>→</b><div className="state-node">MUTATE<small>representation changes</small></div><b>→</b><div className="invariant-node"><span>INVARIANTS</span>{chapter.invariants.map((invariant) => <small key={invariant}>✓ {invariant}</small>)}</div></div>
    {chapter.lab === 'pool' && <PoolLab />}{chapter.lab === 'hash' && <HashLab />}{chapter.lab === 'book' && <OrderBookLab />}
    <div className="work-cards"><section><span>MEASURE</span><h2>Try to break the prediction.</h2><p>{chapter.measure}</p></section><section><span>DEFEND</span><h2>Answer without code.</h2><p>{chapter.defend}</p></section></div>
    <section className="checkpoint"><span>CHECKPOINT</span><h2>What workload change would reverse your current choice?</h2><button onClick={() => setHint((value) => !value)}>{hint ? 'Hide examiner prompt' : 'Ask for an examiner prompt'}</button>{hint && <p>Change one of: operation mix, cardinality, key distribution, working-set size, price sparsity, writer count, or failure requirement. Name the mechanism—not merely “cache locality.”</p>}</section>
  </>;
}

function ScoreControl({ page, score, setScore }: { page: BookPage; score: number; setScore: (score: number) => void }) {
  if (!('tracked' in page) || !page.tracked) return <div className="objective-card"><span>BOOK OBJECTIVE</span><p>Connect workload, invariants, representation, and evidence.</p></div>;
  return <div className="score-card"><span>YOUR MASTERY</span><div>{[0, 1, 2, 3, 4].map((value) => <button className={value === score ? 'active' : ''} onClick={() => setScore(value)} key={value} aria-label={`Set mastery to ${value}`}>{value}</button>)}</div><p>{['Unseen', 'Can describe', 'Build with notes', 'Build and defend', 'Select and measure'][score]}</p></div>;
}

export default function Home() {
  const [selectedId, setSelectedId] = useState('shape-of-speed');
  const [scores, setScores] = useState<Scores>({});
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = allPages.find((page) => page.id === selectedId) ?? startPages[0];
  const mastered = chapters.filter((chapter) => (scores[chapter.id] ?? 0) >= 3).length;

  useEffect(() => {
    try { const saved = localStorage.getItem('market-structures-progress'); if (saved) setScores(JSON.parse(saved)); setDark(localStorage.getItem('market-structures-theme') === 'dark'); } catch { /* local state remains usable */ }
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  function navigate(id: string) { setSelectedId(id); setMobileOpen(false); setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function saveScore(value: number) { const next = { ...scores, [current.id]: value }; setScores(next); localStorage.setItem('market-structures-progress', JSON.stringify(next)); }
  function toggleTheme() { const next = !dark; setDark(next); localStorage.setItem('market-structures-theme', next ? 'dark' : 'light'); }
  const visiblePages = query.trim() ? allPages.filter((page) => page.title.toLowerCase().includes(query.toLowerCase()) || ('deck' in page && page.deck.toLowerCase().includes(query.toLowerCase()))) : allPages;

  return <div className={`book-shell ${dark ? 'dark' : ''}`}>
    <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen((value) => !value)} aria-label="Open chapters">☰</button><button className="wordmark" onClick={() => navigate('shape-of-speed')}><span className="mark">MS</span><span><strong>MARKET STRUCTURES</strong><small>DATA STRUCTURES FOR LOW LATENCY</small></span></button><label className="search-shell"><span>⌕</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search the book" placeholder="Search the book" /><kbd>⌘ K</kbd></label><div className="top-actions"><span className="progress-label"><b>{mastered}</b> / {chapters.length} mastered</span><button className="icon-button" onClick={toggleTheme} aria-label="Change color theme">◐</button></div></header>
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Book chapters"><nav>{groupOrder.map((group) => { const pages = visiblePages.filter((page) => page.group === group); if (!pages.length) return null; return <section className="chapter-group" key={group}><h2>{group}</h2><ol>{pages.map((page) => <li key={page.id}><button className={page.id === selectedId ? 'active' : ''} onClick={() => navigate(page.id)}><span>{page.number}</span>{page.shortTitle}{'tracked' in page && page.tracked && <b className={`sidebar-score score-${scores[page.id] ?? 0}`}>{scores[page.id] ?? 0}</b>}</button></li>)}</ol></section>; })}</nav></aside>
    <main className="article"><article>{current.id === 'shape-of-speed' ? <ShapeChapter /> : current.id === 'how-to-use' ? <ProgramPage scores={scores} navigate={navigate} /> : current.id === 'diagnostic' ? <DiagnosticPage navigate={navigate} /> : <LessonPage chapter={current as Chapter} />}</article></main>
    <aside className="toc" aria-label="Chapter status"><div className="toc-inner"><p>CURRENT MODULE</p><span className="toc-number">{current.number}</span><h2>{current.shortTitle}</h2>{'deck' in current && <p className="toc-deck">{current.deck}</p>}<ScoreControl page={current} score={scores[current.id] ?? 0} setScore={saveScore} /><div className="source-card"><span>STANDARD OF EVIDENCE</span><p>Contract → invariants → reference → randomized tests → measurement → defense.</p></div></div></aside>
  </div>;
}
