/**
 * The "Share" button (top row, beside About + version). Captures the current
 * view to a PNG in memory, then shares it the way the platform expects:
 *   • mobile / share-capable → the OS share sheet (navigator.share with the file);
 *   • otherwise → copy the image to the clipboard and flash a "copied ✓" on the
 *     button (with a download as a last resort if the clipboard is unavailable).
 *
 * `capture` renders + reads back the canvas (passed in from main.ts, which owns
 * the renderer).
 */
export function createShareButton(capture: () => Promise<Blob | null>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'osp-share-btn';
  button.textContent = 'Share';
  button.title = 'Share this view (or copy it to the clipboard)';

  let busy = false;
  const flash = (text: string): void => {
    button.classList.add('is-done');
    button.textContent = text;
    window.setTimeout(() => {
      button.classList.remove('is-done');
      button.textContent = 'Share';
    }, 1600);
  };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (busy) return;
    busy = true;
    button.classList.add('is-busy');
    void (async () => {
      try {
        const blob = await capture();
        if (!blob) {
          flash('failed');
          return;
        }
        const file = new File([blob], 'onestillpoint.png', { type: 'image/png' });
        const shareData = { files: [file], title: 'One Still Point', text: 'A black hole, from onestillpoint.app' };
        if (navigator.canShare?.(shareData) && navigator.share) {
          await navigator.share(shareData); // mobile: the OS share menu
          flash('shared ✓');
        } else if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          flash('copied ✓'); // desktop: copied to clipboard
        } else {
          const url = URL.createObjectURL(blob); // last resort: download
          const a = document.createElement('a');
          a.href = url;
          a.download = 'onestillpoint.png';
          a.click();
          URL.revokeObjectURL(url);
          flash('saved ✓');
        }
      } catch {
        // Most often: the user dismissed the share sheet, or clipboard was denied.
        button.classList.remove('is-done');
        button.textContent = 'Share';
      } finally {
        busy = false;
        button.classList.remove('is-busy');
      }
    })();
  });

  return button;
}
