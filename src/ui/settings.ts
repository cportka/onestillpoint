/**
 * The single persisted settings blob (localStorage). One profile, no logins, no
 * sessions: auto-loaded on start, auto-saved (debounced) on any change. Guarded so
 * it never throws in private-mode / non-browser contexts — a failed read or write
 * just falls back to in-memory defaults.
 *
 * Values are keyed by the control they belong to (see Controls.ts), so the whole
 * panel — Filter, Background, Speed, every Look / Animation / Bloom / Quality knob,
 * and the UI toggles — round-trips with no per-control wiring.
 */
const KEY = 'osp.settings.v1';

export type Settings = Record<string, unknown>;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Settings) : {};
  } catch {
    return {};
  }
}

let timer = 0;
/** Debounced write — dragging a slider fires changes rapidly, so coalesce them. */
export function saveSettings(settings: Settings): void {
  try {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {
        /* private mode / storage disabled — keep running from memory */
      }
    }, 150);
  } catch {
    /* no window/timers — ignore */
  }
}
