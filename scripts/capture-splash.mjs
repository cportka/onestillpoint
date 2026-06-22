#!/usr/bin/env node
/**
 * Capture the load splash (the inline animation in index.html) as a looping GIF
 * for the README — re-runnable whenever the splash changes:
 *
 *     npm run capture:splash
 *
 * The splash is CSS keyframes + a <canvas> particle field. Headless Chromium
 * can't film it in real time, and a large `--virtual-time-budget` won't hold a
 * Web-Animations freeze of the (compositor) CSS animations. So we render each
 * frame in **two deterministic passes** and composite them:
 *
 *   • CSS pass   — freeze every CSS animation at `currentTime = T` (a small
 *                  virtual-time budget lets the freeze apply), canvas hidden,
 *                  transparent background.
 *   • canvas pass — advance the dust canvas to T with `--virtual-time-budget=T`,
 *                  CSS structure hidden, black background.
 *
 * ffmpeg overlays CSS-over-canvas per frame, then stitches assets/splash.gif.
 * Needs a Chromium and ffmpeg. Set $CHROME to override the binary.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'assets', 'splash.gif');
const TMP = join(ROOT, '.splash-capture');
const FRAMES = 36; // frames sampled across the splash
const END_MS = 1120; // capture window: the merger + settle
const WIDTH = 400; // output width (px)
const FPS = 25; // gif frame rate

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  // Prefer headless_shell (the old headless mode — reliable here; the full chrome
  // binary's --headless can hang in a sandbox), then fall back to a real Chrome.
  const shells = [];
  const chromes = [];
  try {
    for (const d of readdirSync('/opt/pw-browsers')) {
      shells.push(join('/opt/pw-browsers', d, 'chrome-linux', 'headless_shell'));
      chromes.push(join('/opt/pw-browsers', d, 'chrome-linux', 'chrome'));
    }
  } catch {
    /* not a playwright environment */
  }
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      chromes.push(execSync(`command -v ${bin}`).toString().trim());
    } catch {
      /* not on PATH */
    }
  }
  return [...shells, ...chromes].find((c) => c && existsSync(c));
}

const CHROME = findChrome();
if (!CHROME) {
  console.error('capture-splash: no Chromium found. Set $CHROME to a chromium / headless_shell binary.');
  process.exit(1);
}
const headlessFlag = /headless_shell/.test(CHROME) ? [] : ['--headless=old'];

// Pull the splash markup + its inline script out of the live index.html.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const div = html.match(/<div id="osp-splash"[\s\S]*?<\/div>\s*<\/div>/)[0];
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const freeze = `<script>var T=Number(new URLSearchParams(location.search).get('t')||0);
requestAnimationFrame(function(){requestAnimationFrame(function(){
document.getElementById('osp-splash').classList.add('osp-splash--go');
document.getAnimations().forEach(function(a){try{a.currentTime=T;a.pause();}catch(e){}});});});</script>`;
const page = (extraCss) =>
  `<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/src/style.css"><style>${extraCss}</style></head>` +
  `<body style="margin:0">${div}<script>${script}</script>${freeze}</body></html>`;
// Write the two harness pages into the repo root and serve it with python's
// static server (robust in this sandbox; the inline Node server hit IPv6 issues).
// They reference /src/style.css and are cleaned up at the end.
const cssFile = join(ROOT, '__cap_css.html');
const dustFile = join(ROOT, '__cap_dust.html');
writeFileSync(cssFile, page('#osp-splash{background:transparent!important}.osp-splash__dustcv{display:none!important}'));
writeFileSync(dustFile, page('body{background:#05060a}.osp-splash__stage{display:none!important}'));

const PORT = 8131;
spawnSync('pkill', ['-f', `http.server ${PORT}`]); // free the port from any prior run
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const cleanup = () => {
  httpd.kill('SIGKILL');
  rmSync(cssFile, { force: true });
  rmSync(dustFile, { force: true });
};
process.on('exit', cleanup);
const base = `http://localhost:${PORT}`;
// Wait for the server to actually answer before screenshotting.
for (let tries = 0; tries < 40; tries++) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const ok = await fetch(`${base}/__cap_css.html`).then((r) => r.ok).catch(() => false);
  if (ok) break;
  if (tries === 39) {
    console.error('capture-splash: server did not come up on', base);
    process.exit(1);
  }
}

const shot = (url, out, budget, transparent) =>
  spawnSync(
    CHROME,
    [
      ...headlessFlag, '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      ...(transparent ? ['--default-background-color=00000000'] : []),
      '--window-size=900,900', `--virtual-time-budget=${Math.max(budget, 1)}`, `--screenshot=${out}`, url,
    ],
    { timeout: 30000, stdio: 'ignore' },
  );

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(join(ROOT, 'assets'), { recursive: true });

for (let i = 0; i < FRAMES; i++) {
  const T = Math.round((i / (FRAMES - 1)) * END_MS);
  const n = String(i).padStart(3, '0');
  const css = join(TMP, `c_${n}.png`);
  const dust = join(TMP, `d_${n}.png`);
  shot(`${base}/__cap_css.html?t=${T}`, css, 120, true); // CSS frozen at T (small budget)
  shot(`${base}/__cap_dust.html?t=${T}`, dust, Math.max(T, 60), false); // canvas advanced to T
  if (!existsSync(css) || !existsSync(dust)) {
    console.error(`\ncapture-splash: missing frame ${n} (css=${existsSync(css)} dust=${existsSync(dust)})`);
    process.exit(1);
  }
  execSync(`ffmpeg -y -loglevel error -i "${dust}" -i "${css}" -filter_complex overlay "${join(TMP, `f_${n}.png`)}"`);
  process.stdout.write(`\rcapture-splash: frame ${i + 1}/${FRAMES} (t=${T}ms)`);
}
process.stdout.write('\n');
cleanup();

// Stitch → a palette-optimised looping GIF.
const pal = join(TMP, 'pal.png');
const vf = `scale=${WIDTH}:-1:flags=lanczos`;
execSync(`ffmpeg -y -loglevel error -i "${join(TMP, 'f_%03d.png')}" -vf "${vf},palettegen=stats_mode=full" "${pal}"`);
execSync(
  `ffmpeg -y -loglevel error -framerate ${FPS} -i "${join(TMP, 'f_%03d.png')}" -i "${pal}" ` +
    `-lavfi "${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${OUT}"`,
);
rmSync(TMP, { recursive: true, force: true });
console.log(`capture-splash: wrote ${OUT} (${(statSync(OUT).size / 1e6).toFixed(2)} MB)`);
