<!--
  Korovany PR template. Docs are mandatory and not deferred — see AGENTS.md
  golden rule #2 and docs/guide/project-rules.md §5.
-->

## What & why

<!-- One or two sentences. Link the issue: e.g. Closes FLO-NNN. -->

## How verified

<!-- Tests added/updated, smoke run, rendered page/screenshot. -->

## Checklist

- [ ] `npm run lint && npm test && npm run build` pass locally
- [ ] Tests added/updated in the same change (Vitest, co-located)
- [ ] **Docs updated in this PR** — `docs/` and/or the relevant `README.md`.
      Tick the box that applies:
  - [ ] User-visible behaviour changed → updated guide/operations page + nav
  - [ ] New subsystem/folder → `docs/guide/` page + `src/game/README.md` entry
  - [ ] No user- or contributor-visible change → docs not required
- [ ] Single feature on this branch (no unrelated features mixed in)
- [ ] No secrets, credentials, or customer data in the diff
