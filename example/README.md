# react-turnjs demo

Showcase app for `react-turnjs`. Imports the library exactly like a real user (`from 'react-turnjs'`) — Vite aliases it to `../src` in dev, so no build step needed while iterating.

## Run locally

```bash
cd example
npm install
npm run dev    # open the printed localhost URL
```

## Deploy to Vercel

1. Vercel → Add New → Project → import `quocnc-dev/react-turnjs`.
2. Set **Root Directory** to `example` (important — the Vite app lives here, not at repo root).
3. Framework Preset: Vite (auto-detected). Build command `npm run build`, output `dist`.
4. Deploy. Every push to `main` redeploys automatically.

## Testing the published package

This demo uses the source alias, so it does **not** verify the packed tarball. Before releasing, test the real artifact in a scratch app:

```bash
# in repo root:
npm run build && npm pack   # -> react-turnjs-x.y.z.tgz
# in a scratch Vite app:
npm install /path/to/react-turnjs-x.y.z.tgz
```
