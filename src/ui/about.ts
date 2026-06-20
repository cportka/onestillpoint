import { TAGLINE } from '../tagline';

const GITHUB = 'https://github.com/cportka/onestillpoint';
const VENMO = 'https://venmo.com/portka';
const ETH = '0x354c2aB3f7a23F74cdDC745B26aEA53EC1602203';
const BTC = '3J4XRAwhHwJWQb4F4qw5yTCrs5Zg1s1vaR';

const abbreviate = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

// The animated mark: a tilted accretion ring wrapping an event-horizon sphere,
// with stardust spiralling inward along the ring. Self-contained (its own
// gradient/blur/animation), strokes themed via `--osp-glow`, and it settles to a
// still frame under prefers-reduced-motion.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-labelledby="osp-t osp-d" preserveAspectRatio="xMidYMid meet">
<title id="osp-t">One Still Point</title>
<desc id="osp-d">A black hole: a tilted accretion ring wrapping an event-horizon sphere, with stardust spiralling inward along the ring.</desc>
<defs>
<radialGradient id="osp-gl" cx="50%" cy="50%" r="50%">
<stop offset="0" stop-color="var(--osp-glow,#fff)" stop-opacity=".16"/>
<stop offset=".55" stop-color="var(--osp-glow,#fff)" stop-opacity=".04"/>
<stop offset="1" stop-color="var(--osp-glow,#fff)" stop-opacity="0"/>
</radialGradient>
<filter id="osp-b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
<ellipse id="osp-dk" cx="320" cy="320" rx="215" ry="58"/>
<clipPath id="osp-lo"><rect x="0" y="318" width="640" height="322"/></clipPath>
<style>
.osp-s{fill:none;stroke:var(--osp-glow,#fff);stroke-width:3}
.osp-d{fill:var(--osp-glow,#fff);offset-path:path("M168 392C120 250 220 152 320 152C430 152 470 270 408 344");offset-rotate:0deg;opacity:.85}
#osp-m1{offset-distance:62%}#osp-m2{offset-distance:40%}#osp-m3{offset-distance:18%}
@media (prefers-reduced-motion:no-preference){
.osp-d{animation:osp-fall 9.2s linear infinite}
#osp-m2{animation-delay:-3.07s}#osp-m3{animation-delay:-6.13s}
}
@keyframes osp-fall{0%{offset-distance:0%;opacity:0}8%{opacity:1}82%{opacity:1}100%{offset-distance:100%;opacity:0}}
</style>
</defs>
<circle cx="320" cy="320" r="230" fill="url(#osp-gl)"/>
<g transform="rotate(-8 320 320)"><use href="#osp-dk" class="osp-s" filter="url(#osp-b)"/></g>
<g filter="url(#osp-b)"><circle class="osp-d" id="osp-m1" r="5"/><circle class="osp-d" id="osp-m2" r="3.6"/><circle class="osp-d" id="osp-m3" r="2.8"/></g>
<circle cx="320" cy="320" r="82" fill="#05060a"/>
<circle cx="320" cy="320" r="82" class="osp-s" stroke-width="2.4" filter="url(#osp-b)"/>
<g transform="rotate(-8 320 320)"><use href="#osp-dk" class="osp-s" clip-path="url(#osp-lo)" filter="url(#osp-b)"/></g>
<circle cx="320" cy="320" r="94" class="osp-s" filter="url(#osp-b)"/>
</svg>`;

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

  // The tagline frames the dialog: its four parts run along the top, down the
  // right, across the bottom, and up the left.
  const [t0 = '', t1 = '', t2 = '', t3 = ''] = TAGLINE.split(' · ');

  const overlay = document.createElement('div');
  overlay.className = 'osp-about';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="osp-about__card" role="dialog" aria-modal="true" aria-label="About One Still Point">
      <button class="osp-about__close" type="button" aria-label="Close">×</button>
      <div class="osp-about__edge osp-about__edge--top">${t0}</div>
      <div class="osp-about__edge osp-about__edge--right"><span>${t1}</span></div>
      <div class="osp-about__edge osp-about__edge--bottom">${t2}</div>
      <div class="osp-about__edge osp-about__edge--left"><span>${t3}</span></div>
      <div class="osp-about__inner">
        <div class="osp-about__logo">${LOGO_SVG}</div>
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
      </div>
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
