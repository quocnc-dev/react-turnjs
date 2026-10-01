# react-turnjs

React page-flip book component with a turn.js-compatible API. Pure React + CSS 3D — no jQuery. Lightweight, TypeScript-first, publish-ready for npm.

> Inspired by [blasten/turn.js](https://github.com/blasten/turn.js/) (3rd release, non-commercial BSD). This is a fresh implementation exposing the same mental model (1-indexed pages, `display`, `view`, `next`/`previous`, `turning`/`turned` events) — no turn.js source is bundled.

## Install

```bash
npm install react-turnjs
# or
yarn add react-turnjs
pnpm add react-turnjs
```

Requires `react >= 16.8` and `react-dom >= 16.8` (peer dependencies).

## Usage

```tsx
import { FlipBook, FlipBookPage } from 'react-turnjs';

export function App() {
    return (
        <FlipBook width={600} height={480} display="double" onTurned={(p) => console.log(p)}>
            <FlipBookPage hard>Cover</FlipBookPage>
            <FlipBookPage>Page 2</FlipBookPage>
            <FlipBookPage>Page 3</FlipBookPage>
            <FlipBookPage hard>Back cover</FlipBookPage>
        </FlipBook>
    );
}
```

With ref control (turn.js methods):

```tsx
import { useRef } from 'react';
import { FlipBook, type FlipBookRef } from 'react-turnjs';

const ref = useRef<FlipBookRef>(null);
// ref.current?.next()        // turn.js next()
// ref.current?.previous()    // turn.js previous()
// ref.current?.goTo(3)       // turn.js page(3) — 1-indexed
// ref.current?.getView()     // e.g. [2, 3]
// ref.current?.setDisplay('single')
```

## API

Pages are **1-indexed** like turn.js. In `double` mode the view is `[left, right]` where `0` means "no page" (cover edge): page 1 → `[0, 1]`, page 4 of 4 → `[4, 0]`.

### `<FlipBook />`

| Prop                        | Type                            | Default          | Description                                   |
| --------------------------- | ------------------------------- | ---------------- | --------------------------------------------- |
| `children`                  | `ReactNode`                     | —                | Book pages                                    |
| `width` / `height`          | `number \| string`              | `'100%'` / `480` | Book size (also via ref `setSize`)            |
| `display`                   | `'single' \| 'double'`          | `'double'`       | turn.js display mode                          |
| `page` / `defaultPage`      | `number`                        | — / `1`          | Controlled / uncontrolled page (1-indexed)    |
| `duration`                  | `number`                        | `600`            | Flip duration in ms (same default as turn.js) |
| `gradients`                 | `boolean`                       | `true`           | Shadow/gradient overlays during flip          |
| `acceleration`              | `boolean`                       | `true`           | Hardware-acceleration hint                    |
| `disabled`                  | `boolean`                       | `false`          | Disable all turning (turn.js `disable`)       |
| `autoCenter`                | `boolean`                       | `true`           | Center the book                               |
| `showNavigation`            | `boolean`                       | `true`           | Show Prev/Next UI (extension)                 |
| `clickable`                 | `boolean`                       | `true`           | Click left/right half to turn                 |
| `onStart`                   | `(page, view) => void \| false` | —                | Before flip; return `false` to cancel         |
| `onTurning`                 | `(page, view) => void`          | —                | turn.js `turning`                             |
| `onTurned` / `onPageChange` | `(page) => void`                | —                | turn.js `turned` (1-indexed)                  |
| `onFirst` / `onLast`        | `() => void`                    | —                | turn.js `first` / `last`                      |

### Ref (`FlipBookRef`) — turn.js methods

`next()`, `previous()` (+ `prev` alias), `goTo(page)`, `getPage()`, `getPageCount()`, `getView()`, `getDisplay()`, `setDisplay()`, `setSize()`, `setDisabled()`, `isAnimating()` (= `animating`), `stop()`, `hasPage()`, `getRange()` (= `range`).

Pure helpers are also exported: `viewForPage`, `nextPage`, `prevPage`, `pageRange`, `clampPage`.

### `<FlipBookPage />`

`children`, `className`, `style`, plus `hard` for stiff cover pages (turn.js `.hard`). Pages automatically get `.page`, `.pN`, `.odd`/`.even` classes.

## Differences from turn.js

- No jQuery, no manual DOM patching — declarative React rendering.
- Corner drag with a rigid page fold: grab a corner (100px zone, like turn.js `cornerSize`), the paper reflects across the fold line tracking your pointer, quick flick or 28%+ travel completes the turn, otherwise it snaps back.
- Buttons, keyboard, clicks and ref calls animate the same fold along a bezier to the far corner (`easeOutCirc`, same easing as turn.js). The `view`/`range`/paging math is ported 1:1.
- Events use props (`onTurning`) instead of `.bind()` / `when`.

## Demo

```bash
npm run demo   # Vite showcase at localhost, imports from 'react-turnjs'
```

The `example/` app is deployable to Vercel as-is — set the project **Root Directory** to `example`. See `example/README.md`.

## Development

```bash
npm install
npm test          # vitest run
npm run typecheck # tsc --noEmit
npm run build     # tsup -> dist/
npm run lint
npm run format
```

## Publish to npm

First publish is manual (package doesn't exist yet, so Trusted Publishing can't attach):

```bash
npm run build
npm publish --provenance --access public
```

Then attach Trusted Publisher at `npmjs.com/package/react-turnjs` → Settings (`quocnc-dev/react-turnjs`, workflow `publish.yml`). After that, just `git tag vX.Y.Z && git push origin vX.Y.Z` — the Action publishes with OIDC, no token needed.

## License

MIT
