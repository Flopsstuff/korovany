# 0001 — Hosting for generated binary 3D assets

- Status: Accepted
- Date: 2026-06-20
- Deciders: Daedalus (CTO)
- Context issue: [FLO-257](https://github.com/Fl0p/korovany) (from FLO-256, the Meshy pipeline)

## Context

The `meshy-3d` skill (`tools/meshy-3d/`) generates web-ready GLB models for the
game. A preview (untextured) GLB is ~1 MB; textured/refined models are larger.
These binaries need a home that:

- keeps the deploy story trivial (one repo → Cloudflare Pages, no second service);
- versions assets alongside the code that references them;
- does not bloat the git object store so every future clone pays for old revisions;
- survives without per-asset signed-URL bookkeeping.

The FLO-253 scaffold already wired a comprehensive `.gitattributes` routing
`*.glb`, textures, audio, and fonts through **Git LFS**. This ADR ratifies or
overrides that default.

## Options considered

1. **Commit binaries directly to the git object store.** Simplest, but every
   revision of every asset lives in history forever — clone size grows without
   bound. Rejected (violates "schema/history is forever").
2. **Git LFS** (the scaffold default). Binaries are stored as LFS pointers in git
   and fetched from LFS on checkout. History stays lean; assets are still
   versioned with the code; one repo, one deploy. Cost: contributors run
   `git lfs install` once, CI checkout must pull LFS, and GitHub's free LFS tier
   is 1 GiB storage + 1 GiB/mo bandwidth.
3. **External object store / CDN (Cloudflare R2) + a manifest.** No git bloat,
   scales to large libraries. Cost: a second system to provision and authenticate,
   a manifest to keep in sync, and assets decoupled from the commit that needs
   them. Premature for the MVP.

## Decision

**Ratify Git LFS (option 2)** as the home for binary game assets for the MVP and
early game phase. Web-ready GLBs live in **`public/models/`**, tracked by LFS.

- `public/` is copied verbatim into the Vite build, so a model at
  `public/models/chest.glb` is served by Cloudflare's CDN at `/models/chest.glb`
  and loaded at runtime by the Babylon loader (see ADR 0002). End-user download
  bandwidth is served by Cloudflare, **not** GitHub LFS — LFS bandwidth is only
  spent on CI checkouts (one per deploy).
- The `meshy-3d` skill writes to a scratch dir (`tools/meshy-3d/out/`, gitignored).
  Workflow: generate → review poly count / size / textures against budget → move
  the approved GLB into `public/models/` (LFS picks it up via `.gitattributes`).

## Consequences

- **CI must pull LFS.** `actions/checkout` defaults to pointer files only; the
  deploy workflow's checkout now sets `lfs: true`, otherwise the build would ship
  broken pointer files. (Fixed in this change.)
- **Contributors run `git lfs install` once** before cloning; documented in the
  README. Cloudflare Pages, when it builds directly from the repo, also needs LFS
  enabled — but our deploy builds in GitHub Actions and uploads `dist`, so this is
  covered by the CI checkout fix.
- **Asset budget guardrail.** Keep committed GLBs web-optimized: prefer Meshy's
  remeshed output, target ≤ ~2–3 MB per model, and use Draco/meshopt geometry
  compression + KTX2 textures when we add textured assets.
- **Migration trigger (escape hatch).** Move to Cloudflare R2 + a manifest when
  total LFS storage approaches the free 1 GiB tier, or when we accumulate many
  large textured variants. This is reversible: the loader takes a URL, so swapping
  `/models/x.glb` for an R2 URL is a config change, not a rewrite.
