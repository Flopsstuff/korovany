# Playbook: Provision Cloudflare Pages deploy credentials

This is a one-time, human-only setup. It produces the two secrets the GitHub
Actions deploy workflow (`.github/workflows/deploy.yml`) needs to publish the
`korovany` SPA to Cloudflare Pages.

Owner: **Fl0p** (account holder). Daedalus cannot perform this — it requires
logging into the Cloudflare dashboard with the account owner's credentials.

## What you will produce

1. `CLOUDFLARE_API_TOKEN` — a scoped API token.
2. `CLOUDFLARE_ACCOUNT_ID` — your account identifier.

Both are stored as **GitHub Actions repository secrets** on `Fl0p/korovany`.

> **Why GitHub secrets and not Paperclip project env vars:** the deploy runs on
> GitHub's hosted runners. Only GitHub Actions secrets are injected there;
> Paperclip project env vars never reach the runner. So these must live in GitHub.

## Step 1 — Get your Cloudflare Account ID

1. Log in to <https://dash.cloudflare.com>.
2. Go to **Workers & Pages**.
3. On the right sidebar, copy the **Account ID**.
   (Alternatively it is the hex string in the dashboard URL:
   `dash.cloudflare.com/<ACCOUNT_ID>`.)

## Step 2 — Create a scoped API token

1. Go to <https://dash.cloudflare.com/profile/api-tokens>.
2. **Create Token** → **Create Custom Token** (Get started).
3. Name: `korovany-pages-deploy`.
4. Permissions: add **Account → Cloudflare Pages → Edit**.
5. Account Resources: **Include → your account**.
6. (Optional) TTL / IP filtering as you prefer.
7. **Continue to summary → Create Token**.
8. Copy the token value now — it is shown only once.

## Step 3 — Create the Pages project (one time)

The project must exist before the first deploy. Easiest from your machine:

```bash
export CLOUDFLARE_API_TOKEN=<the token from step 2>
export CLOUDFLARE_ACCOUNT_ID=<the id from step 1>
npx wrangler pages project create korovany --production-branch=main
```

Or in the dashboard: **Workers & Pages → Create → Pages → Connect direct upload**,
name it `korovany`. (We deploy via Wrangler, so you do **not** need to connect a
Git repo in the Cloudflare UI.)

## Step 4 — Store the secrets in GitHub

Either via the CLI (from inside the repo):

```bash
gh secret set CLOUDFLARE_API_TOKEN   --repo Fl0p/korovany   # paste token when prompted
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo Fl0p/korovany   # paste account id when prompted
```

Or in the UI: **Settings → Secrets and variables → Actions → New repository secret**,
adding `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Step 5 — Trigger the first deploy

Once the secrets exist, merging the scaffold PR to `main` (or any subsequent push
to `main`) runs the deploy and publishes to
`https://korovany.pages.dev`.

## Verifying

- GitHub → **Actions** tab → latest **Deploy** run is green.
- The "Deploy to Cloudflare Pages" step logs the deployment URL.
- Visit `https://korovany.pages.dev` and confirm the hello-world page renders.

## Security notes

- The token grants only **Pages: Edit** — least privilege for this job.
- Never commit the token. It lives only in GitHub Actions secrets.
- Rotate by creating a new token and re-running `gh secret set`; revoke the old
  one in the Cloudflare dashboard.
