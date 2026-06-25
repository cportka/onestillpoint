import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

/**
 * A rolling video buffer of the last few seconds of the canvas — the source for the
 * Share button's clip. It continuously encodes the live view so that, at any moment, "the
 * previous ~5 seconds" is ready to share as a real **.mp4**.
 *
 * **Why WebCodecs, not MediaRecorder.** `MediaRecorder` can't produce mp4 on many browsers
 * (Chromium often only offers WebM), and macOS can't preview/AirDrop a WebM. So we encode
 * H.264 directly with a `VideoEncoder` and mux it into an mp4 with `mp4-muxer`. This also
 * gives us what a rolling clip needs: explicit keyframes (so the buffer always begins on a
 * decodable frame), tiny retained chunks, and a correct duration written on finalize.
 *
 *   • A 720×720 offscreen canvas is the encode surface — each frame the main canvas is
 *     blitted in, centre-cropped to a square and scaled to 720p (clean for share sheets).
 *   • We keep a rolling window of encoded chunks back to the keyframe preceding ~5s ago, so
 *     a clip is always recent (it ends at ~now) and starts clean — fixing the earlier bug
 *     where a clip began with stale frames from when recording started.
 *
 * Returns `null` (→ the Share button falls back to a still PNG) when the platform can't
 * encode H.264 video — e.g. WebCodecs is missing, or there's no H.264 encoder (some Linux
 * Chrome / headless). macOS/iOS/Android/Windows all have one.
 */
export interface ClipRecorder {
  /** Begin buffering. Call once the intro is done, to keep the heavy intro frames clear. */
  start: () => void;
  /** Blit + encode the current frame. Call once per render frame (cheap — internally
   *  throttled to the capture rate). No-op until `start()` and the encoder is configured. */
  update: () => void;
  /** Mux the buffered window into a share-ready square **mp4** File that ends at ~now.
   *  Resolves `null` if nothing has buffered yet. */
  takeClip: () => Promise<File | null>;
  /** True once a recent clip is available (else the Share button uses a still). */
  readonly ready: boolean;
  /** Stop encoding and release the buffer. */
  dispose: () => void;
}

const SIZE = 720; // 720×720 square
const FPS = 30;
const BITRATE = 5_000_000; // ~5 Mbps — plenty for 720p square
const WINDOW_MS = 5000; // keep ~the last 5 seconds
const KEYFRAME_MS = 1000; // force a keyframe ~every second (tight rolling-window start)
const MIN_SPAN_MS = 2000; // don't offer a clip until at least this much has buffered
// H.264 profiles to try, most-capable first: Main 4.0, then Baseline 3.1 / 3.0 (broadest).
const AVC_CODECS = ['avc1.4d0028', 'avc1.42001f', 'avc1.42e01e'];

interface Entry {
  chunk: EncodedVideoChunk;
  t: number; // performance.now() when encoded — drives the rolling window
}

export function createClipRecorder(source: HTMLCanvasElement): ClipRecorder | null {
  // Need WebCodecs. (H.264 encoder support is checked async in start(); until then ready=false.)
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;

  const square = document.createElement('canvas');
  square.width = SIZE;
  square.height = SIZE;
  const ctx = square.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#05060a'; // the app's near-black, so a clip taken early isn't pure black
  ctx.fillRect(0, 0, SIZE, SIZE);

  let encoder: VideoEncoder | null = null;
  let meta: EncodedVideoChunkMetadata | null = null; // decoder config (avcC) from the encoder
  let buf: Entry[] = [];
  let started = false;
  let dead = false;
  let busy = false; // pause encoding while a clip is flushed + muxed
  let baseTs = 0;
  let lastBlit = 0;
  let lastKey = 0;

  // Drop chunks older than the window, but never below the keyframe that precedes the kept
  // span — so the buffer always begins on a decodable keyframe.
  const prune = (): void => {
    const cutoff = performance.now() - WINDOW_MS;
    let keep = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i]!.t > cutoff) break;
      if (buf[i]!.chunk.type === 'key') keep = i;
    }
    if (keep > 0) buf.splice(0, keep);
  };

  const start = (): void => {
    if (started || dead) return;
    started = true;
    void (async () => {
      try {
        let codec: string | null = null;
        for (const c of AVC_CODECS) {
          const config = { codec: c, width: SIZE, height: SIZE, bitrate: BITRATE, framerate: FPS };
          if ((await VideoEncoder.isConfigSupported(config)).supported) {
            codec = c;
            break;
          }
        }
        if (!codec) {
          dead = true; // no H.264 encoder → the Share button uses a still PNG instead
          return;
        }
        encoder = new VideoEncoder({
          output: (chunk, m): void => {
            if (m?.decoderConfig) meta = m;
            buf.push({ chunk, t: performance.now() });
            prune();
          },
          error: (): void => {
            dead = true;
            encoder = null;
          },
        });
        encoder.configure({
          codec,
          width: SIZE,
          height: SIZE,
          bitrate: BITRATE,
          framerate: FPS,
          latencyMode: 'realtime',
          avc: { format: 'avc' }, // length-prefixed (avcC) chunks, as mp4-muxer wants
        });
        baseTs = performance.now();
      } catch {
        dead = true;
      }
    })();
  };

  const update = (): void => {
    if (!started || dead || busy || !encoder || encoder.state !== 'configured') return;
    const now = performance.now();
    if (now - lastBlit < 1000 / FPS) return; // throttle to the capture rate
    lastBlit = now;
    const sw = source.width;
    const sh = source.height;
    if (sw === 0 || sh === 0) return;
    const s = Math.min(sw, sh); // centre-crop the drawing buffer to a square, scaled to 720
    ctx.drawImage(source, (sw - s) / 2, (sh - s) / 2, s, s, 0, 0, SIZE, SIZE);
    if (encoder.encodeQueueSize > 4) return; // backpressure: skip a frame if the encoder is behind
    const keyFrame = now - lastKey >= KEYFRAME_MS;
    if (keyFrame) lastKey = now;
    const frame = new VideoFrame(square, { timestamp: Math.max(0, Math.round((now - baseTs) * 1000)) });
    try {
      encoder.encode(frame, { keyFrame });
    } finally {
      frame.close(); // VideoFrames hold GPU memory — release immediately
    }
  };

  const takeClip = async (): Promise<File | null> => {
    if (!encoder || dead || !meta || buf.length === 0) return null;
    busy = true; // stop feeding frames while we flush + mux a clean snapshot
    try {
      await encoder.flush(); // drain pending frames so the clip ends at ~now
      const entries = buf.slice();
      const startIdx = entries.findIndex((e) => e.chunk.type === 'key');
      if (startIdx < 0) return null;
      const clip = entries.slice(startIdx);
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: SIZE, height: SIZE },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset', // rebase the clip to start at t=0
      });
      for (let i = 0; i < clip.length; i++) muxer.addVideoChunk(clip[i]!.chunk, i === 0 ? meta : undefined);
      muxer.finalize();
      return new File([target.buffer], 'onestillpoint.mp4', { type: 'video/mp4' });
    } catch {
      return null;
    } finally {
      busy = false;
    }
  };

  return {
    start,
    update,
    takeClip,
    get ready(): boolean {
      return (
        started &&
        !dead &&
        meta !== null &&
        buf.length > 0 &&
        buf.some((e) => e.chunk.type === 'key') &&
        performance.now() - buf[0]!.t >= MIN_SPAN_MS
      );
    },
    dispose(): void {
      started = false;
      dead = true;
      try {
        encoder?.close();
      } catch {
        /* already closed */
      }
      encoder = null;
      buf = [];
    },
  };
}
