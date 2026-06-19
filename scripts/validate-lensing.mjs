// Validates the weak-field light-deflection coefficient used for secondary
// masses (raymarch.ts totalAccel). A photon passing a point mass m at impact
// parameter b should bend by the GR angle α = 4Gm/b — twice the Newtonian value
// — which is what the acceleration a = -2·G·m·(x − x_b)/|x − x_b|³ reproduces
// when integrated along the path. Run: node scripts/validate-lensing.mjs

const G = 1;

// Acceleration on a photon from a single mass m at the origin (weak-field, ×2).
const accel = (p, m) => {
  const r2 = p[0] ** 2 + p[1] ** 2 + p[2] ** 2;
  const invR3 = 1 / (Math.sqrt(r2) * r2);
  return [-2 * G * m * p[0] * invR3, -2 * G * m * p[1] * invR3, -2 * G * m * p[2] * invR3];
};

function deflection(m, b) {
  // Photon starts far to the left at height b, moving in +x at unit speed.
  let p = [-4000, b, 0];
  let v = [1, 0, 0];
  let a = accel(p, m);
  const dt = 0.02;
  for (let i = 0; i < 400000 && p[0] < 4000; i++) {
    for (let k = 0; k < 3; k++) {
      v[k] += a[k] * dt * 0.5;
      p[k] += v[k] * dt;
    }
    a = accel(p, m);
    for (let k = 0; k < 3; k++) v[k] += a[k] * dt * 0.5;
  }
  // Total turn of the velocity from +x.
  return Math.atan2(-v[1], v[0]); // bent toward the mass (−y)
}

console.log('Weak-field light deflection (expect α ≈ 4Gm/b)\n');
for (const [m, b] of [
  [1, 40],
  [1, 80],
  [0.4, 30],
]) {
  const measured = deflection(m, b);
  const expected = (4 * G * m) / b;
  const errPct = (100 * (measured - expected)) / expected;
  console.log(
    `  m=${m}, b=${b}: α=${measured.toFixed(5)} rad  expected ${expected.toFixed(5)}  ` +
      `(${errPct >= 0 ? '+' : ''}${errPct.toFixed(2)}%) → ${Math.abs(errPct) < 3 ? 'OK' : 'FAIL'}`,
  );
}
