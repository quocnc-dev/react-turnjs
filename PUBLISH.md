# Publishing `react-turnjs` to npm

Step-by-step guide. You only need to do the first publish manually — everything after that is automated via Trusted Publishing (no tokens).

## Prerequisites

- npm account with 2FA enabled (authenticator app, not passkey).
- Access to the GitHub repo `quocnc-dev/react-turnjs`.
- Node 24+ and npm 11+:
  ```bash
  node -v   # >= 24
  npm -v    # >= 11
  ```

## First publish (manual, one time only)

Trusted Publishing can only be attached to a package that already exists, so the very first version must be published from your machine.

```bash
cd react-turnjs
npm install
npm test
npm run typecheck
npm run build

# log in (use password + OTP from your authenticator app;
# if a passkey QR pops up, cancel it and choose password sign-in)
npm login
npm whoami   # should print your username

# publish
npm publish --provenance --access public

# verify
npm view react-turnjs version
```

## Attach Trusted Publishing (one time only)

1. Go to `https://www.npmjs.com/package/react-turnjs` → **Settings** → **Trusted Publishers**.
2. Add publisher:
   - Provider: **GitHub Actions**
   - Organization/user: `quocnc-dev`
   - Repository: `react-turnjs`
   - Workflow file: `publish.yml`
3. Done. The repo's `.github/workflows/publish.yml` already uses OIDC (`id-token: write`, no `NPM_TOKEN` needed).

## Every next release (automated)

```bash
# 1. pick a version bump
npm version patch   # 0.1.0 -> 0.1.1 (bug fixes)
# npm version minor # 0.1.0 -> 0.2.0 (new features)
# npm version major # 0.1.0 -> 1.0.0 (breaking changes)

# 2. push code + tag
git push origin main
git push origin v0.1.1   # use the version npm just set

# 3. GitHub Actions runs: install -> test -> build -> npm publish --provenance
# watch it under the repo's Actions tab
```

That's it. No `npm login`, no tokens, no OTP for these releases.

## Unpublish / fix a bad version (within 72h)

```bash
npm unpublish react-turnjs@0.1.1
# or deprecate instead (safer):
npm deprecate react-turnjs@0.1.1 "broken, use 0.1.2"
```

## Troubleshooting

| Error | Fix |
|---|---|
| `ENEEDAUTH` | You're not logged in: `npm login`, or token expired. |
| `404` on `npm view` | Package not published yet — do the first publish. |
| `E403 forbidden` | Name taken or no access; for a new package, pick another name. |
| Passkey QR stuck on login | Cancel it → sign in with password + authenticator OTP instead. |
| `There are security risks... use Trusted Publishing` | Don't tick "bypass 2FA" when creating tokens. For CI, use Trusted Publishing (this repo already does). |
| Action fails with `ENEEDAUTH` | Workflow filename on npmjs must match exactly (`publish.yml`), and runs must be on GitHub-hosted runners. |
| Wrong files published | Check `files` in `package.json` (`dist`, `README.md`, `LICENSE`) and run `npm run build` before publish. |
