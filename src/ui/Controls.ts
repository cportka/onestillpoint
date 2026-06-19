import GUI, { type Controller } from 'lil-gui';
import type BloomNode from 'three/addons/tsl/display/BloomNode.js';
import type { WebGPURenderer } from 'three/webgpu';
import { VERSION } from '../version';
import type { ResolutionScaler } from '../core/ResolutionScaler';
import type { TimeController } from '../core/TimeController';
import type { PhysicsController } from '../physics/PhysicsController';
import { MAX_BODIES } from '../render/bodyUniforms';
import type { BlackHole } from '../scene/BlackHole';
import type { Scene } from '../scene/Scene';
import { PRESETS } from './presets';
import { createVersionBadge } from './versionBadge';

/** Attach a native hover tooltip to a controller's row. */
function tip<T extends Controller>(controller: T, text: string): T {
  controller.domElement.title = text;
  return controller;
}

/**
 * The lil-gui control panel. Controllers bind straight to the live uniform
 * `.value` fields, and every row carries a hover tooltip explaining what it does
 * and which way to push it.
 */
export function createControls(ctx: {
  blackHole: BlackHole;
  scene: Scene;
  physics: PhysicsController;
  time: TimeController;
  renderer: WebGPURenderer;
  scaler: ResolutionScaler;
  bloom: BloomNode;
}): GUI {
  const { blackHole: bh, scene, physics, time, renderer, scaler, bloom } = ctx;
  const gui = new GUI({ title: 'One Still Point' });

  const timeFolder = gui.addFolder('Time');
  const timeProxy = { exp: 0 };
  const fmtScale = (s: number): string => {
    if (s >= 1e6) return `${(s / 1e6).toFixed(1)}M`;
    if (s >= 1e3) return `${(s / 1e3).toFixed(1)}k`;
    return `${Math.round(s)}`;
  };
  const speedCtrl = timeFolder.add(timeProxy, 'exp', 0, 6, 0.05).name('Speed ×1');
  speedCtrl.onChange((v: number) => {
    time.timeScale = Math.pow(10, v);
    speedCtrl.name(`Speed ×${fmtScale(time.timeScale)}`);
  });
  tip(
    speedCtrl,
    'How fast time runs — ×1 (real-time) up to ×1,000,000. As you speed up, the fine ' +
      'turbulence smoothly averages into a steady disk instead of strobing, and the orbits accelerate.',
  );
  tip(timeFolder.add(time, 'paused').name('Pause'), 'Freeze time — inspect the lensing on a still frame.');
  tip(
    timeFolder.add({ step: () => time.step() }, 'step').name('Step (when paused)'),
    'Advance a single frame while paused.',
  );

  const proxy = { preset: 'Physical' };
  tip(
    gui
      .add(proxy, 'preset', Object.keys(PRESETS))
      .name('Preset')
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
    'A named look. Physical = accurate (full beaming + redshift). EHT = cooler ' +
      'orange photon-ring look. Interstellar = symmetric, beaming OFF (stylised). ' +
      'Stylized = hot, punchy, turbulent. Presets toggle real physics on/off.',
  );

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

  const bodies = gui.addFolder('Bodies');
  const addBody = (fn: () => void) => () => {
    if (scene.companions.length < MAX_BODIES) {
      fn();
      physics.syncBodies();
    }
  };
  const actions = {
    addStar: addBody(() => scene.addStar()),
    addPlanet: addBody(() => scene.addPlanet()),
    addBlackHole: addBody(() => scene.addBlackHole()),
    clear: () => {
      scene.clearCompanions();
      physics.syncBodies();
    },
    gpu: false,
  };
  tip(bodies.add(actions, 'addStar').name(`Add star (max ${MAX_BODIES})`), 'Drop a bright star onto a circular orbit around the hole. It is lensed and occluded by the shadow as it passes behind.');
  tip(bodies.add(actions, 'addPlanet').name('Add planet'), 'Drop a small dim body onto an orbit.');
  tip(
    bodies.add(actions, 'addBlackHole').name('Add black hole'),
    'Drop in a massive dark companion that bends light around it (weak-field lensing) ' +
      'and gravitationally slings the other bodies. Costs extra GPU time while present.',
  );
  tip(bodies.add(actions, 'clear').name('Clear companions'), 'Remove all added bodies and restore the default orbits.');
  tip(
    bodies.add(actions, 'gpu').name('GPU physics').onChange((v: boolean) => {
      physics.setGPU(v);
    }),
    'Run the N-body simulation on the GPU (WebGPU compute) instead of the CPU. No ' +
      'visible change for a few bodies — it is the scaling path for many. CPU is the default.',
  );

  const quality = gui.addFolder('Quality');
  tip(
    quality.add(scaler, 'enabled').name('Auto resolution'),
    'Automatically lower the render resolution to hold a smooth frame rate, then raise ' +
      'it when there is headroom. Off = always render at full resolution.',
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

  // Version chip pinned above the folders; start collapsed.
  gui.$children.prepend(createVersionBadge(VERSION));
  gui.close();

  return gui;
}
