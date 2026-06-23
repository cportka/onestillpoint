/**
 * The keyboard-shortcuts cheat-sheet, toggled with "?" (or "/"). Not a modal — a
 * small translucent panel pinned to the **top-left** (mirroring the control panel
 * top-right), at the same opacity as the dropdown. Tap it, or press ? / / / Esc,
 * to dismiss.
 */
const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['Esc', 'About dialog'],
  ['? /', 'This shortcuts list'],
  ['Space', 'Pause / Resume'],
  ['← →', 'Step back / forward'],
  ['↑ ↓', 'Speed ×2 / ÷2'],
  ['R', 'Replay intro'],
  ['C', 'Clear companions'],
  ['F', 'Toggle HUD'],
];

export interface ShortcutsOverlay {
  toggle: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createShortcutsOverlay(): ShortcutsOverlay {
  const panel = document.createElement('div');
  panel.className = 'osp-keys';
  panel.hidden = true;
  const rows = SHORTCUTS.map(
    ([keys, label]) =>
      `<div class="osp-keys__row"><span class="osp-keys__k">${keys
        .split(' ')
        .map((k) => `<kbd>${k}</kbd>`)
        .join(' ')}</span><span class="osp-keys__d">${label}</span></div>`,
  ).join('');
  panel.innerHTML = `<div class="osp-keys__title">Keyboard shortcuts</div>${rows}`;
  document.body.appendChild(panel);

  const close = (): void => {
    panel.hidden = true;
  };
  const toggle = (): void => {
    panel.hidden = !panel.hidden;
  };
  const isOpen = (): boolean => !panel.hidden;
  panel.addEventListener('click', close); // tap the panel to dismiss (touch)
  return { toggle, close, isOpen };
}
