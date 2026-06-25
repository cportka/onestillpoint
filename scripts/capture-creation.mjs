#!/usr/bin/env node
/**
 * Capture the "moment of creation" (the #osp-creation burst in index.html) as a
 * looping GIF for the README — re-runnable whenever the burst changes:
 *
 *     npm run capture:creation
 *
 * The burst is pure CSS keyframes (no canvas), so — unlike the splash — this is a
 * single deterministic pass per frame: fire `--go`, freeze every CSS animation at
 * `currentTime = T` (a small `--virtual-time-budget` lets the freeze apply), and
 * screenshot. ffmpeg then stitches a palette-optimised looping GIF.
 *
 * Needs a Chromium (or headless_shell) and ffmpeg. Set $CHROME to override the binary.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'assets', 'creation.gif');
const TMP = join(ROOT, '.creation-capture');
const FRAMES = 28; // frames sampled across the burst
const END_MS = 560; // capture window: ignition → fade-out (a short black tail for a clean loop)
const WIDTH = 400; // output width (px), matching splash.gif
const FPS = 25; // gif frame rate

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  // Prefer headless_shell (the full chrome binary's --headless can hang in a sandbox).
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
  console.error('capture-creation: no Chromium found. Set $CHROME to a chromium / headless_shell binary.');
  process.exit(1);
}
const headlessFlag = /headless_shell/.test(CHROME) ? [] : ['--headless=old'];

// Pull the #osp-creation markup out of the shared intro overlay (src/intro/overlay.html,
// the single source inlined into index.html) — anchored to the </div> after the last
// <i> child, so the inner .osp-lines <div> doesn't end the match early. The .osp-lines
// test pattern is never switched on here, so it stays invisible.
const html = readFileSync(join(ROOT, 'src/intro/overlay.html'), 'utf8');
const creation = html.match(/<div id="osp-creation"[\s\S]*?<\/i>\s*<\/div>/)[0];
const freeze = `<script>var T=Number(new URLSearchParams(location.search).get('t')||0);
requestAnimationFrame(function(){requestAnimationFrame(function(){
document.getElementById('osp-creation').classList.add('osp-creation--go');
document.getAnimations().forEach(function(a){try{a.currentTime=T;a.pause();}catch(e){}});});});</script>`;
const file = join(ROOT, '__cre_capture.html');
writeFileSync(
  file,
  `<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/src/intro/intro.css"></head>` +
    `<body style="margin:0;background:#05060a">${creation}${freeze}</body></html>`,
);

const PORT = 8133;
spawnSync('pkill', ['-f', `http.server ${PORT}`]); // free the port from any prior run
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const cleanup = () => {
  httpd.kill('SIGKILL');
  rmSync(file, { force: true });
};
process.on('exit', cleanup);
const base = `http://localhost:${PORT}`;
for (let tries = 0; ; tries++) {
  await new Promise((r) => setTimeout(r, 100));
  if (await fetch(`${base}/__cre_capture.html`).then((r) => r.ok).catch(() => false)) break;
  if (tries === 39) {
    console.error('capture-creation: server did not come up on', base);
    process.exit(1);
  }
}

const shot = (url, out) =>
  spawnSync(
    CHROME,
    [
      ...headlessFlag, '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      '--window-size=760,760', '--virtual-time-budget=120', `--screenshot=${out}`, url,
    ],
    { timeout: 30000, stdio: 'ignore' },
  );

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(join(ROOT, 'assets'), { recursive: true });

for (let i = 0; i < FRAMES; i++) {
  const T = Math.round((i / (FRAMES - 1)) * END_MS);
  const n = String(i).padStart(3, '0');
  const frame = join(TMP, `f_${n}.png`);
  shot(`${base}/__cre_capture.html?t=${T}`, frame);
  if (!existsSync(frame)) {
    console.error(`\ncapture-creation: missing frame ${n}`);
    process.exit(1);
  }
  process.stdout.write(`\rcapture-creation: frame ${i + 1}/${FRAMES} (t=${T}ms)`);
}
process.stdout.write('\n');
cleanup();

// Stitch → a palette-optimised looping GIF (square, centred on the burst).
const pal = join(TMP, 'pal.png');
const vf = `crop='min(iw,ih)':'min(iw,ih)',scale=${WIDTH}:-1:flags=lanczos`;
execSync(`ffmpeg -y -loglevel error -i "${join(TMP, 'f_%03d.png')}" -vf "${vf},palettegen=stats_mode=full" "${pal}"`);
execSync(
  `ffmpeg -y -loglevel error -framerate ${FPS} -i "${join(TMP, 'f_%03d.png')}" -i "${pal}" ` +
    `-lavfi "${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${OUT}"`,
);
rmSync(TMP, { recursive: true, force: true });
console.log(`capture-creation: wrote ${OUT} (${(statSync(OUT).size / 1e6).toFixed(2)} MB)`);
