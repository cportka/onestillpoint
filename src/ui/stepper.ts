/**
 * A compact "− N +" stepper row for the Bodies folder, styled to sit among the
 * lil-gui controllers. The + and − flash green ✓ (done) / red ✗ (blocked — at a
 * cap, or already empty) to confirm each click.
 */
export interface StepperOptions {
  label: string;
  count: () => number;
  canInc: () => boolean;
  onInc: () => void;
  onDec: () => void;
  incTip?: string;
  decTip?: string;
}

export interface Stepper {
  row: HTMLElement;
  refresh: () => void;
}

function flashEl(el: HTMLElement, ok: boolean): void {
  const cls = ok ? 'osp-flash-ok' : 'osp-flash-max';
  el.classList.remove('osp-flash-ok', 'osp-flash-max');
  void el.offsetWidth; // reflow so the animation restarts on a repeat click
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 700);
}

export function createStepper(opts: StepperOptions): Stepper {
  const row = document.createElement('div');
  row.className = 'osp-stepper';

  const label = document.createElement('span');
  label.className = 'osp-stepper__label';
  label.textContent = opts.label;

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'osp-step';
  dec.textContent = '−';
  if (opts.decTip) dec.title = opts.decTip;

  const countEl = document.createElement('span');
  countEl.className = 'osp-stepper__count';

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'osp-step';
  inc.textContent = '+';
  if (opts.incTip) inc.title = opts.incTip;

  const refresh = (): void => {
    countEl.textContent = String(opts.count());
  };

  inc.addEventListener('click', () => {
    if (opts.canInc()) {
      opts.onInc();
      refresh();
      flashEl(inc, true);
    } else {
      flashEl(inc, false);
    }
  });
  dec.addEventListener('click', () => {
    if (opts.count() > 0) {
      opts.onDec();
      refresh();
      flashEl(dec, true);
    } else {
      flashEl(dec, false);
    }
  });

  row.append(label, dec, countEl, inc);
  refresh();
  return { row, refresh };
}
