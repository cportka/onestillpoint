/**
 * The "Share" button (top row, beside About + version). Shares the **previous ~5 seconds**
 * of the view as a short, square, looping video — preferring the OS share sheet, then the
 * clipboard, then a download:
 *   • share-capable (mobile + many desktops) → `navigator.share` with the clip + the text
 *     "onestillpoint.app"                                            → "Shared ✓"
 *   • else copy the clip to the clipboard (where the platform allows the type) → "Copied ✓"
 *   • else download it as a last resort                              → "Saved ✓"
 *
 * `capture` (from main.ts) returns the share-ready File: the rolling video clip when the
 * platform can record canvas video, otherwise a still PNG of the current frame.
 */
export function createShareButton(capture: () => Promise<File | null>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'osp-share-btn';
  button.textContent = 'Share';
  button.title = 'Share the last few seconds (or copy / save the clip)';

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

  // Copy a File to the clipboard, if the platform accepts its type there. Browsers only
  // allow a narrow set of clipboard types (video is rarely among them), so this returns
  // false when unsupported and the caller falls back to a download.
  const copyToClipboard = async (file: File): Promise<boolean> => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
    const C = ClipboardItem as unknown as { supports?: (t: string) => boolean };
    if (typeof C.supports === 'function' && !C.supports(file.type)) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
      return true;
    } catch {
      return false;
    }
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
          await navigator.share(shareData); // the OS share sheet (mobile + many desktops)
          flash('Shared ✓');
        } else if (await copyToClipboard(file)) {
          flash('Copied ✓'); // copied the clip to the clipboard
        } else {
          download(file); // last resort: save the clip
          flash('Saved ✓');
        }
      } catch {
        // Most often: the user dismissed the share sheet, or a permission was denied.
        reset();
      } finally {
        busy = false;
        button.classList.remove('is-busy');
      }
    })();
  });

  return button;
}
