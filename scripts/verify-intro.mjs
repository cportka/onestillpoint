#!/usr/bin/env node
/**
 * Headless visual integration test for the intro's new prelude beats — re-runnable
 * after any intro change:
 *
 *     npm run verify:intro
 *
 * It drives `#osp-creation` (the same markup index.html paints first) through each
 * beat in a headless Chromium and screenshots it, then asserts the pixels match what
 * the beat should look like — so a regression in the black hold, the test pattern, or
 * the creation burst fails CI rather than only being caught by eye:
 *
 *   • black    — the opaque creation layer, burst paused: the screen is ~pure black.
 *   • lines    — the .osp-lines test pattern on: full-width 40px white/black bands
 *                (mid-grey mean, with both near-white and near-black rows present).
 *   • creation — --go fired and CSS frozen mid-burst: noticeably brighter than black.
 *
 * It also writes a side-by-side contact sheet to .intro-verify/intro-beats.png.
 * Needs a Chromium (or headless_shell) and ffmpeg; set $CHROME to override the binary.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TMP = join(ROOT, '.intro-verify');

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
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
  console.error('verify-intro: no Chromium found. Set $CHROME to a chromium / headless_shell binary.');
  process.exit(1);
}
const headlessFlag = /headless_shell/.test(CHROME) ? [] : ['--headless=old'];

// Pull the #osp-creation markup (incl. the .osp-lines test pattern) out of index.html
// — anchored to the closing </div> after the last <i> child, so the inner lines <div>
// doesn't end the match early.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const creationMarkup = html.match(/<div id="osp-creation"[\s\S]*?<\/i>\s*<\/div>/)[0];
// A tiny freeze harness: set the classes for the requested beat on the first painted
// frame, then freeze any CSS animation so the screenshot is deterministic.
// Set the beat's classes on the first painted frame, then *freeze* every CSS
// animation at a fixed currentTime so the screenshot is deterministic — and so the
// black/lines beats hold the burst at frame 0 (invisible), exactly as the real page
// does during the black hold (where --go isn't set yet). A small virtual-time budget
// lets the freeze apply (same trick as capture-splash.mjs).
const harness = `<script>
var beat = new URLSearchParams(location.search).get('beat');
var cr = document.getElementById('osp-creation');
var lines = cr.querySelector('.osp-lines');
requestAnimationFrame(function(){ requestAnimationFrame(function(){
  var freezeAt = 0; // black + lines: burst held at frame 0 (opacity 0 → invisible)
  if (beat === 'lines') lines.classList.add('osp-lines--on');
  if (beat === 'creation') { cr.classList.add('osp-creation--go'); freezeAt = 110; } // mid-burst
  document.getAnimations().forEach(function(a){ try { a.currentTime = freezeAt; a.pause(); } catch(e){} });
}); });
</script>`;
const file = join(ROOT, '__intro_beats.html');
writeFileSync(
  file,
  `<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/src/style.css"></head>` +
    `<body style="margin:0;background:#000">${creationMarkup}${harness}</body></html>`,
);

const PORT = 8137;
spawnSync('pkill', ['-f', `http.server ${PORT}`]);
const httpd = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const cleanup = () => {
  httpd.kill('SIGKILL');
  rmSync(file, { force: true });
};
process.on('exit', cleanup);
const base = `http://localhost:${PORT}`;
for (let tries = 0; ; tries++) {
  await new Promise((r) => setTimeout(r, 100));
  if (await fetch(`${base}/__intro_beats.html`).then((r) => r.ok).catch(() => false)) break;
  if (tries === 39) {
    console.error('verify-intro: server did not come up on', base);
    process.exit(1);
  }
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const shot = (beat, out) =>
  spawnSync(
    CHROME,
    [
      ...headlessFlag, '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      '--window-size=480,480', '--virtual-time-budget=120', `--screenshot=${out}`, `${base}/__intro_beats.html?beat=${beat}`,
    ],
    { timeout: 30000, stdio: 'ignore' },
  );

// Average luma of the whole frame (scale to 1×1) and a small vertical sample column
// (to detect the alternating bands) — both via ffmpeg, no image-decode dependency.
const meanLuma = (png) =>
  spawnSync('ffmpeg', ['-i', png, '-vf', 'scale=1:1', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e7 })
    .stdout[0];
const sampleColumn = (png, h) => [
  ...spawnSync('ffmpeg', ['-i', png, '-vf', `scale=1:${h}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e7 })
    .stdout,
];

const beats = ['black', 'lines', 'creation'];
const png = Object.fromEntries(beats.map((b) => [b, join(TMP, `${b}.png`)]));
for (const b of beats) {
  shot(b, png[b]);
  if (!existsSync(png[b])) {
    console.error(`verify-intro: failed to screenshot the "${b}" beat`);
    process.exit(1);
  }
}

const black = meanLuma(png.black);
const lines = meanLuma(png.lines);
const linesCol = sampleColumn(png.lines, 12);
const creation = meanLuma(png.creation);

const checks = [
  ['black hold is ~pure black', black <= 12, `mean luma ${black}`],
  ['test pattern is ~half-bright', lines >= 70 && lines <= 185, `mean luma ${lines}`],
  ['test pattern has white+black bands', Math.max(...linesCol) >= 200 && Math.min(...linesCol) <= 55,
    `rows ${Math.min(...linesCol)}…${Math.max(...linesCol)}`],
  ['creation burst paints over black', creation > black + 8, `mean luma ${creation} vs black ${black}`],
];

console.log('verify-intro:');
let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
  if (!ok) failed = true;
}

// A labelled side-by-side contact sheet for the eye, too.
const sheet = join(TMP, 'intro-beats.png');
const lbl = (t) => `drawtext=text='${t}':x=8:y=8:fontcolor=yellow:fontsize=18:box=1:boxcolor=black@0.5`;
execSync(
  `ffmpeg -y -loglevel error -i "${png.black}" -i "${png.lines}" -i "${png.creation}" -filter_complex ` +
    `"[0:v]scale=240:240,${lbl('A · black')}[a];[1:v]scale=240:240,${lbl('B · test pattern')}[b];` +
    `[2:v]scale=240:240,${lbl('C · creation')}[c];[a][b][c]hstack=3" "${sheet}"`,
);
console.log(`  contact sheet → ${sheet}`);

cleanup();
process.exit(failed ? 1 : 0);
