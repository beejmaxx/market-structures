# Market Structures

An mdBook guide to data structures, low-latency systems, and the HFT
experiments in this workspace. It uses the same guidebook format as the books
under `~/code/books`.

Public edition: https://beejmaxx.github.io/market-structures/

The complete eighteen-module program covers core structures, memory hierarchy,
allocation, layout, concurrency, benchmarking, order-book representations,
C++/Rust engineering, and a defended capstone. Chapters include interactive
diagrams, blank-file builds, invariants, adversarial tests, and measurement
plans.

Run the local edition:

```sh
mdbook serve --open
```

Build the static GitHub Pages edition:

```sh
mdbook build
```

The `main` branch deploys through GitHub Actions.

The longer authoring curriculum and assessment bank live in the adjacent
`../data-structures` directory.
