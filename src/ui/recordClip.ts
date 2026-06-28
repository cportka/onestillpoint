/**
 * On-demand fallback capture for the Share button.
 *
 * The primary share clip is a rolling WebCodecs **mp4** (see `clipRecorder.ts`). That path needs an
 * H.264/AV1 *encoder* **and** that encoder to emit the `avcC` decoder config — and on many real
 * browsers neither holds (no H.264 encoder at all, or a hardware H.264 encoder that omits `avcC`),
 * so the rolling clip never becomes ready and Share silently falls back to a **still PNG**.
 *
 * This is the animation-preserving floor under that fallback: record a short clip straight off the
 * canvas with **`MediaRecorder` + `canvas.captureStream()`**. It sidesteps both failure modes —
 * `captureStream` pulls frames from the compositor (no fragile per-frame `drawImage` read of the
 * WebGPU canvas) and `MediaRecorder` muxes the container itself (no `avcC` dependency). It yields an
 * animated **mp4** where the browser's `MediaRecorder` supports H.264 (Safari / iOS, modern Chrome),
 * otherwise an animated **WebM** — either way an animation, never a still.
 *
 * It records ~the next few seconds on demand (rather than the rolling "last 5 s"), so it only runs as
 * a fallback when the rolling mp4 isn't available.
 */

/** Container/codec preferences, best first. mp4/H.264 leads (macOS + iOS preview / AirDrop friendly);
 *  then WebM (VP9 → VP8). The codec is named explicitly so `isTypeSupported` answers honestly — a bare
 *  `video/mp4` reports supported on some Chromium builds that then record nothing (no H.264 behind it). */
export const CLIP_MIME_PREFS = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

const defaultIsSupported = (m: string): boolean =>
  typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m);

/** The best-supported clip MIME for this browser, or `null` if none record (→ stay on a still PNG).
 *  `isSupported` is injectable for tests. */
export function bestClipMime(isSupported: (m: string) => boolean = defaultIsSupported): string | null {
  for (const m of CLIP_MIME_PREFS) if (isSupported(m)) return m;
  return null;
}

/** Whether this canvas can be recorded on demand (MediaRecorder + captureStream + a usable MIME). */
export function canRecordCanvas(canvas: HTMLCanvasElement): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof canvas.captureStream === 'function' &&
    bestClipMime() !== null
  );
}

/**
 * Record ~`durationMs` of `canvas` to a share-ready video File (mp4 or WebM, see {@link CLIP_MIME_PREFS}),
 * or `null` if the platform can't record the canvas (→ the caller uses a still PNG). Resolves when the
 * recording stops; always releases the capture stream.
 */
export async function recordCanvasClip(canvas: HTMLCanvasElement, durationMs = 2600, fps = 30): Promise<File | null> {
  if (!canRecordCanvas(canvas)) return null;
  const mime = bestClipMime();
  if (!mime) return null;

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(fps);
  } catch {
    return null;
  }
  if (stream.getVideoTracks().length === 0) return null;

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const chunks: Blob[] = [];
  return await new Promise<File | null>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      stream.getTracks().forEach((t) => t.stop());
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const type = mime.split(';')[0]!; // 'video/mp4' | 'video/webm' (drop the codec params for the File)
      resolve(new File(chunks, `onestillpoint.${ext}`, { type }));
    };
    recorder.ondataavailable = (e): void => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = finish;
    recorder.onerror = finish;
    try {
      recorder.start();
    } catch {
      finish();
      return;
    }
    window.setTimeout(() => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else finish();
      } catch {
        finish();
      }
    }, durationMs);
  });
}
