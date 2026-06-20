# Deployment

Korovany has two independent publish targets, both driven by GitHub Actions on
pushes to `main`.

## 1. The app → Cloudflare Pages

- Workflow: `.github/workflows/deploy.yml`
- Builds the SPA (`npm run build`) and deploys `./dist` to Cloudflare Pages
  (project `korovany`) via `cloudflare/wrangler-action`.
- Custom domain: **<https://korovany.aimost.pl/>** (also reachable at
  `https://korovany.pages.dev`).
- Requires the GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` — see [Cloudflare credentials](/operations/cloudflare-deploy).
  The deploy step skips gracefully until those exist, then activates
  automatically.

## 2. The docs → GitHub Pages

- Workflow: `.github/workflows/docs.yml`
- Builds this VitePress site (`npm run docs:build`) and deploys it to GitHub
  Pages at **<https://flopsstuff.github.io/korovany/>**.
- Pages is enabled by the workflow itself (`actions/configure-pages` with
  `enablement: true`); no manual dashboard step is required.

## Triggering a deploy

Both run on every push to `main`. The app workflow also supports manual
`workflow_dispatch` from the **Actions** tab once secrets are present.
