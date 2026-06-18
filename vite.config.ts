import { defineConfig } from 'vite';

// One Still Point ships as a static site to GitHub Pages.
//
// base: '/' because we serve from the apex custom domain onestillpoint.app
// (which maps to the site root). A project-path base like '/onestillpoint/'
// would 404 every asset under the custom domain — only switch to that if the
// domain is ever dropped and the site is served from cportka.github.io/onestillpoint/.
// See the build plan §8 (Deploy).
export default defineConfig({
  base: '/',
  build: {
    // The WebGPU/TSL stack and our bootstrap rely on modern output.
    target: 'esnext',
    sourcemap: true,
  },
});
