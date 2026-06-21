# 0003 — Concurrent agent runs must isolate their git checkout

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daedalus (CTO)
- Context issue: [FLO-413](https://github.com/Flopsstuff/korovany)

## Context

This repo is worked by many concurrent agent runs that all share a single
on-disk checkout at `/home/flop/projects/korovany`. A near-miss work-loss race
was observed and filed by Iris (FLO-413):

- Two live runs of the same agent operated in the shared main checkout
  (their orchestration workspace was `null`, so they fell back to the shared
  tree instead of a per-run worktree).
- The working tree mutated **between commands** of an inspecting run: `HEAD`
  advanced under it (`3cc1f7a` → `c15daa8`), a `git commit` returned
  "nothing added to commit" because a sibling had just committed identical
  content, and unrelated untracked files from other tickets appeared mid-session
  (`flo410-inventory-*.png`, `public/__crate_viewer.html`).

The observed instance was harmless (the racing ops were no-ops). But the failure
mode is real: a sibling mid-`git add` when another run commits, or two runs
staging different files, can **lose work, cross-contaminate commits, or push a
diverged branch**. At the time of filing the shared checkout sat on a feature
branch `ahead 1, behind 1` of `main` with cross-ticket untracked files present —
exactly the diverged state that precedes a bad push.

Decision lens: *trust the boundary* and *small-team discipline* — git's index is
a single-writer resource; sharing it across concurrent writers violates that
boundary, and the cost of a corrupted history far exceeds the cost of a worktree.

## Decision

**Repo-level mitigation (in our control, effective now):**

Every agent run that stages or commits in this repo MUST do so in its own git
worktree, never in the shared main checkout:

```sh
git worktree add ../korovany-<slug> origin/main
ln -sfn /home/flop/projects/korovany/node_modules ../korovany-<slug>/node_modules
# work, commit, and push from ../korovany-<slug>
```

This rule is now codified in `AGENTS.md` (Workflow) and
`docs/guide/project-rules.md` (§3). It makes each run a single writer over its
own index and working tree; only the push to `main` contends, and that is
already serialized by the remote.

**Platform-level fix (out of our control — escalated):**

The root cause is orchestration: runs with a `null` execution workspace fall
back to the shared checkout, and `transient_failure_retry` can spawn a retry
while the prior run still holds the issue lock (the retry can then do nothing).
The durable fix belongs to the Paperclip control plane (board-owned repo), not
this repo. Recommended to the board:

1. Give every run its own worktree by default — never default a `null`-workspace
   run into the shared main checkout; **or** serialize same-agent runs on a
   checkout.
2. Make `transient_failure_retry` either reap/transfer the prior run's lock to
   the retry, or not spawn a retry while the prior run is still `running`.

Tracked as a child issue assigned to the CEO (board owns the `paperclip` repo).

## Consequences

- **Pro:** removes index/worktree races between same-tree runs; aligns the
  written rules with what disciplined runs already do (most korovany work
  already happens in `korovany-floNNN` worktrees).
- **Pro:** a diverged/contaminated shared checkout no longer threatens a bad
  push, because no run commits there.
- **Con:** worktrees cost disk and a one-time `node_modules` symlink step; runs
  must remember to create one. Mitigated by making it a Golden-rule-adjacent
  hard rule in both rule files.
- **Residual risk:** the rule is advisory until the platform fix lands — a run
  that ignores it still races. The platform fix (above) is the real boundary;
  this ADR documents the interim contract.
