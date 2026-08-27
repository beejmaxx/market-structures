# How to use this book

<p class="chapter-subtitle">Build the reasoning habit, not a collection of remembered answers.</p>

Each chapter follows the same loop.

1. **Specify the contract.** Write the operations and their observable
   behavior without naming a representation.
2. **State the workload.** Estimate operation ratios, maximum live elements,
   access distribution, mutation locality, and failure constraints.
3. **Predict.** Say which representation should win and why before measuring.
4. **Write invariants.** Make the valid states precise enough for a checker.
5. **Build a reference.** Use a boring trusted implementation as an oracle.
6. **Implement.** Write the smallest representation that satisfies the
   contract.
7. **Attack it.** Use boundary cases, randomized operation sequences,
   sanitizers, and stale-handle tests.
8. **Measure.** Keep setup and allocation outside the timed boundary unless
   they are deliberately part of the question.
9. **Defend.** Explain which workload change would reverse your choice.

## Mastery scale

| Score | What you can do |
|---:|---|
| 0 | You have not studied it. |
| 1 | You can describe the operations and representation. |
| 2 | You can build it with notes and repair simple bugs. |
| 3 | You can build it from a blank file and defend its invariants. |
| 4 | You can select, instrument, and measure it under a new workload. |

Do not advance because a chapter felt familiar. Advance when you can produce
the implementation and explanation without borrowing either one.

## Working with an AI tutor

Use an AI as an examiner and reviewer before using it as an implementer.

- Ask for one hint, adversarial tests, a code review, or an oral examination.
- Require yourself to predict the failure before running a generated test.
- Rewrite every invariant in your own words.
- If generated code enters a hot path, trace every mutation and explain every
  allocation, branch, and cache-sensitive access.
