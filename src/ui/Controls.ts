import GUI from 'lil-gui';
import type BloomNode from 'three/addons/tsl/display/BloomNode.js';
import type { WebGPURenderer } from 'three/webgpu';
import { VERSION } from '../version';
import type { Loop } from '../core/Loop';
import type { ResolutionScaler } from '../core/ResolutionScaler';
import { MAX_BODIES } from '../render/bodyUniforms';
import type { BlackHole } from '../scene/BlackHole';
import type { Scene } from '../scene/Scene';
import { PRESETS } from './presets';
import { createVersionBadge } from './versionBadge';

/**
 * The lil-gui control panel. Controllers bind straight to the uniform `.value`
 * fields (and a couple of engine objects), so moving a slider updates the live
 * render with no plumbing. Folders: Look, Animation, Quality — plus presets.
 */
export function createControls(ctx: {
  blackHole: BlackHole;
  scene: Scene;
  loop: Loop;
  renderer: WebGPURenderer;
  scaler: ResolutionScaler;
  bloom: BloomNode;
}): GUI {
  const { blackHole: bh, scene, loop, renderer, scaler, bloom } = ctx;
  const gui = new GUI({ title: 'One Still Point' });

  const proxy = { preset: 'Physical' };
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
    });

  const look = gui.addFolder('Look');
  look.add(bh.emissiveStrength, 'value', 0, 2, 0.01).name('Disk brightness');
  look.add(bh.diskDensity, 'value', 0, 3, 0.05).name('Density');
  look.add(bh.diskTemp, 'value', 3000, 30000, 100).name('Temperature (K)');
  look.add(bh.scatterStrength, 'value', 0, 2, 0.05).name('Scattering');
  look.add(bh.extinction, 'value', 0, 1, 0.01).name('Opacity (extinction)');
  look.add(renderer, 'toneMappingExposure', 0.1, 2, 0.05).name('Exposure');
  look.add(bh.doppler, 'value', { Off: 0, On: 1 }).name('Doppler beaming');
  look.add(bh.redshift, 'value', { Off: 0, On: 1 }).name('Gravitational redshift');

  const anim = gui.addFolder('Animation');
  anim.add(loop, 'paused').name('Pause');
  anim.add(bh.rotationSpeed, 'value', 0, 20, 0.5).name('Rotation speed');
  anim.add(bh.turbAmount, 'value', 0, 2, 0.05).name('Turbulence');
  anim.add(bh.turbScale, 'value', 0.05, 1, 0.01).name('Turbulence scale');
  anim.add(bh.infallRate, 'value', 0, 1, 0.01).name('Infall');
  anim.add(bh.churnRate, 'value', 0, 1, 0.01).name('Churn');

  const post = gui.addFolder('Bloom');
  post.add(bloom.strength, 'value', 0, 2, 0.02).name('Strength');
  post.add(bloom.radius, 'value', 0, 1, 0.02).name('Radius');
  post.add(bloom.threshold, 'value', 0, 2, 0.02).name('Threshold');

  const bodies = gui.addFolder('Bodies');
  const actions = {
    addStar: () => {
      if (scene.companions.length < MAX_BODIES) scene.addStar();
    },
    addPlanet: () => {
      if (scene.companions.length < MAX_BODIES) scene.addPlanet();
    },
    addBlackHole: () => {
      if (scene.companions.length < MAX_BODIES) scene.addBlackHole();
    },
    clear: () => scene.clearCompanions(),
    timeScale: scene.physics.timeScale,
  };
  bodies.add(actions, 'addStar').name(`Add star (max ${MAX_BODIES})`);
  bodies.add(actions, 'addPlanet').name('Add planet');
  bodies.add(actions, 'addBlackHole').name('Add black hole (lenses light)');
  bodies.add(actions, 'clear').name('Clear companions');
  bodies
    .add(actions, 'timeScale', 0, 300, 1)
    .name('Orbit speed')
    .onChange((v: number) => {
      scene.physics.timeScale = v;
    });

  const quality = gui.addFolder('Quality');
  quality.add(scaler, 'enabled').name('Auto resolution');
  quality.add(scaler, 'minScale', 0.3, 1, 0.05).name('Min resolution');
  quality.add(bh.volumeStep, 'value', 0.1, 0.6, 0.01).name('Volume step (perf)');

  // Version chip pinned above the folders; start collapsed.
  gui.$children.prepend(createVersionBadge(VERSION));
  gui.close();

  return gui;
}
