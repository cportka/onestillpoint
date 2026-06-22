/**
 * Global keyboard shortcuts, registered once from createControls (which owns the
 * actions they trigger):
 *
 *   Esc          toggle the About dialog
 *   Space        Pause / Resume
 *   ← / →        Step back / forward
 *   ↑ / ↓        double / halve the Speed
 *
 * Text entry is never hijacked. The playback keys also defer to a focused
 * button/slider (so they don't double-fire or fight a control the user is
 * operating) and act when focus is on the scene — Esc works from anywhere.
 */
export interface Keybindings {
  toggleAbout: () => void;
  togglePause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  /** Multiply the time scale (2 = double, 0.5 = halve). */
  speedBy: (factor: number) => void;
}

const isTextField = (el: Element | null): boolean =>
  !!el && ((el as HTMLElement).isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));

export function attachKeybindings(actions: Keybindings): void {
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return; // leave browser/OS shortcuts alone
    const el = document.activeElement;
    if (isTextField(el)) return; // never hijack typing

    // Esc toggles About from anywhere.
    if (e.key === 'Escape') {
      actions.toggleAbout();
      e.preventDefault();
      return;
    }

    // Playback keys: if a button/slider is focused, let it handle the key natively
    // (e.g. Space re-clicks a focused Pause exactly once) rather than double-acting.
    if (el && el.tagName === 'BUTTON') return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        actions.togglePause();
        break;
      case 'ArrowRight':
        actions.stepForward();
        break;
      case 'ArrowLeft':
        actions.stepBackward();
        break;
      case 'ArrowUp':
        actions.speedBy(2);
        break;
      case 'ArrowDown':
        actions.speedBy(0.5);
        break;
      default:
        return; // not ours — leave default behaviour intact
    }
    e.preventDefault();
  });
}
