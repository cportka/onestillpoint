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
import { bodyCap, type Scene } from '../scene/Scene';
import type { Hud } from './hud';
import { createAboutButton } from './about';
import { loadPrefs, savePrefs } from './prefs';
import { PRESETS } from './presets';
import { createStepper, type Stepper } from './stepper';
import { attachTouchTooltips } from './touchTooltips';
import { createVersionBadge } from './versionBadge';

/** Attach a native hover tooltip to a controller's row. */
function tip<T extends Controller>(controller: T, text: string): T {
  controller.domElement.title = text;
  return controller;
}

/**
 * The lil-gui control panel. Expanded, it leads with the essentials —
 * About/version · Filter · Speed · Bodies (± steppers) · Replay · Pause · an
 * Advanced-settings toggle — and folds the deep tuning (GPU, FPS, Step, and the
 * Look / Animation / Bloom / Quality folders, each starting collapsed) behind that
 * toggle, whose state is remembered. Every row has a hover tooltip (long-press on touch).
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
  background: { value: number };
  bgLook: { brightness: { value: number }; saturation: { value: number }; tint: { value: number } };
}): GUI {
  const { blackHole: bh, scene, physics, time, formation, backend, renderer, scaler, bloom } = ctx;
  const { hud, autoTier, applyQuality, background, bgLook } = ctx;
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

  // --- Background (the sky behind everything; it lenses around the holes too) ---
  const BACKGROUNDS = ['Stars', 'Nebula', 'Filaments', 'Lattice'];
  const bgProxy = { sky: BACKGROUNDS[background.value] ?? 'Stars' };
  tip(
    gui.add(bgProxy, 'sky', BACKGROUNDS).name('Background').onChange((v: string) => {
      background.value = Math.max(0, BACKGROUNDS.indexOf(v));
    }),
    'The sky behind the hole — it lenses around the shadow either way. Stars = the default ' +
      'star field; Nebula = a glowing Eagle-palette gas cloud; Filaments = a monochrome cosmic ' +
      'web; Lattice = a spacetime grid that visibly warps near the holes.',
  );

  // --- Speed (its own line — no longer wrapped in a single-child Time folder) ---
  const speedProxy = { exp: 0 };
  const fmtScale = (s: number): string => {
    if (s >= 1e6) return `${(s / 1e6).toFixed(1)}M`;
    if (s >= 1e3) return `${(s / 1e3).toFixed(1)}k`;
    if (s >= 1) return `${Math.round(s)}`;
    return `1/${Math.round(1 / s)}`; // slow-motion: ×1/10 … ×1/1000
  };
  // exp is log10(timeScale): −3 → ×1/1000 (slow-mo) up to 6 → ×1,000,000.
  const speedCtrl = gui.add(speedProxy, 'exp', -3, 6, 0.05).name('Speed ×1');
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

  // --- Bodies (− N + steppers; how many black holes orbit caps the rest) ---
  const bodies = gui.addFolder('Bodies');
  const countOf = (type: BodyType): number => scene.companions.filter((b) => b.type === type).length;
  // A 4th black hole is only allowed when nothing else orbits, so the hole cap
  // also depends on the star + planet count (not just the hole count).
  const capFor = (type: BodyType): number => bodyCap(type, countOf('hole'), countOf('star') + countOf('planet'));
  const steppers: Stepper[] = [];
  const refreshAll = (): void => steppers.forEach((s) => s.refresh());
  // De-bounce adds (rapid-fire adds are what crowd the scene into the close
  // encounters that misbehave): half a second for stars/planets, a full second
  // for the heavier black holes. The + buttons grey out for the cooldown, then a
  // scheduled refresh re-enables them.
  const cooldownMs = (type: BodyType): number => (type === 'hole' ? 1000 : 500);
  let addReadyAt = 0;
  const addStepper = (type: BodyType, label: string, add: () => void): void => {
    const noun = label.toLowerCase().replace(/s$/, '');
    const stepper = createStepper({
      label,
      count: () => countOf(type),
      canInc: () =>
        performance.now() >= addReadyAt && countOf(type) < capFor(type) && scene.companions.length < MAX_BODIES,
      // − is blocked while a removal is still plunging in, so removals queue one
      // at a time (each plays its full collision animation before the next).
      canDec: () => countOf(type) > 0 && !scene.removing,
      onInc: () => {
        add();
        physics.syncBodies();
        const cd = cooldownMs(type);
        addReadyAt = performance.now() + cd;
        refreshAll(); // a new hole can lower the star/planet caps; also greys + for the cooldown
        window.setTimeout(refreshAll, cd); // re-enable + when the cooldown is up
      },
      onDec: () => {
        // Begins the plunge animation; the body (and the GPU buffers) are freed
        // when it lands, via prune → onChange → refreshAll.
        scene.removeOne(type);
        refreshAll();
      },
      incTip: `Add a ${noun}`,
      decTip: `Remove a ${noun}`,
    });
    steppers.push(stepper);
    bodies.$children.appendChild(stepper.row);
  };
  addStepper('star', 'Stars', () => scene.addStar());
  addStepper('planet', 'Planets', () => scene.addPlanet());
  addStepper('hole', 'Black holes', () => scene.addBlackHole());
  scene.onChange = refreshAll; // keep the counts live when bodies escape / merge

  const actions = {
    clear: () => {
      scene.clearCompanions();
      physics.syncBodies();
      refreshAll();
    },
    gpu: false, // CPU integrator by default — exact and faster for these counts (see main.ts)
  };
  tip(bodies.add(actions, 'clear').name('Clear companions'), 'Remove all added bodies and restore the default orbits.');

  // --- Replay intro (re-seed the current line-up on fresh orbits, then replay) ---
  tip(
    gui
      .add(
        {
          replay: () => {
            scene.reseed(); // fresh orbits for the current composition
            physics.syncBodies(); // rebuild GPU buffers for the new bodies
            refreshAll(); // update counts + ± limits
            formation.restart();
          },
        },
        'replay',
      )
      .name('Replay intro'),
    'Replay the formation intro with the current bodies — re-seeded onto fresh orbits, so it ' +
      'looks like a clean page-load for the same line-up (identical for the default 3 + 3).',
  );

  // --- Pause + Step (last basic controls, right before the Advanced toggle) ---
  // Pause is a proper toggle button that shows its own state (label + a lit
  // "pressed" style when paused), not a checkbox. A lil-gui function controller
  // calls its function on click, so route it through a mutable callback.
  let onPauseClick = (): void => {};
  const pauseCtrl = gui.add({ toggle: () => onPauseClick() }, 'toggle');
  const refreshPause = (): void => {
    pauseCtrl.name(time.paused ? '▶  Resume' : '⏸  Pause');
    pauseCtrl.domElement.classList.toggle('osp-paused', time.paused);
  };
  onPauseClick = (): void => {
    time.paused = !time.paused;
    refreshPause();
  };
  pauseCtrl.domElement.classList.add('osp-pausebtn');
  refreshPause();
  tip(pauseCtrl, 'Freeze time to inspect the lensing on a still frame. Click again to resume.');
  tip(
    gui.add({ step: () => time.step() }, 'step').name('Step'),
    'Advance time. Paused: one frame at the current Speed. Running: a ~1-second jump forward ' +
      '(at least 20 frames) at the current Speed.',
  );

  // --- Advanced settings toggle (remembered across sessions) ---
  const advCtrl = gui.add(prefs, 'advanced').name('Advanced settings');
  advCtrl.domElement.classList.add('osp-section'); // bold label + a stronger divider

  // --- Advanced, in order: GPU physics, Display FPS, Step, Click-outside, then tuning ---
  const gpuAvailable = backend === 'webgpu';
  const gpuCtrl = gui.add(actions, 'gpu').name('GPU physics').onChange((v: boolean) => {
    physics.setGPU(v);
  });
  if (!gpuAvailable) gpuCtrl.disable();
  tip(
    gpuCtrl,
    gpuAvailable
      ? 'Run the N-body simulation on the GPU (WebGPU compute). Off by default — for these body ' +
          'counts the CPU integrator is exact and actually faster (the GPU path adds a per-frame ' +
          'read-back). It is the scaling foundation for many bodies, not a win for a handful.'
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

  // Background look: a few knobs that post-process whichever sky is selected.
  const bgFolder = gui.addFolder('Background');
  tip(
    bgFolder.add(bgLook.brightness, 'value', 0, 2, 0.01).name('Brightness'),
    'Overall brightness of the selected background sky.',
  );
  tip(
    bgFolder.add(bgLook.saturation, 'value', 0, 2, 0.01).name('Saturation'),
    'Colour intensity of the background. 0 = greyscale, 1 = as-authored, higher = punchier.',
  );
  tip(
    bgFolder.add(bgLook.tint, 'value', -0.5, 0.5, 0.01).name('Tint (cool–warm)'),
    'Shift the background cooler (−, bluer) or warmer (+, redder).',
  );

  // Each tuning folder starts collapsed when Advanced is first shown.
  [look, anim, post, quality, bgFolder].forEach((f) => f.close());

  // Everything revealed by the Advanced toggle: GPU / FPS / Click-outside first,
  // then the deeper tuning folders.
  const advanced: Array<{ show(): unknown; hide(): unknown }> = [
    gpuCtrl,
    fpsCtrl,
    tapOutsideCtrl,
    look,
    anim,
    post,
    quality,
    bgFolder,
  ];
  const applyAdvanced = (on: boolean): void => {
    advanced.forEach((x) => (on ? x.show() : x.hide()));
  };
  applyAdvanced(prefs.advanced);
  advCtrl.onChange((v: boolean) => {
    applyAdvanced(v);
    savePrefs(prefs);
  });
  tip(advCtrl, 'Reveal GPU physics, Display FPS, and the deeper tuning folders. Remembered for next time.');

  // Top row — About button + click-to-copy version chip — pinned above the
  // folders; the panel starts collapsed.
  const topRow = document.createElement('div');
  topRow.className = 'osp-toprow';
  topRow.append(createAboutButton(), createVersionBadge(VERSION));
  gui.$children.prepend(topRow);
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
