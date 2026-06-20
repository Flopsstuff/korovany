# Korovany

3D action game / browser SPA.

**Stack:** TypeScript · React 19 · Babylon.js · Redux Toolkit · Vite. Deployed to
**Cloudflare Pages** via **GitHub Actions**.

## Local development

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into ./dist
npm run preview  # serve the production build locally
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the SPA and
deploys `./dist` to Cloudflare Pages (project `korovany`) using
[`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action).
Pull requests run the build as a CI signal but do **not** deploy.

### Required GitHub Actions secrets

The deploy step needs two repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret                  | What it is                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with the **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                                        |

These are stored as **GitHub Actions secrets**, not Paperclip project env vars,
because the deploy runs inside GitHub's runners and only GitHub secrets are
exposed there.

### One-time Cloudflare Pages project setup

The Pages project must exist before the first deploy. Create it once with Wrangler
(or in the Cloudflare dashboard → Workers & Pages → Create → Pages):

```bash
npx wrangler pages project create korovany --production-branch=main
```

See `docs/operations/cloudflare-deploy.md` for the full credential-provisioning
playbook.
