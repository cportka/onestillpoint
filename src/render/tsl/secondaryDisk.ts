import { cos, exp, float, length, max, normalize, pow, sin, smoothstep, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlackHole } from '../../scene/BlackHole';
import { blackbody } from './blackbody';
import { diskFlux } from './disk';
import { keplerOmega } from './flow';
import { fbm } from './turbulence';

/**
 * A compact volumetric accretion disk around a *secondary* black hole — the same
 * idea as the primary (radial envelope × thin-disk Gaussian × co-rotating,
 * inward-drifting turbulence, blackbody-coloured by the shared flux law) but
 * cheaper: it shares the look uniforms, scales with the hole's render radius, and
 * skips the per-sample relativistic beaming. Returns the density (for
 * Beer–Lambert extinction) and the emission already premultiplied by it.
 *
 * It is marched only where a ray actually crosses the (small) slab, so in
 * practice it costs one extra noise lookup on the few steps that graze it.
 */
export function secondaryDisk(
  p: Node<'vec3'>,
  center: Node<'vec3'>,
  radius: Node<'float'>,
  mass: Node<'float'>,
  time: Node<'float'>,
  timeBlur: Node<'float'>,
  bh: BlackHole,
): { density: Node<'float'>; emission: Node<'vec3'> } {
  const pl = p.sub(center);
  const rl = length(vec2(pl.x, pl.z)); // cylindrical radius about the hole
  const inner = radius.mul(1.7);
  const outer = radius.mul(5.5);
  const thick = radius.mul(0.4);

  const env = smoothstep(inner, inner.add(radius), rl).mul(smoothstep(outer, outer.sub(radius.mul(2)), rl));
  const yh = pl.y.div(thick);
  const vert = exp(yh.mul(yh).mul(-1)); // thin-disk Gaussian in height

  // Co-rotating turbulence: spin the sample into a frame turning at Ω(rl) so the
  // field shears into trailing arms, plus a slow inward drift (infall) and churn.
  const omega = keplerOmega(rl, mass).mul(time).mul(bh.rotationSpeed);
  const ca = cos(omega);
  const sa = sin(omega);
  const pr = vec3(pl.x.mul(ca).sub(pl.z.mul(sa)), pl.y, pl.x.mul(sa).add(pl.z.mul(ca)));
  const radialDir = normalize(vec3(pl.x, float(0), pl.z));
  const drift = radialDir.mul(bh.infallRate.mul(time)).add(vec3(float(0), bh.churnRate.mul(time), float(0)));
  const turb = fbm(pr.mul(bh.turbScale.mul(1.5)).add(drift));
  const amount = bh.turbAmount.mul(float(1).sub(timeBlur));
  const filaments = max(float(0), float(1).add(turb.mul(amount)));

  const density = env.mul(vert).mul(filaments).mul(bh.diskDensity);

  // Hot inner falloff via the shared flux law, blackbody-coloured. The ×4 stands
  // in for the beaming the primary gets per-sample (skipped here for speed).
  const temp = bh.diskTemp.mul(pow(diskFlux(rl, inner), float(0.25)));
  const emission = blackbody(temp).mul(bh.emissiveStrength.mul(4)).mul(density);

  return { density, emission };
}
