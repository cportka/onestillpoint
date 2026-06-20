import { TAGLINE } from '../tagline';

const GITHUB = 'https://github.com/cportka/onestillpoint';
const VENMO = 'https://venmo.com/portka';
const ETH = '0x354c2aB3f7a23F74cdDC745B26aEA53EC1602203';
const BTC = '3J4XRAwhHwJWQb4F4qw5yTCrs5Zg1s1vaR';

const abbreviate = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

/**
 * The "About" button (sits to the left of the version chip). Clicking it opens a
 * small modal crediting the author with a link to the project, donation options
 * (Venmo plus ETH/BTC addresses that copy in full on click), and the tagline.
 */
export function createAboutButton(): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'osp-about-btn';
  button.textContent = 'About';
  button.title = 'About One Still Point';

  const overlay = document.createElement('div');
  overlay.className = 'osp-about';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="osp-about__card" role="dialog" aria-modal="true" aria-label="About One Still Point">
      <button class="osp-about__close" type="button" aria-label="Close">×</button>
      <div class="osp-about__title">One Still Point</div>
      <div class="osp-about__by">Created by Chris Portka</div>
      <a class="osp-about__row" href="${GITHUB}" target="_blank" rel="noopener noreferrer">
        <span>Github</span><span class="osp-about__val">cportka/onestillpoint&nbsp;↗</span>
      </a>
      <button class="osp-about__row osp-about__copy" type="button" data-addr="${ETH}" title="Copy full ETH address">
        <span>Donate ETH</span>
        <span class="osp-about__val">
          <span class="osp-about__addr">${abbreviate(ETH)}</span>
          <span class="osp-about__copied">✓ copied</span>
        </span>
      </button>
      <button class="osp-about__row osp-about__copy" type="button" data-addr="${BTC}" title="Copy full BTC address">
        <span>Donate BTC</span>
        <span class="osp-about__val">
          <span class="osp-about__addr">${abbreviate(BTC)}</span>
          <span class="osp-about__copied">✓ copied</span>
        </span>
      </button>
      <a class="osp-about__row" href="${VENMO}" target="_blank" rel="noopener noreferrer">
        <span>Donate Venmo</span><span class="osp-about__val">@portka&nbsp;↗</span>
      </a>
      <div class="osp-about__tagline">${TAGLINE}</div>
    </div>`;
  document.body.appendChild(overlay);

  const close = (): void => {
    overlay.hidden = true;
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.hidden = false;
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.osp-about__close')?.addEventListener('click', close);

  // ETH / BTC rows copy the full address with the same ✓ confirmation.
  overlay.querySelectorAll('.osp-about__copy').forEach((row) => {
    row.addEventListener('click', () => {
      const addr = row.getAttribute('data-addr') ?? '';
      const flash = (): void => {
        row.classList.add('is-copied');
        window.setTimeout(() => row.classList.remove('is-copied'), 1200);
      };
      const clip = navigator.clipboard;
      if (clip?.writeText && addr) void clip.writeText(addr).then(flash, flash);
      else flash();
    });
  });

  return button;
}
