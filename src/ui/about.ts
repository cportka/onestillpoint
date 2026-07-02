import { TAGLINE } from '../tagline';

const GITHUB = 'https://github.com/cportka/onestillpoint';
const VENMO = 'https://venmo.com/portka';
const ETH = '0x354c2aB3f7a23F74cdDC745B26aEA53EC1602203';
const BTC = '3J4XRAwhHwJWQb4F4qw5yTCrs5Zg1s1vaR';

const abbreviate = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

// The animated Ember Core mark (2026-07 branding pass, roadmap #3): a tilted accretion ring
// wrapping an ember-lit event-horizon sphere, warm-silver strokes, stardust spiralling inward along
// the ring. Self-contained (its own gradients/blurs/animation); the stardust settles to a still
// frame under prefers-reduced-motion. Mirrors `assets/hero.svg` minus the background tile (the card
// provides the backdrop) and the width attr (the card's CSS sizes it).
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-labelledby="osp-t osp-d" preserveAspectRatio="xMidYMid meet">
<title id="osp-t">One Still Point</title>
<desc id="osp-d">A black hole: a tilted accretion ring wrapping an ember-lit event-horizon sphere, with stardust spiralling inward along the ring.</desc>
<defs>
<radialGradient id="osp-globe" gradientUnits="userSpaceOnUse" cx="320" cy="320" r="525">
<stop offset="0" stop-color="rgb(185,165,135)" stop-opacity="0.16"/>
<stop offset="0.38" stop-color="rgb(185,165,135)" stop-opacity="0.058"/>
<stop offset="0.66" stop-color="rgb(185,165,135)" stop-opacity="0"/>
</radialGradient>
<radialGradient id="osp-coreFill" gradientUnits="userSpaceOnUse" cx="320" cy="293.9" r="173.3">
<stop offset="0" stop-color="#171717"/>
<stop offset="0.7" stop-color="#000000"/>
</radialGradient>
<radialGradient id="osp-farFade" gradientUnits="userSpaceOnUse" cx="320" cy="320" r="140.8" spreadMethod="pad">
<stop offset="0" stop-color="#000000"/>
<stop offset="0.909" stop-color="#000000"/>
<stop offset="1" stop-color="#ffffff"/>
</radialGradient>
<mask id="osp-farMask" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640">
<rect width="640" height="640" fill="url(#osp-farFade)"/>
</mask>
<linearGradient id="osp-taper" gradientUnits="userSpaceOnUse" x1="25.6" y1="0" x2="614.4" y2="0">
<stop offset="0.23" stop-color="#000000"/>
<stop offset="0.35" stop-color="#ffffff"/>
<stop offset="0.65" stop-color="#ffffff"/>
<stop offset="0.77" stop-color="#000000"/>
</linearGradient>
<mask id="osp-taperMask" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="640">
<rect width="640" height="640" fill="url(#osp-taper)"/>
</mask>
<filter id="osp-blurOrbit" filterUnits="userSpaceOnUse" x="-60" y="-60" width="760" height="760"><feGaussianBlur stdDeviation="9.7"/></filter>
<filter id="osp-blurHalo" filterUnits="userSpaceOnUse" x="-60" y="-60" width="760" height="760"><feGaussianBlur stdDeviation="11"/></filter>
<filter id="osp-blurHaloIn" filterUnits="userSpaceOnUse" x="-60" y="-60" width="760" height="760"><feGaussianBlur stdDeviation="8.3"/></filter>
<filter id="osp-blurEmber" filterUnits="userSpaceOnUse" x="-60" y="-60" width="760" height="760"><feGaussianBlur stdDeviation="16.6"/></filter>
<filter id="osp-blurCut" filterUnits="userSpaceOnUse" x="-60" y="-60" width="760" height="760"><feGaussianBlur stdDeviation="2.8"/></filter>
<filter id="osp-b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>
<style>
.osp-d{fill:#ffd2a6;offset-path:path("M168 392C120 250 220 152 320 152C430 152 470 270 408 344");offset-rotate:0deg;opacity:.85}
#osp-m1{offset-distance:62%;fill:#fff3e3}#osp-m2{offset-distance:40%}#osp-m3{offset-distance:18%}
@media (prefers-reduced-motion:no-preference){
.osp-d{animation:osp-fall 9.2s linear infinite}
#osp-m2{animation-delay:-3.07s}#osp-m3{animation-delay:-6.13s}
}
@keyframes osp-fall{0%{offset-distance:0%;opacity:0}8%{opacity:1}82%{opacity:1}100%{offset-distance:100%;opacity:0}}
</style>
</defs>
<circle cx="320" cy="320" r="371.2" fill="url(#osp-globe)"/>
<g mask="url(#osp-farMask)">
<g transform="rotate(-9 320 320)">
<path d="M 29.88 320 A 290.12 70.18 0 0 1 610.12 320" fill="none" stroke="rgb(195,188,171)" stroke-opacity="0.48" stroke-width="8.55" filter="url(#osp-blurOrbit)"/>
<path d="M 29.88 320 A 290.12 70.18 0 0 1 610.12 320" fill="none" stroke="#c3bcab" stroke-width="8.55"/>
</g>
</g>
<g filter="url(#osp-b)"><circle class="osp-d" id="osp-m1" r="5"/><circle class="osp-d" id="osp-m2" r="3.6"/><circle class="osp-d" id="osp-m3" r="2.8"/></g>
<circle cx="320" cy="320" r="111.6" fill="rgb(255,198,148)" fill-opacity="0.30" filter="url(#osp-blurEmber)"/>
<circle cx="320" cy="320" r="108.8" fill="url(#osp-coreFill)"/>
<circle cx="320" cy="320" r="110.2" fill="none" stroke="rgb(255,208,158)" stroke-opacity="0.6" stroke-width="2.8"/>
<circle cx="320" cy="320" r="123.7" fill="none" stroke="#d2cab6" stroke-width="8.55" filter="url(#osp-blurHalo)"/>
<circle cx="320" cy="320" r="114.5" fill="none" stroke="#d2cab6" stroke-opacity="0.55" stroke-width="8.3" filter="url(#osp-blurHaloIn)"/>
<circle cx="320" cy="320" r="123.7" fill="none" stroke="#d2cab6" stroke-width="8.55"/>
<g transform="rotate(-9 320 320)">
<path d="M 29.88 320 A 290.12 70.18 0 0 0 610.12 320" fill="none" stroke="rgb(195,188,171)" stroke-opacity="0.48" stroke-width="8.55" filter="url(#osp-blurOrbit)"/>
<path d="M 29.88 320 A 290.12 70.18 0 0 0 610.12 320" fill="none" stroke="#000000" stroke-opacity="0.75" stroke-width="13.2" filter="url(#osp-blurCut)"/>
<path d="M 29.88 320 A 290.12 70.18 0 0 0 610.12 320" fill="none" stroke="#c3bcab" stroke-width="8.55"/>
<path d="M 29.88 320 A 290.12 70.18 0 0 0 610.12 320" fill="none" stroke="#c3bcab" stroke-width="12.8" mask="url(#osp-taperMask)"/>
</g>
</svg>`;

/**
 * The "About" button (sits to the left of the version chip). Clicking it opens a
 * small modal crediting the author with a link to the project, donation options
 * (Venmo plus ETH/BTC addresses that copy in full on click), and the tagline.
 *
 * Returns the button plus a `toggle` so a keyboard shortcut (Esc) can open/close
 * the same dialog.
 */
export function createAboutButton(): { button: HTMLButtonElement; toggle: () => void } {
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
        <div class="osp-about__title">One Still Point</div>
        <div class="osp-about__by">Created by Chris Portka</div>
        <div class="osp-about__logo">${LOGO_SVG}</div>
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
  const toggle = (): void => {
    overlay.hidden = !overlay.hidden;
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

  return { button, toggle };
}
