# Project rules

These rules apply to every contributor — human or agent. They are intentionally
short and enforced by CI where possible. The canonical copy for automated
contributors lives in [`AGENTS.md`](https://github.com/Flopsstuff/korovany/blob/main/AGENTS.md).

## 1. Stack & language

- **TypeScript, `strict` mode.** No `any`; model real types. No `// @ts-ignore`
  without a one-line justification.
- **React** function components and hooks only — no class components.
- **Babylon.js** for all 3D/rendering; **Redux Toolkit** for shared state
  (slices under `src/store/`, typed `useAppSelector` / `useAppDispatch`).

## 2. House style

- 2-space indent, single quotes, no semicolons (match the existing files).
- Prefer named exports. Co-locate a unit by feature folder (see
  [Architecture](/guide/architecture)).

## 3. Branches, commits & main

- Branch per issue: `flo-<issue>-<slug>` (e.g. `flo-253-project-conventions`).
- `main` is always green and deployable — never push work that fails CI.
- Commit messages: imperative subject, reference the issue (`FLO-253`).

## 4. Testing is mandatory

- Every feature or bugfix ships with tests in the same change.
- Tests run on **Vitest**; co-locate as `*.test.ts` / `*.test.tsx` next to the
  code. CI runs `npm test` and must be green before merge.
- Babylon scenes needing WebGL are stubbed in tests (jsdom has no GPU).

## 5. Documentation is mandatory and lives with the code

- Docs live in `docs/` (this VitePress site) and are updated **in the same
  change** as the code — never deferred.
- `docs/` is published to **GitHub Pages** automatically on every push to `main`.

## 6. Binary assets via Git LFS

- All binary assets (models, textures, audio, video) are tracked with
  **Git LFS** — see `.gitattributes`. Run `git lfs install` once per machine.
- Source/raw assets go in `/assets`; assets imported by the bundler go in
  `src/assets/`.

## 7. Secrets

- Never commit secrets. Deploy credentials live in **GitHub Actions secrets**
  (see [Cloudflare credentials](/operations/cloudflare-deploy)).

## 8. Automated contributors

- `AGENTS.md` and `CLAUDE.md` at the repo root are authoritative for agents and
  must be kept in sync with these rules.
