import { describe, expect, it } from 'vitest';
import { handleMessage } from './renderWorker';
import { WORKER_PROTOCOL_VERSION, type WorkerToMain } from './protocol';

function collect() {
  const out: WorkerToMain[] = [];
  return { post: (m: WorkerToMain) => out.push(m), out };
}

const canvas = {} as OffscreenCanvas; // a type-only stand-in (handler doesn't touch it in the stub)

describe('renderWorker handshake (stub)', () => {
  it('replies `ready` to a matching-protocol init', () => {
    const { post, out } = collect();
    handleMessage(
      { type: 'init', protocol: WORKER_PROTOCOL_VERSION, canvas, width: 100, height: 80, dpr: 1, quality: 'auto' },
      post,
    );
    expect(out).toEqual([{ type: 'ready', protocol: WORKER_PROTOCOL_VERSION, backend: 'webgpu' }]);
  });

  it('replies `error` on a protocol mismatch (stale bundle)', () => {
    const { post, out } = collect();
    handleMessage(
      { type: 'init', protocol: 999, canvas, width: 100, height: 80, dpr: 1, quality: 'auto' },
      post,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('error');
  });

  it('is a no-op for messages it does not yet service', () => {
    const { post, out } = collect();
    handleMessage({ type: 'dispose' }, post);
    handleMessage({ type: 'resize', width: 1, height: 1, dpr: 1 }, post);
    handleMessage({ type: 'pointer', action: 'move', x: 0, y: 0, buttons: 0 }, post);
    expect(out).toEqual([]);
  });
});
