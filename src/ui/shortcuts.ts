/**
 * The keyboard-shortcuts cheat-sheet, opened with "?". A small modal listing
 * every shortcut; it closes on its ×, a backdrop click, or Esc (the keybindings
 * module closes this first, before falling back to toggling About).
 */
const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['Esc', 'About dialog'],
  ['?', 'This shortcuts list'],
  ['Space', 'Pause / Resume'],
  ['← / →', 'Step back / forward'],
  ['↑ / ↓', 'Speed ×2 / ÷2'],
  ['R', 'Replay intro'],
  ['C', 'Clear companions'],
  ['F', 'Toggle FPS readout'],
];

export interface ShortcutsOverlay {
  toggle: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createShortcutsOverlay(): ShortcutsOverlay {
  const overlay = document.createElement('div');
  overlay.className = 'osp-keys';
  overlay.hidden = true;
  const rows = SHORTCUTS.map(
    ([keys, label]) =>
      `<div class="osp-keys__row"><span class="osp-keys__k">${keys
        .split(' / ')
        .map((k) => `<kbd>${k}</kbd>`)
        .join('<span class="osp-keys__sep">/</span>')}</span><span class="osp-keys__d">${label}</span></div>`,
  ).join('');
  overlay.innerHTML = `
    <div class="osp-keys__card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button class="osp-keys__close" type="button" aria-label="Close">×</button>
      <div class="osp-keys__title">Keyboard shortcuts</div>
      ${rows}
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    overlay.hidden = true;
  };
  const toggle = (): void => {
    overlay.hidden = !overlay.hidden;
  };
  const isOpen = (): boolean => !overlay.hidden;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.osp-keys__close')?.addEventListener('click', close);
  return { toggle, close, isOpen };
}
