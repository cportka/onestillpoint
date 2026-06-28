/**
 * The "Share" button (top row, beside About + version). Shares the **previous ~5 seconds**
 * of the view as a short, square, looping **mp4** — preferring the OS share sheet, then a
 * download:
 *   • share-capable (mobile + Safari) → `navigator.share` with the clip + the text
 *     "onestillpoint.app"                                  → "Shared ✓"
 *   • else (e.g. desktop Chromium, which has no native file share) → download the clip,
 *     so you get the actual animation as a file                → "Saved ✓"
 *
 * The clipboard isn't a fallback: browsers can't put a video on the system clipboard (only
 * a narrow set of types, never mp4/webm), so a download is the honest way to hand over the
 * animation when the share sheet isn't available.
 *
 * `capture` (from main.ts) returns the share-ready File: the rolling mp4 clip where the
 * platform can encode H.264; otherwise a short clip recorded live off the canvas (mp4 or WebM,
 * via MediaRecorder); and only if even that can't record, a still PNG of the current frame.
 */
export function createShareButton(capture: () => Promise<File | null>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'osp-share-btn';
  button.textContent = 'Share';
  button.title = 'Share the last few seconds (or save the clip)';

  let busy = false;
  const reset = (): void => {
    button.classList.remove('is-done');
    button.textContent = 'Share';
  };
  // The confirmation stays on one line (see .osp-share-btn { white-space: nowrap }).
  const flash = (text: string): void => {
    button.classList.add('is-done');
    button.textContent = text;
    window.setTimeout(reset, 1600);
  };

  const download = (file: File): void => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (busy) return;
    busy = true;
    button.classList.add('is-busy');
    void (async () => {
      try {
        const file = await capture();
        if (!file) {
          flash('Failed');
          return;
        }
        const shareData = { files: [file], text: 'onestillpoint.app' };
        if (navigator.canShare?.(shareData) && navigator.share) {
          try {
            await navigator.share(shareData); // the OS share sheet (mobile + Safari)
            flash('Shared ✓');
          } catch (err) {
            // The user dismissing the sheet aborts — leave it be. Any other failure
            // (e.g. the gesture expired) falls back to a download so the clip isn't lost.
            if (err instanceof DOMException && err.name === 'AbortError') reset();
            else {
              download(file);
              flash('Saved ✓');
            }
          }
        } else {
          download(file); // desktop without native file share → save the animation
          flash('Saved ✓');
        }
      } catch {
        reset();
      } finally {
        busy = false;
        button.classList.remove('is-busy');
      }
    })();
  });

  return button;
}
