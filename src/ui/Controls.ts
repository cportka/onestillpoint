import GUI, { type Controller } from 'lil-gui';
import type BloomNode from 'three/addons/tsl/display/BloomNode.js';
import type { WebGPURenderer } from 'three/webgpu';
import { VERSION } from '../version';
import type { FormationSequence } from '../core/FormationSequence';
import type { QualityTier } from '../core/quality';
import type { RendererBundle } from '../core/Renderer';
import type { ResolutionScaler } from '../core/ResolutionScaler';
import type { TimeController } from '../core/TimeController';
import type { PhysicsController } from '../physics/PhysicsController';
import { MAX_BODIES } from '../render/bodyUniforms';
import type { BodyType } from '../scene/Body';
import type { BlackHole } from '../scene/BlackHole';
import type { Scene } from '../scene/Scene';
import type { Hud } from './hud';
import { loadPrefs, savePrefs } from './prefs';
import { PRESETS } from './presets';
import { attachTouchTooltips } from './touchTooltips';
import { createVersionBadge } from './versionBadge';

/** Attach a native hover tooltip to a controller's row. */
function tip<T extends Controller>(controller: T, text: string): T {
  controller.domElement.title = text;
  return controller;
}

/** Briefly flash a controller's row to confirm an action: green ✓ on success,
 *  red ✗ when it was blocked (e.g. the body limit was reached). */
function flash(controller: Controller, ok: boolean): void {
  const el = controller.domElement;
  const cls = ok ? 'osp-flash-ok' : 'osp-flash-max';
  el.classList.remove('osp-flash-ok', 'osp-flash-max');
  void el.offsetWidth; // reflow so the animation restarts on a repeat click
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 750);
}

/**
 * The lil-gui control panel. Expanded, it shows just the essentials —
 * version · Filter (presets) · Time · Bodies · an Advanced-settings toggle — and
 * the deep tuning (Look / Animation / Bloom / Quality / Movie / Replay) is folded
 * away behind that toggle, whose state is remembered across sessions. Every row
 * carries a hover tooltip (and a long-press tooltip on touch).
 */
export function createControls(ctx: {
  blackHole: BlackHole;
  scene: Scene;
  physics: PhysicsController;
  time: TimeController;
  formation: FormationSequence;
  backend: RendererBundle['backend'];
  renderer: WebGPURenderer;
  scaler: ResolutionScaler;
  bloom: BloomNode;
  hud: Hud;
  autoTier: QualityTier;
  applyQuality: (tier: QualityTier) => void;
}): GUI {
  const { blackHole: bh, scene, physics, time, formation, backend, renderer, scaler, bloom } = ctx;
  const { hud, autoTier, applyQuality } = ctx;
  const gui = new GUI({ title: 'One Still Point' });
  const prefs = loadPrefs();

  // --- Filter (named looks; formerly "Preset") ---
  const filterProxy = { preset: 'Physical' };
  tip(
    gui
      .add(filterProxy, 'preset', Object.keys(PRESETS))
      .name('Filter')
      .onChange((name: string) => {
        const p = PRESETS[name];
        if (!p) return;
        bh.emissiveStrength.value = p.emissiveStrength;
        bh.diskDensity.value = p.diskDensity;
        bh.diskTemp.value = p.diskTemp;
        bh.scatterStrength.value = p.scatterStrength;
        bh.extinction.value = p.extinction;
        bh.doppler.value = p.doppler;
        bh.redshift.value = p.redshift;
        bh.turbAmount.value = p.turbAmount;
        bh.rotationSpeed.value = p.rotationSpeed;
        renderer.toneMappingExposure = p.exposure;
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }),
    'A named look. Physical = accurate (full beaming + redshift). EHT (Event Horizon ' +
      'Telescope) = the real imaged look of M87*/Sgr A*: a cooler, smoother orange photon ' +
      'ring. Interstellar = symmetric, beaming OFF (stylised). Stylized = hot, punchy, ' +
      'turbulent. Filters toggle real physics on/off.',
  );

  // --- Time ---
  const timeFolder = gui.addFolder('Time');
  const timeProxy = { exp: 0 };
  const fmtScale = (s: number): string => {
    if (s >= 1e6) return `${(s / 1e6).toFixed(1)}M`;
    if (s >= 1e3) return `${(s / 1e3).toFixed(1)}k`;
    if (s >= 1) return `${Math.round(s)}`;
    return `1/${Math.round(1 / s)}`; // slow-motion: ×1/10 … ×1/1000
  };
  // exp is log10(timeScale): −3 → ×1/1000 (slow-mo) up to 6 → ×1,000,000.
  const speedCtrl = timeFolder.add(timeProxy, 'exp', -3, 6, 0.05).name('Speed ×1');
  speedCtrl.onChange((v: number) => {
    time.timeScale = Math.pow(10, v);
    speedCtrl.name(`Speed ×${fmtScale(time.timeScale)}`);
  });
  tip(
    speedCtrl,
    'How fast time runs — from ×1/1000 (slow-motion) through ×1 (real-time) up to ' +
      '×1,000,000. Speeding up accelerates the orbits and smoothly averages the fine ' +
      'turbulence into a steady disk instead of strobing; slowing down resolves every detail.',
  );

  // --- Bodies ---
  const bodies = gui.addFolder('Bodies');
  const countOf = (type: BodyType): number => scene.companions.filter((b) => b.type === type).length;
  const addCtrls: Partial<Record<BodyType, Controller>> = {};
  // Subtle live count on each button ("Add star · 2").
  const refreshCounts = (): void => {
    addCtrls.star?.name(`Add star · ${countOf('star')}`);
    addCtrls.planet?.name(`Add planet · ${countOf('planet')}`);
    addCtrls.hole?.name(`Add black hole · ${countOf('hole')}`);
  };
  // Add if there's room (shared limit of MAX_BODIES); flash ✓ added / ✗ at max.
  const tryAdd = (type: BodyType, add: () => void) => () => {
    const ok = scene.companions.length < MAX_BODIES;
    if (ok) {
      add();
      physics.syncBodies();
      refreshCounts();
    }
    const ctrl = addCtrls[type];
    if (ctrl) flash(ctrl, ok);
  };
  const actions = {
    addStar: tryAdd('star', () => scene.addStar()),
    addPlanet: tryAdd('planet', () => scene.addPlanet()),
    addBlackHole: tryAdd('hole', () => scene.addBlackHole()),
    clear: () => {
      scene.clearCompanions();
      physics.syncBodies();
      refreshCounts();
    },
    gpu: backend === 'webgpu', // auto-on where WebGPU compute exists (see main.ts)
  };
  addCtrls.star = tip(
    bodies.add(actions, 'addStar'),
    `Drop a bright star onto a prograde circular orbit (up to ${MAX_BODIES} bodies total). It is lensed and occluded by the shadow as it passes behind.`,
  );
  addCtrls.planet = tip(
    bodies.add(actions, 'addPlanet'),
    'Drop a small dim body onto a retrograde orbit (it circles the opposite way to the stars).',
  );
  addCtrls.hole = tip(
    bodies.add(actions, 'addBlackHole'),
    'Drop in a second black hole — a dark core wrapped in its own glowing, rotating accretion ' +
      'disk — that bends light around it and slings the other bodies. The heaviest thing to ' +
      'add; auto-resolution trades sharpness to keep it smooth.',
  );
  tip(bodies.add(actions, 'clear').name('Clear companions'), 'Remove all added bodies and restore the default orbits.');
  refreshCounts(); // set the initial counts ("Add star · 2", …)

  // --- Replay intro (basic; the last item before the Advanced toggle) ---
  tip(
    gui.add({ replay: () => formation.restart() }, 'replay').name('Replay intro'),
    'Play the formation sequence again — the camera pulls back and the disk re-ignites.',
  );

  // --- Advanced settings toggle (remembered across sessions) ---
  const advCtrl = gui.add(prefs, 'advanced').name('Advanced settings');
  advCtrl.domElement.classList.add('osp-section'); // bold label + a stronger divider

  // --- Advanced, in order: GPU physics, Display FPS, Pause, Step, then tuning ---
  const gpuAvailable = backend === 'webgpu';
  const gpuCtrl = gui.add(actions, 'gpu').name('GPU physics').onChange((v: boolean) => {
    physics.setGPU(v);
  });
  if (!gpuAvailable) gpuCtrl.disable();
  tip(
    gpuCtrl,
    gpuAvailable
      ? 'Run the N-body simulation on the GPU (WebGPU compute). Auto-enabled here because this ' +
          'browser has WebGPU — the scaling path for many bodies (no visible change for a few).'
      : 'Requires WebGPU. This browser is on the WebGL2 fallback, so the N-body sim runs on the ' +
          'CPU (exact, and fine for a handful of bodies).',
  );

  hud.setVisible(prefs.showFps);
  const fpsCtrl = tip(
    gui.add(prefs, 'showFps').name('Display FPS'),
    'Show a small corner readout: renderer (WebGPU / WebGL2), frame rate, and the current ' +
      'render-resolution scale ("% res" — auto-resolution lowers it under load).',
  );
  fpsCtrl.onChange((v: boolean) => {
    hud.setVisible(v);
    savePrefs(prefs);
  });

  const pauseCtrl = tip(gui.add(time, 'paused').name('Pause'), 'Freeze time — inspect the lensing on a still frame.');
  const stepCtrl = tip(
    gui.add({ step: () => time.step() }, 'step').name('Step (when paused)'),
    'Advance a single frame while paused.',
  );

  // Last of the first batch of Advanced toggles: click/tap outside to collapse.
  const tapOutsideCtrl = tip(
    gui.add(prefs, 'tapOutsideClose').name('Click outside closes'),
    'Clicking or tapping the scene outside this panel collapses it. On by default.',
  );
  tapOutsideCtrl.onChange(() => savePrefs(prefs));

  // --- Advanced: deep tuning folders ---
  const look = gui.addFolder('Look');
  tip(
    look.add(bh.emissiveStrength, 'value', 0, 2, 0.01).name('Disk brightness'),
    'Heat-glow intensity of the disk. Higher = brighter (more bloom); lower = a ' +
      'fainter, more ethereal disk dominated by the glow.',
  );
  tip(
    look.add(bh.diskDensity, 'value', 0, 3, 0.05).name('Density'),
    'How much gas is in the disk. Higher = thicker, more opaque, more contrast; ' +
      'lower = thin and wispy, more background showing through.',
  );
  tip(
    look.add(bh.diskTemp, 'value', 3000, 30000, 100).name('Temperature (K)'),
    'Peak blackbody temperature of the inner disk. Higher (≳10000K) = blue-white; ' +
      'lower (≈3000–6000K) = orange-red.',
  );
  tip(
    look.add(bh.scatterStrength, 'value', 0, 2, 0.05).name('Scattering'),
    'How much the dust catches and scatters the hot inner light. Higher = a softer, ' +
      'milkier glow through the gas; lower = pure heat emission.',
  );
  tip(
    look.add(bh.extinction, 'value', 0, 1, 0.01).name('Opacity (extinction)'),
    'How strongly the dust absorbs light passing through it (Beer–Lambert). Higher = ' +
      'darker, more solid overlaps; lower = translucent, light passes through.',
  );
  tip(
    look.add(renderer, 'toneMappingExposure', 0.1, 2, 0.05).name('Exposure'),
    'Overall brightness of the final image (camera exposure). Higher = brighter / ' +
      'more blown-out highlights; lower = darker, more detail in bright areas.',
  );
  tip(
    look.add(bh.doppler, 'value', { Off: 0, On: 1 }).name('Doppler beaming'),
    'Relativistic beaming: the side of the disk rotating toward you is brighter and ' +
      'bluer. ON = physically accurate (asymmetric); OFF = symmetric (Interstellar-style).',
  );
  tip(
    look.add(bh.redshift, 'value', { Off: 0, On: 1 }).name('Gravitational redshift'),
    'Light climbing out of the gravity well loses energy (redder, dimmer) near the ' +
      'hole. ON = accurate; OFF = no inward reddening.',
  );

  const anim = gui.addFolder('Animation');
  tip(
    anim.add(bh.rotationSpeed, 'value', 0, 20, 0.5).name('Rotation speed'),
    'How fast the disk visibly churns (multiplies the Keplerian rate). Higher = faster ' +
      'swirl; inner gas always outpaces outer either way.',
  );
  tip(
    anim.add(bh.turbAmount, 'value', 0, 2, 0.05).name('Turbulence'),
    'Strength of the turbulent filaments/gaps in the dust. Higher = more wispy, ' +
      'mottled structure; 0 = a smooth disk.',
  );
  tip(
    anim.add(bh.turbScale, 'value', 0.05, 1, 0.01).name('Turbulence scale'),
    'Spatial frequency of the turbulence. Higher = finer, smaller-scale detail; lower = ' +
      'large, soft billows.',
  );
  tip(
    anim.add(bh.infallRate, 'value', 0, 1, 0.01).name('Infall'),
    'How quickly dust spirals inward over time. Higher = faster inward drift; 0 = no ' +
      'net infall.',
  );
  tip(
    anim.add(bh.churnRate, 'value', 0, 1, 0.01).name('Churn'),
    'How fast the turbulence pattern evolves/morphs over time. Higher = more restless ' +
      'boiling; lower = a more frozen, slowly-shearing pattern.',
  );

  const post = gui.addFolder('Bloom');
  tip(
    post.add(bloom.strength, 'value', 0, 2, 0.02).name('Strength'),
    'Intensity of the HDR glow bleeding off bright areas. Higher = dreamier, more ' +
      'bloom; 0 = off (crisp).',
  );
  tip(
    post.add(bloom.radius, 'value', 0, 1, 0.02).name('Radius'),
    'How far the glow spreads. Higher = wider, softer halo; lower = tight glow.',
  );
  tip(
    post.add(bloom.threshold, 'value', 0, 2, 0.02).name('Threshold'),
    'Brightness above which things bloom. Higher = only the very brightest spots glow; ' +
      'lower = more of the image blooms.',
  );

  const quality = gui.addFolder('Quality');
  const qProxy = { tier: 'Auto' };
  tip(
    quality
      .add(qProxy, 'tier', ['Auto', 'Low', 'Medium', 'High'])
      .name('Quality')
      .onChange((v: string) => {
        applyQuality(v === 'Auto' ? autoTier : (v.toLowerCase() as QualityTier));
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }),
    'Overall performance vs. fidelity. Auto picks a tier for your device on load; Low is ' +
      'lightest (best for phones), High is sharpest. It sets the starting resolution, the dust ' +
      'step, and the pixel-ratio cap — the controls below fine-tune them.',
  );
  tip(
    quality.add(scaler, 'enabled').name('Auto resolution'),
    'Automatically lower the render resolution to hold a smooth frame rate, then raise ' +
      'it when there is headroom. Off = always render at full resolution.',
  );
  tip(
    quality.add(scaler, 'targetFps', 30, 60, 1).name('Target FPS'),
    'The frame rate auto-resolution aims to hold. Lower = it drops resolution sooner to stay ' +
      'smooth on slower devices; higher = sharper but may stutter. 50 is a good balance.',
  );
  tip(
    quality.add(scaler, 'minScale', 0.3, 1, 0.05).name('Min resolution'),
    'Lowest resolution auto-scaling may drop to. Lower = smoother but softer when busy; ' +
      'higher = always sharper but may drop frames.',
  );
  tip(
    quality.add(bh.volumeStep, 'value', 0.1, 0.6, 0.01).name('Volume step (perf)'),
    'Sampling step through the dust. Higher = faster but coarser/banded; lower = smoother ' +
      'volume but slower.',
  );

  // Everything revealed by the Advanced toggle: GPU/FPS/Pause/Step/Click-outside
  // first, then the deeper tuning folders.
  const advanced: Array<{ show(): unknown; hide(): unknown }> = [
    gpuCtrl,
    fpsCtrl,
    pauseCtrl,
    stepCtrl,
    tapOutsideCtrl,
    look,
    anim,
    post,
    quality,
  ];
  const applyAdvanced = (on: boolean): void => {
    advanced.forEach((x) => (on ? x.show() : x.hide()));
  };
  applyAdvanced(prefs.advanced);
  advCtrl.onChange((v: boolean) => {
    applyAdvanced(v);
    savePrefs(prefs);
  });
  tip(advCtrl, 'Reveal GPU physics, Display FPS, Pause/Step, and the deeper tuning folders. Remembered for next time.');

  // Version chip pinned above the folders; start collapsed.
  gui.$children.prepend(createVersionBadge(VERSION));
  gui.close();

  // Long-press on a row shows its tooltip on touch devices (no native hover).
  attachTouchTooltips(gui.domElement);

  // Collapse the panel when the user clicks/taps the scene outside it (default on).
  document.addEventListener('pointerdown', (e) => {
    if (!prefs.tapOutsideClose) return;
    if (gui.domElement.contains(e.target as Node)) return;
    gui.close();
  });

  return gui;
}
