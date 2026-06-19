/**
 * Named looks. Presets deliberately toggle *physical* effects on and off (e.g.
 * Interstellar turns Doppler beaming off for the symmetric, art-directed disk),
 * so the panel doubles as an A/B of what's real versus stylised.
 */
export interface Preset {
  emissiveStrength: number;
  diskDensity: number;
  diskTemp: number;
  scatterStrength: number;
  extinction: number;
  doppler: number; // 0 or 1
  redshift: number; // 0 or 1
  turbAmount: number;
  rotationSpeed: number;
  exposure: number;
}

export const PRESETS: Record<string, Preset> = {
  // Physically accurate: full beaming + redshift, hot inner disk.
  Physical: {
    emissiveStrength: 2.5, diskDensity: 1.0, diskTemp: 15000, scatterStrength: 0.2,
    extinction: 0.25, doppler: 1, redshift: 1, turbAmount: 0.9, rotationSpeed: 6, exposure: 1.0,
  },
  // EHT-style orange photon-ring look (cooler, smoother).
  EHT: {
    emissiveStrength: 3.0, diskDensity: 1.2, diskTemp: 9000, scatterStrength: 0.15,
    extinction: 0.3, doppler: 1, redshift: 1, turbAmount: 0.7, rotationSpeed: 5, exposure: 1.1,
  },
  // Interstellar: symmetric, stylised — Doppler beaming OFF.
  Interstellar: {
    emissiveStrength: 2.2, diskDensity: 1.1, diskTemp: 11000, scatterStrength: 0.3,
    extinction: 0.2, doppler: 0, redshift: 1, turbAmount: 0.6, rotationSpeed: 4, exposure: 1.0,
  },
  // Stylised: punchy, hot, turbulent.
  Stylized: {
    emissiveStrength: 4.0, diskDensity: 1.4, diskTemp: 18000, scatterStrength: 0.5,
    extinction: 0.2, doppler: 1, redshift: 1, turbAmount: 1.2, rotationSpeed: 9, exposure: 1.2,
  },
};
