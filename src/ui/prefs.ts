/**
 * Persisted UI preferences (localStorage). Kept tiny and guarded so it never
 * throws in private-mode / non-browser contexts — a failed read or write just
 * falls back to the defaults.
 */
export interface Prefs {
  /** Show the Advanced-settings folders (Look / Animation / Bloom / Quality / …). */
  advanced: boolean;
  /** Tapping/clicking outside the expanded panel collapses it. */
  tapOutsideClose: boolean;
  /** Show the corner FPS / backend / resolution readout. */
  showFps: boolean;
}

// Bumped to .v2 when the defaults changed (tapOutsideClose now on, showFps added),
// so the new defaults take effect rather than being masked by a stored .v1 blob.
const KEY = 'osp.prefs.v2';
const DEFAULTS: Prefs = { advanced: false, tapOutsideClose: true, showFps: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}
