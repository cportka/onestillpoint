// Numerical sanity checks for the static accretion-disk physics used by the
// shader (src/render/tsl/disk.ts). Run with:
//
//     node scripts/validate-disk.mjs
//
// Geometric units G = c = 1, M = 1. ISCO (disk inner edge) = 6M.

const M = 1.0;
const RISCO = 6 * M;

// Local Keplerian orbital speed of the gas: β = √(M/(r−2M)). Equals 0.5c at the
// ISCO (a textbook Schwarzschild result).
const beta = (r) => Math.sqrt(M / (r - 2 * M));

// Novikov–Thorne dimensionless flux ∝ T⁴: (1 − √(r_in/r)) / (r/r_in)³.
const flux = (r) => Math.max((1 - Math.sqrt(RISCO / r)) / Math.pow(r / RISCO, 3), 0);

const ok = (cond) => (cond ? 'OK' : 'FAIL');

console.log('Accretion-disk physics (M = 1, ISCO = 6M)\n');

const bIsco = beta(RISCO);
console.log(`orbital β at ISCO = ${bIsco.toFixed(4)} c   (expect 0.5000) → ${ok(Math.abs(bIsco - 0.5) < 1e-9)}`);
console.log(`flux at ISCO       = ${flux(RISCO).toFixed(6)}        (expect 0)      → ${ok(flux(RISCO) === 0)}`);

let best = 0;
let bestR = 0;
for (let r = RISCO; r < 60; r += 0.001) {
  const f = flux(r);
  if (f > best) {
    best = f;
    bestR = r;
  }
}
console.log(`flux peaks at r    = ${bestR.toFixed(2)} M  (value ${best.toFixed(5)})`);

// Relativistic beaming at the ISCO: gas moving straight at / away from us.
const g = 1 / Math.sqrt(1 - bIsco * bIsco);
const dApproach = 1 / (g * (1 - bIsco));
const dRecede = 1 / (g * (1 + bIsco));
console.log('\nDoppler beaming at the ISCO (I_obs ∝ δ⁴):');
console.log(`  approaching δ = ${dApproach.toFixed(3)} → ×${Math.pow(dApproach, 4).toFixed(1)} brightness, blueshift`);
console.log(`  receding    δ = ${dRecede.toFixed(3)} → ×${Math.pow(dRecede, 4).toFixed(2)} brightness, redshift`);
console.log(`  approaching/receding brightness ratio ≈ ${Math.pow(dApproach / dRecede, 4).toFixed(0)}×`);
