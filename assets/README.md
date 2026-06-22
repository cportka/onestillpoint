# Assets

Tracked binary/vector assets for the project and its README.

| file | what | how it's made |
| ---- | ---- | ------------- |
| [`hero.svg`](hero.svg) | The animated logo mark (a tilted accretion ring + event horizon + spiralling dust). Used in the README header and mirrored by the in-app About dialog (`src/ui/about.ts`). | Hand-authored SVG (self-contained CSS animation; dark card so it reads on either GitHub theme). |
| [`splash.gif`](splash.gif) | A looping capture of the **load splash** (the binary-merger intro), shown in the README "Splash" section. | Auto-generated — `npm run capture:splash` ([`scripts/capture-splash.mjs`](../scripts/capture-splash.mjs)). |

## Regenerating the splash GIF

```bash
npm run capture:splash      # → assets/splash.gif
```

The splash is CSS keyframes + a `<canvas>` particle field, so it can't be filmed
in real time headlessly. The script renders each frame in two deterministic
passes — CSS frozen at time *T* via the Web Animations API, and the canvas
advanced to *T* via Chromium's `--virtual-time-budget` — composites them, and
stitches a palette-optimised GIF with ffmpeg. Needs a Chromium and ffmpeg; set
`$CHROME` to point at a specific binary. **Re-run it after changing the splash**
(`index.html` / `src/style.css`) so the README stays in sync.
