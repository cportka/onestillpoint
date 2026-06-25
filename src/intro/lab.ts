/**
 * The intro lab — a dev-only tuning playground for the load intro.
 *
 *   npm run dev  →  http://localhost:5173/intro-lab.html
 *
 * intro-lab.html inlines the *exact same* overlay the site ships (src/intro/overlay.html,
 * via the introOverlay() plugin in vite.config.ts), so what you see here is the real
 * intro — just looping, with the engine stubbed out. This module builds a control panel
 * of sliders bound live to `window.__ospDials`, loops `window.__ospIntro()` so every
 * tweak is visible within a cycle, and prints a copy-paste snippet to drop the values
 * back into overlay.html + introTimeline.ts. It is never part of the production build
 * (intro-lab.html isn't a Vite input), but it is typechecked/linted with the rest of src.
 */
import { INTRO_DIALS } from './introTimeline';

type DialKey = keyof typeof INTRO_DIALS;

declare global {
  interface Window {
    /** The live intro dials, defined by the inline overlay script (overlay.html). */
    __ospDials?: Record<DialKey, number>;
    /** Plays the whole intro from the top — re-run each loop. (Also declared in main.ts.) */
    __ospIntro?: () => void;
  }
}

/** Per-dial UI metadata. Rows render in `INTRO_DIALS` order (the canonical dial order,
 *  which is also the order the copy-paste snippet emits). */
interface DialMeta {
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}

const META: Record<DialKey, DialMeta> = {
  initialBlackMs: { label: 'Opening black', min: 0, max: 2000, step: 10, unit: 'ms',
    hint: '(a) how long the screen holds pure black before the test pattern' },
  splitBlackMs: { label: 'Split black', min: 0, max: 400, step: 5, unit: 'ms',
    hint: '(b) the deliberate sliver of black after the test pattern' },
  creationSpeed: { label: 'Creation speed', min: 0.25, max: 4, step: 0.05, unit: '×',
    hint: '(c) stretch / compress the moment-of-creation burst (1 = as authored)' },
  splashSpeed: { label: 'Splash speed', min: 0.25, max: 4, step: 0.05, unit: '×',
    hint: '(d) stretch / compress the splash animation (1 = as authored)' },
  creationBeatMs: { label: 'Creation beat', min: 0, max: 1200, step: 10, unit: 'ms',
    hint: 'how long the creation plays as its own beat before the splash' },
  creationToSplashMs: { label: 'Creation → splash overlap', min: -400, max: 400, step: 5, unit: 'ms',
    hint: '(e) splash start vs the creation fade — negative = overlap (no black gap)' },
  creationFadeMs: { label: 'Creation fade', min: 0, max: 800, step: 10, unit: 'ms',
    hint: '(e) how fast the creation crossfades into the splash' },
  splashHoldMs: { label: 'Splash hold', min: 0, max: 3000, step: 50, unit: 'ms',
    hint: '(f) how long the splash holds before the engine is revealed (read by main.ts)' },
  splashFadeMs: { label: 'Splash fade', min: 0, max: 1500, step: 10, unit: 'ms',
    hint: '(f) how fast the splash crossfades into the engine' },
};

const KEYS = Object.keys(INTRO_DIALS) as DialKey[];

/** With no engine on the lab page, nothing dismisses the splash — so it holds fully
 *  formed until we loop. This is the extra time we let the splash play + linger (past
 *  the black + creation beats) before restarting, so each loop shows the whole arc. */
const ADMIRE_MS = 2600;

function dials(): Record<DialKey, number> {
  return window.__ospDials ?? ({ ...INTRO_DIALS } as Record<DialKey, number>);
}

/** Loop period: the black + split + creation beats, plus the splash play/linger tail. */
function periodMs(): number {
  const d = dials();
  return d.initialBlackMs + d.splitBlackMs + d.creationBeatMs + ADMIRE_MS;
}

let loopOn = true;
let loopTimer = 0;
let restartTimer = 0;

function scheduleNext(): void {
  window.clearTimeout(loopTimer);
  if (loopOn) loopTimer = window.setTimeout(runCycle, periodMs());
}

function runCycle(): void {
  window.__ospIntro?.();
  scheduleNext();
}

/** Restart the loop now (debounced) so a tweak previews almost immediately. */
function restartSoon(): void {
  window.clearTimeout(restartTimer);
  restartTimer = window.setTimeout(runCycle, 350);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/** The live "paste me back into the source" snippet (INTRO_DIALS / overlay order). */
function snippet(): string {
  const d = dials();
  return KEYS.map((k) => `${k}: ${d[k]},`).join('\n');
}

function build(): void {
  const d = dials();

  const panel = el('aside', { id: 'osp-lab' });
  panel.appendChild(el('h1', {}, 'Intro lab'));
  panel.appendChild(
    el('p', { class: 'osp-lab__sub' }, 'Tune the load intro — it loops behind this panel. The same overlay ships in the app.'),
  );

  // Transport: loop toggle + replay.
  const transport = el('div', { class: 'osp-lab__row osp-lab__transport' });
  const loop = el('label', { class: 'osp-lab__toggle' });
  const loopBox = el('input', { type: 'checkbox' }) as HTMLInputElement;
  loopBox.checked = loopOn;
  loopBox.addEventListener('change', () => {
    loopOn = loopBox.checked;
    if (loopOn) runCycle();
    else window.clearTimeout(loopTimer);
  });
  loop.appendChild(loopBox);
  loop.appendChild(el('span', {}, 'Loop'));
  const replay = el('button', { type: 'button', class: 'osp-lab__btn' }, 'Replay now') as HTMLButtonElement;
  replay.addEventListener('click', runCycle);
  transport.appendChild(loop);
  transport.appendChild(replay);
  panel.appendChild(transport);

  // One row per dial: a slider + a number box, kept in sync, bound to window.__ospDials.
  const numbers = new Map<DialKey, HTMLInputElement>();
  const ranges = new Map<DialKey, HTMLInputElement>();
  for (const key of KEYS) {
    const meta = META[key];
    const row = el('div', { class: 'osp-lab__dial' });
    const head = el('div', { class: 'osp-lab__dialhead' });
    head.appendChild(el('label', {}, meta.label));
    const num = el('input', {
      type: 'number', min: String(meta.min), max: String(meta.max), step: String(meta.step),
    }) as HTMLInputElement;
    num.value = String(d[key]);
    const unit = el('span', { class: 'osp-lab__unit' }, meta.unit);
    head.appendChild(num);
    head.appendChild(unit);
    row.appendChild(head);
    const range = el('input', {
      type: 'range', min: String(meta.min), max: String(meta.max), step: String(meta.step),
    }) as HTMLInputElement;
    range.value = String(d[key]);
    row.appendChild(range);
    row.appendChild(el('p', { class: 'osp-lab__hint' }, meta.hint));
    panel.appendChild(row);
    numbers.set(key, num);
    ranges.set(key, range);

    const apply = (raw: string): void => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      const store = window.__ospDials;
      if (store) store[key] = value;
      num.value = String(value);
      range.value = String(value);
      updateSnippet();
      restartSoon();
    };
    range.addEventListener('input', () => apply(range.value));
    num.addEventListener('input', () => apply(num.value));
  }

  // Reset + the copy-paste snippet.
  const tools = el('div', { class: 'osp-lab__row' });
  const reset = el('button', { type: 'button', class: 'osp-lab__btn' }, 'Reset defaults') as HTMLButtonElement;
  reset.addEventListener('click', () => {
    const store = window.__ospDials;
    for (const key of KEYS) {
      const value = INTRO_DIALS[key];
      if (store) store[key] = value;
      numbers.get(key)!.value = String(value);
      ranges.get(key)!.value = String(value);
    }
    updateSnippet();
    runCycle();
  });
  const copy = el('button', { type: 'button', class: 'osp-lab__btn' }, 'Copy values') as HTMLButtonElement;
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(snippet()).then(
      () => flash(copy, 'Copied!'),
      () => flash(copy, 'Copy failed'),
    );
  });
  tools.appendChild(reset);
  tools.appendChild(copy);
  panel.appendChild(tools);

  panel.appendChild(el('p', { class: 'osp-lab__sub' }, 'Paste into src/intro/overlay.html (window.__ospDials) and src/intro/introTimeline.ts (INTRO_DIALS):'));
  const out = el('pre', { class: 'osp-lab__snippet', id: 'osp-lab-snippet' }, snippet());
  panel.appendChild(out);

  function updateSnippet(): void {
    out.textContent = snippet();
  }

  document.body.appendChild(panel);
}

function flash(button: HTMLButtonElement, text: string): void {
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1100);
}

build();
// The overlay auto-played one intro on load; pick up the loop from there.
scheduleNext();
