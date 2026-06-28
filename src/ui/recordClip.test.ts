import { describe, expect, it } from 'vitest';
import { CLIP_MIME_PREFS, bestClipMime, canRecordCanvas } from './recordClip';

describe('recordClip', () => {
  it('bestClipMime picks the best-supported container, mp4/H.264 first then WebM', () => {
    expect(bestClipMime(() => true)).toBe(CLIP_MIME_PREFS[0]); // all supported → mp4 H.264 (AirDrop-friendly)
    expect(bestClipMime((m) => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9'); // no mp4 → best WebM
    expect(bestClipMime((m) => m === 'video/webm;codecs=vp8')).toBe('video/webm;codecs=vp8');
    expect(bestClipMime((m) => m === 'video/webm')).toBe('video/webm'); // only the generic type
    expect(bestClipMime(() => false)).toBeNull(); // nothing records → the caller stays on a still PNG
  });

  it('canRecordCanvas is false without a captureStream-capable canvas', () => {
    expect(canRecordCanvas({} as HTMLCanvasElement)).toBe(false); // no captureStream (and no MediaRecorder here)
  });
});
