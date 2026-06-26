import type { History } from '../core/History';
import type { SceneEvent } from '../scene/Scene';

/** Soft, warm-neon colours per transient event type (tuned against the disk palette).
 *  Exported so the info popover's colour key stays in lockstep (one source of truth). */
export const EVENT_COLOR: Record<SceneEvent, string> = {
  star: '#ffd49a', // warm gold
  planet: '#8fb4ff', // cool blue
  hole: '#c79cff', // violet
  absorb: '#ff7a5c', // warm red — a body fell in
  escape: '#6fe0c8', // teal — flung clear
};

/** Human labels for the colour key, in the order the key should list them (adds, then losses). */
export const EVENT_LEGEND: ReadonlyArray<readonly [SceneEvent, string]> = [
  ['star', 'Star added'],
  ['planet', 'Planet added'],
  ['hole', 'Black hole added'],
  ['absorb', 'Absorbed'],
  ['escape', 'Escaped'],
];

interface LoggedEvent {
  type: SceneEvent;
  at: number; // History.recorded at the time — a fixed point on the scrolling window
}

/**
 * A small, bounded log of transient scene events (adds / absorptions / escapes), each
 * tagged with the History frame counter at the time, so it keeps a fixed position on the
 * timeline as the rolling window scrolls and old frames are lost.
 */
export class EventLog {
  private events: LoggedEvent[] = [];
  constructor(private readonly cap = 256) {}

  add(type: SceneEvent, at: number): void {
    this.events.push({ type, at });
    if (this.events.length > this.cap) this.events.shift();
  }

  /** Events whose frame index lands in `[minAt, maxAt]`, as `{type, pos}` with `pos`
   *  normalized 0..1 across that window (`minAt` → 0, `maxAt` → 1). */
  inWindow(minAt: number, maxAt: number): { type: SceneEvent; pos: number }[] {
    const span = Math.max(1, maxAt - minAt);
    const out: { type: SceneEvent; pos: number }[] = [];
    for (const e of this.events) {
      if (e.at < minAt || e.at > maxAt) continue;
      out.push({ type: e.type, pos: (e.at - minAt) / span });
    }
    return out;
  }

  clear(): void {
    this.events = [];
  }
}

export interface HistoryBar {
  /** Show / hide the bar (now tied to the control panel's visibility, not Pause). */
  setVisible(on: boolean): void;
  /** Drive the live view — call once per render frame. While the sim is advancing it
   *  re-reads the window + events and rides the playhead at the live edge; while frozen
   *  (paused or mid-scrub) it leaves the playhead where the user left it. */
  tick(): void;
  dispose(): void;
}

/**
 * The **history scrub bar** — a soft warm-neon line along the exact bottom of the screen,
 * shown alongside the control panel (always on; hidden during a Replay with it). It plots the
 * last ~2 min of simulation as a **live** rolling window: colour-coded **transient-event**
 * ticks (a body added / absorbed / escaped), a brighter "scrubable" fill over the part the
 * current body layout can still be restored to, and a glowing playhead that rides the live edge
 * while the sim plays. **Click** jumps to that moment; **click-and-drag** scrubs through it —
 * each position restores that frame's kinematics onto the bodies, and `onScrub` freezes the sim
 * for the drag so the physics doesn't fight the restore.
 */
export function createHistoryBar(opts: {
  history: History;
  events: EventLog;
  /** Scrub to a normalized position 0..1 (0 = oldest, 1 = now). Returns the *clamped*
   *  position actually applied (restore only works within the current body layout). */
  scrubTo: (pos01: number) => number;
  /** Called on grab (true) / release (false) so the host can freeze the sim while the user
   *  drags — a clean scrub with no physics stepping the bodies off the restored frame. */
  onScrub?: (active: boolean) => void;
}): HistoryBar {
  const { history, events, scrubTo, onScrub } = opts;

  const el = document.createElement('div');
  el.className = 'osp-history';
  el.innerHTML =
    `<div class="osp-history__track">` +
    `<div class="osp-history__fill"></div>` + // brighter over the scrubable (current-generation) span
    `<div class="osp-history__events"></div>` + // colour-coded transient-event ticks
    `<div class="osp-history__head"></div>` + // the playhead
    `</div>`;
  document.body.appendChild(el);

  const track = el.querySelector<HTMLElement>('.osp-history__track')!;
  const fill = el.querySelector<HTMLElement>('.osp-history__fill')!;
  const eventsEl = el.querySelector<HTMLElement>('.osp-history__events')!;
  const headEl = el.querySelector<HTMLElement>('.osp-history__head')!;

  let visible = false;
  let dragging = false;
  let frames = 0; // throttle counter for the live re-render
  let lastRecorded = -1; // detects whether the sim advanced since the last tick

  // Position (0..1) of the oldest frame the current body layout can still restore — left of
  // it the window holds an older layout (shown, but the playhead clamps here).
  const boundaryPos = (): number => {
    const len = history.length;
    if (len <= 1) return 0;
    return 1 - (history.restorableLength - 1) / (len - 1);
  };

  const setHead = (pos: number): void => {
    headEl.style.left = `${pos * 100}%`;
  };

  const renderWindow = (): void => {
    fill.style.left = `${boundaryPos() * 100}%`;
  };

  const renderEvents = (): void => {
    const len = history.length;
    const minAt = history.recorded - len; // oldest frame's absolute index
    const maxAt = history.recorded - 1; // newest (now)
    eventsEl.replaceChildren();
    for (const e of events.inWindow(minAt, maxAt)) {
      const tick = document.createElement('div');
      tick.className = 'osp-history__event';
      tick.style.left = `${e.pos * 100}%`;
      const c = EVENT_COLOR[e.type];
      tick.style.setProperty('--osp-ev', c);
      eventsEl.appendChild(tick);
    }
  };

  const posFromEvent = (e: PointerEvent): number => {
    const r = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
  };

  const onDown = (e: PointerEvent): void => {
    if (!visible) return;
    dragging = true;
    onScrub?.(true); // freeze the sim for a clean scrub
    track.setPointerCapture(e.pointerId);
    setHead(scrubTo(posFromEvent(e))); // a single click already jumps; a drag keeps scrubbing
  };
  const onMove = (e: PointerEvent): void => {
    if (dragging) setHead(scrubTo(posFromEvent(e)));
  };
  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    onScrub?.(false); // resume — the sim plays on from the scrubbed frame
    try {
      track.releasePointerCapture(e.pointerId);
    } catch {
      /* wasn't captured */
    }
  };
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerup', onUp);
  track.addEventListener('pointercancel', onUp);

  return {
    setVisible(on: boolean): void {
      if (on === visible) return; // idempotent: a redundant show (panel mount *and* formation.onDone
      // both fire it on first load) must not reset lastRecorded and snap the playhead off a scrub.
      visible = on;
      el.classList.toggle('osp-history--on', on);
      if (on) {
        frames = 0;
        lastRecorded = -1;
        renderWindow();
        renderEvents();
        setHead(1); // start the playhead at the live edge ("now")
      } else {
        dragging = false;
      }
    },
    tick(): void {
      if (!visible) return;
      const rec = history.recorded;
      const live = rec !== lastRecorded; // a new frame recorded since last tick → sim advancing
      lastRecorded = rec;
      if (!live) return; // paused or mid-scrub (recording frozen): hold the playhead + view
      if (frames++ % 10 === 0) {
        renderWindow();
        renderEvents();
      }
      if (!dragging) setHead(1); // ride the live edge while the sim plays
    },
    dispose(): void {
      el.remove();
    },
  };
}
