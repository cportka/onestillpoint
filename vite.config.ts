import { defineConfig, type HmrContext, type ModuleNode, type Plugin } from 'vite';
// `node:fs` is typed by vite.node-shims.d.ts (in tsconfig `include`), not @types/node —
// see the note there: pulling in @types/node would shadow the DOM's timers in src.
import { readFileSync } from 'node:fs';

// The intro overlay (the "moment of creation" markup, the splash markup, and the
// inline boot script that sequences them) lives in one place — src/intro/overlay.html —
// and is inlined into every HTML entry that contains this marker. index.html ships it
// to production; intro-lab.html reuses the *exact same* overlay to preview/tune it. The
// script must paint before the module bundle, so it's a build-time inline (not a runtime
// fetch); keeping a single source means the lab can never drift from the real intro.
const OVERLAY_MARKER = '<!-- @osp-intro-overlay -->';
const overlayUrl = new URL('./src/intro/overlay.html', import.meta.url);

function introOverlay(): Plugin {
  return {
    name: 'osp-intro-overlay',
    // `pre` so the inlined markup/scripts go through Vite's normal HTML handling,
    // exactly as if they were authored in index.html (identical build output).
    transformIndexHtml: {
      order: 'pre',
      handler(html: string): string {
        if (!html.includes(OVERLAY_MARKER)) return html;
        return html.replace(OVERLAY_MARKER, readFileSync(overlayUrl, 'utf8'));
      },
    },
    // The partial isn't a normal HMR dependency of the HTML entries, so editing it
    // wouldn't reload anything — force a full reload (dev ergonomics for the lab).
    handleHotUpdate(ctx: HmrContext): ModuleNode[] | void {
      if (ctx.file.endsWith('/src/intro/overlay.html')) {
        ctx.server.hot.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

// One Still Point ships as a static site to GitHub Pages.
//
// base: '/' because we serve from the apex custom domain onestillpoint.app
// (which maps to the site root). A project-path base like '/onestillpoint/'
// would 404 every asset under the custom domain — only switch to that if the
// domain is ever dropped and the site is served from cportka.github.io/onestillpoint/.
// See the build plan §8 (Deploy).
//
// Only index.html is a build input (the default), so intro-lab.html serves in `npm run
// dev` for tuning but is never published — the live site stays just the app.
export default defineConfig({
  base: '/',
  plugins: [introOverlay()],
  build: {
    // The WebGPU/TSL stack and our bootstrap rely on modern output.
    target: 'esnext',
    sourcemap: true,
  },
});
