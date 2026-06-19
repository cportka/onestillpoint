import { isCoarsePointer } from '../core/device';

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;
const AUTO_HIDE_MS = 4000;

/**
 * Long-press tooltips for touch devices. Native `title` hovers never fire on
 * touch, so the help text on every control is invisible on phones. This watches
 * the panel for a long press on any row carrying a `title` and shows that text in
 * a floating popup (desktop hover keeps using the native `title`).
 */
export function attachTouchTooltips(root: HTMLElement): void {
  if (!isCoarsePointer()) return;

  const pop = document.createElement('div');
  pop.className = 'osp-tooltip';
  document.body.appendChild(pop);

  let timer = 0;
  let hideTimer = 0;
  let startX = 0;
  let startY = 0;

  const hide = (): void => {
    pop.classList.remove('is-visible');
    window.clearTimeout(hideTimer);
  };

  const show = (text: string, x: number, y: number): void => {
    pop.textContent = text;
    pop.classList.add('is-visible');
    // Measure, then clamp on-screen — above the finger, nudged in from the edges.
    const r = pop.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(x - r.width / 2, margin), window.innerWidth - r.width - margin);
    const top = Math.max(y - r.height - 16, margin);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, AUTO_HIDE_MS);
  };

  const cancel = (): void => window.clearTimeout(timer);

  root.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      hide(); // a fresh touch dismisses any open tooltip
      const touch = e.touches[0];
      if (!touch) return;
      const row = (e.target as HTMLElement | null)?.closest('[title]') as HTMLElement | null;
      const text = row?.getAttribute('title');
      if (!text) return;
      startX = touch.clientX;
      startY = touch.clientY;
      timer = window.setTimeout(() => show(text, startX, startY), LONG_PRESS_MS);
    },
    { passive: true },
  );

  root.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch && Math.hypot(touch.clientX - startX, touch.clientY - startY) > MOVE_CANCEL_PX) cancel();
    },
    { passive: true },
  );

  root.addEventListener('touchend', cancel, { passive: true });
  root.addEventListener('touchcancel', cancel, { passive: true });
}
