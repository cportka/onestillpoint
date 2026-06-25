/**
 * A rolling video buffer of the last few seconds of the canvas — the source for the
 * Share button's clip. It continuously records the live view into a small ring buffer
 * so that, at any moment, "the previous ~5 seconds" is ready to share without the user
 * waiting for a capture.
 *
 * How it works:
 *   • A 720×720 offscreen canvas is the recording surface. Each render frame we blit the
 *     main canvas into it, centre-cropped to a square and scaled to 720p — so the clip is
 *     a clean square regardless of the viewport aspect (ideal for social / share sheets).
 *   • `MediaRecorder` records that canvas's `captureStream`, emitting a chunk every
 *     `TIMESLICE_MS`. We keep the first chunk forever (it carries the container's init
 *     segment / header) plus a rolling window of the most recent chunks; older ones are
 *     dropped. On `takeClip()` we flush the pending chunk and stitch header + window into
 *     one file, so the clip ends ~now and runs back ~`WINDOW_MS`.
 *   • Format: mp4 (H.264) where the platform can record it (Safari, recent Chromium),
 *     else WebM (VP9/VP8). Short clips like this auto-loop on most share targets.
 *
 * Returns `null` when the platform can't record canvas video (no `MediaRecorder` /
 * `captureStream` / 2D context) — the Share button then falls back to a still PNG.
 */
export interface ClipRecorder {
  /** Begin buffering. Call once the intro is done, to keep the heavy intro frames clear. */
  start: () => void;
  /** Blit the current frame into the square recording canvas. Call once per render frame
   *  (cheap — the blit is internally throttled to the capture rate). No-op until `start()`. */
  update: () => void;
  /** Stitch the buffered window into a share-ready square video File (mp4 or webm).
   *  Resolves `null` if nothing has buffered yet. */
  takeClip: () => Promise<File | null>;
  /** True once enough has buffered to be worth sharing as a clip (else use a still). */
  readonly ready: boolean;
  /** Stop recording and release the buffer. */
  dispose: () => void;
}

const SIZE = 720; // 720×720 square
const FPS = 30;
const WINDOW_MS = 5000; // ~5 seconds of footage
const TIMESLICE_MS = 500; // chunk granularity (→ the clip ends within ~½s of "now")
const BITRATE = 5_000_000; // ~5 Mbps — plenty for 720p square
// Hard cap on retained chunks — belt-and-suspenders so a muxer that doesn't honour the
// timeslice cadence can never grow the buffer without bound (the time window is primary).
const MAX_CHUNKS = Math.ceil(WINDOW_MS / TIMESLICE_MS) + 4;

/** The best recordable container for this platform, mp4 first (per the request). */
function pickMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1.4d0028', ext: 'mp4' }, // H.264 High, 720p
    { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

export function createClipRecorder(source: HTMLCanvasElement): ClipRecorder | null {
  const mime = pickMime();
  // Bail (→ PNG fallback) if the platform can't record canvas video.
  if (!mime || typeof source.captureStream !== 'function') return null;

  const square = document.createElement('canvas');
  square.width = SIZE;
  square.height = SIZE;
  const ctx = square.getContext('2d', { alpha: false });
  if (!ctx || typeof square.captureStream !== 'function') return null;
  ctx.fillStyle = '#05060a'; // the app's near-black, so a clip taken early isn't pure black
  ctx.fillRect(0, 0, SIZE, SIZE);

  const baseType = mime.mimeType.split(';')[0]!; // e.g. 'video/mp4' — the File's type
  let rec: MediaRecorder | null = null;
  let header: Blob | null = null; // first chunk = container init segment; always kept
  let tail: Array<{ t: number; data: Blob }> = []; // rolling window of recent chunks
  let started = false;
  let lastBlit = 0;

  const start = (): void => {
    if (started) return;
    started = true;
    const stream = square.captureStream(FPS);
    rec = new MediaRecorder(stream, { mimeType: mime.mimeType, videoBitsPerSecond: BITRATE });
    rec.ondataavailable = (e: BlobEvent): void => {
      if (!e.data || e.data.size === 0) return;
      const now = performance.now();
      if (!header) header = e.data; // the first chunk carries the header / init segment
      else tail.push({ t: now, data: e.data });
      // Drop chunks older than the window (a little slack so the kept span ≥ WINDOW_MS),
      // and hard-cap the count as a backstop.
      const cutoff = now - WINDOW_MS - TIMESLICE_MS;
      while (tail.length > 0 && tail[0]!.t < cutoff) tail.shift();
      while (tail.length > MAX_CHUNKS) tail.shift();
    };
    rec.start(TIMESLICE_MS);
  };

  const update = (): void => {
    if (!started) return;
    const now = performance.now();
    if (now - lastBlit < 1000 / FPS) return; // throttle the blit to the capture rate
    lastBlit = now;
    const sw = source.width;
    const sh = source.height;
    if (sw === 0 || sh === 0) return;
    const s = Math.min(sw, sh); // centre-crop the drawing buffer to a square, scaled to 720
    ctx.drawImage(source, (sw - s) / 2, (sh - s) / 2, s, s, 0, 0, SIZE, SIZE);
  };

  const takeClip = async (): Promise<File | null> => {
    if (!rec || !header) return null;
    rec.requestData(); // flush the in-progress chunk so the clip ends ~now
    await new Promise((r) => setTimeout(r, 80)); // let that dataavailable land
    if (!header) return null;
    const blob = new Blob([header, ...tail.map((c) => c.data)], { type: baseType });
    return new File([blob], `onestillpoint.${mime.ext}`, { type: baseType });
  };

  return {
    start,
    update,
    takeClip,
    get ready(): boolean {
      return started && header !== null && tail.length > 0;
    },
    dispose(): void {
      try {
        rec?.stop();
      } catch {
        /* already stopped */
      }
      rec = null;
      header = null;
      tail = [];
    },
  };
}
