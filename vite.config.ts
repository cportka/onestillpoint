import { defineConfig, type HmrContext, type ModuleNode, type Plugin } from 'vite';
// `node:fs` is typed by vite.node-shims.d.ts (in tsconfig `include`), not @types/node —
// see the note there: pulling in @types/node would shadow the DOM's timers in src.
import { readFileSync } from 'node:fs';

// The intro overlay (the "moment of creation" markup, the splash markup, and the
// inline boot script that sequences them) lives in one place — src/intro/overlay.html —
// and is inlined into every HTML entry that contains this marker (index.html ships it to
// production). The script must paint before the module bundle, so it's a build-time
// inline (not a runtime fetch); keeping a single source keeps the markup unduplicated.
const OVERLAY_MARKER = '<!-- @osp-intro-overlay -->';
const overlayUrl = new URL('./src/intro/overlay.html', import.meta.url);

/**
 * Warm the heavy engine chunk during the splash. The bundle is deliberately loaded *late* — the
 * inline boot (`window.__ospBoot`, see index.html) only `import()`s it once the splash is up, so
 * the ~800 KB parse + WebGPU compile happen under cover instead of starving the prelude. That
 * deferral is right, but it also means the *download* doesn't start until the splash hands off —
 * a serial waterfall (entry → main → three) on a cold connection.
 *
 * A `rel="prefetch"` for the three.js vendor chunk closes that gap without disturbing the timing:
 * the browser fetches it at the *lowest* priority, filling the network's idle time while the
 * (GPU/CSS-driven) splash plays, and parks it in the HTTP cache. It is **not** `modulepreload` —
 * prefetch never compiles or executes the module, so it can't steal main-thread time from the
 * prelude (the hazard index.html guards against). When `__ospBoot` finally imports the engine,
 * the bytes are already local. The chunk filename is content-hashed, so resolve it from the
 * emitted bundle at build time. Dev (`serve`) has no bundle → the hook is a no-op there.
 */
function prefetchEngineChunk(): Plugin {
  let base = '/';
  return {
    name: 'osp-prefetch-engine',
    configResolved(config): void {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html; // dev server: nothing emitted to prefetch
        // The engine lives in the three.js vendor chunk; fall back to the largest chunk if the
        // naming ever changes, so we always prefetch the dominant payload.
        let engine: { fileName: string; code: string } | undefined;
        let largest: { fileName: string; code: string } | undefined;
        for (const output of Object.values(ctx.bundle)) {
          if (output.type !== 'chunk') continue;
          if (/three/i.test(output.fileName)) engine = output;
          if (!largest || output.code.length > largest.code.length) largest = output;
        }
        const target = engine ?? largest;
        if (!target) return html;
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: { rel: 'prefetch', href: base + target.fileName, as: 'script', crossorigin: '' },
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}

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
    // wouldn't reload anything — force a full reload (dev ergonomics).
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
// Only index.html is a build input (the default) — the live site is just the app.
export default defineConfig({
  base: '/',
  plugins: [introOverlay(), prefetchEngineChunk()],
  build: {
    // The WebGPU/TSL stack and our bootstrap rely on modern output.
    target: 'esnext',
    sourcemap: true,
  },
});
