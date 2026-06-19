// Sanity check for the N-body integrator (src/physics). A test particle placed
// on a circular orbit around the fixed primary should keep a near-constant
// radius over many orbits, and velocity-Verlet (symplectic) should conserve
// energy to a tiny bounded error. Run: node scripts/validate-orbit.mjs

const G = 1;
const M = 1; // primary mass
const SOFT2 = 0.25; // matches integrators.ts

const accel = (p) => {
  const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2] + SOFT2;
  const invR3 = 1 / (Math.sqrt(r2) * r2);
  return [-G * M * p[0] * invR3, -G * M * p[1] * invR3, -G * M * p[2] * invR3];
};

const energy = (p, v) =>
  0.5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - (G * M) / Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2);

function run(r) {
  const p = [r, 0, 0];
  const v = [0, 0, Math.sqrt((G * M) / r)]; // circular speed, perpendicular
  let a = accel(p);

  const e0 = energy(p, v);
  let rmin = Infinity;
  let rmax = 0;

  const dt = 0.05;
  const period = 2 * Math.PI * Math.sqrt(r ** 3 / (G * M));
  const steps = Math.round((period * 10) / dt); // 10 orbits

  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < 3; k++) {
      v[k] += a[k] * dt * 0.5;
      p[k] += v[k] * dt;
    }
    a = accel(p);
    for (let k = 0; k < 3; k++) v[k] += a[k] * dt * 0.5;

    const rr = Math.hypot(p[0], p[1], p[2]);
    rmin = Math.min(rmin, rr);
    rmax = Math.max(rmax, rr);
  }

  const drift = Math.abs((energy(p, v) - e0) / e0);
  const ok = rmax - rmin < 0.05 * r && drift < 1e-3;
  console.log(
    `  r=${String(r).padStart(3)}: radius ∈ [${rmin.toFixed(3)}, ${rmax.toFixed(3)}] ` +
      `(period ${period.toFixed(0)}), energy drift ${(drift * 100).toExponential(2)}% → ${ok ? 'OK' : 'FAIL'}`,
  );
}

console.log('N-body velocity-Verlet: circular orbits over 10 periods\n');
for (const r of [20, 30, 42]) run(r);
