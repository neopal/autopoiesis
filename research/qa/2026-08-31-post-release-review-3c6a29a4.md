---
type: post-release-review-reconciliation
commit: 3c6a29a4f81fa1c9e8e0c954dcde95d2f6ed51bc
repository: C:/Users/ASUS/autopoiesis
status: review-invalidated-by-exact-commit-test
date: 2026-08-31
---

# Post-release review reconciliation — `3c6a29a4`

## Review result received

The delegated review `deleg_db824e34` reported `passed: true`, with no security or logic issues, and suggested adding runtime coverage for reduced motion, resize behavior, and scar-causality deletion tests.

## Exact commit verification

The commit exists locally, is reachable from both `main` and `origin/main`, and is not the current `HEAD` (`HEAD` is `11354da`). A clean archive of the exact commit was extracted to a temporary directory and tested with:

```text
npm run test
```

Actual result:

```text
12 tests
11 passed
1 failed
0 skipped
0 todo
exit_code: 1
```

The failing test was:

```text
the opening field reserves the title label zone rather than letting generated marks cross it
```

The assertion expected the exact commit's `galerie/field.js` to read `.title` geometry with `getBoundingClientRect()` and to use `ctx.clip('evenodd')`. Those operations are absent from the `field.js` tree at `3c6a29a4`, so the commit does not pass its own archived test suite when executed from a clean tree.

## Decision

The delegated `passed: true` is not accepted as a verified approval for this exact commit. No security conclusion beyond the delegated review's stated empty list is promoted to a repository claim, and no deployment claim is made from this result.

The current worktree is a later state and was separately verified with `npm run test` at `32/32`; that later result must not be retroactively attributed to commit `3c6a29a4`.

No code, commit, push, or deployment was performed while reconciling this review.
