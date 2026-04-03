// Galaxy scale: 1 unit = 100 light-years
// Milky Way diameter ~1000 units (100,000 ly)
// Sun at ~260 units from center (26,000 ly)

const STAR_COUNT = 150000;
const ARMS = 4;
const ARM_ANGLE_OFFSET = (2 * Math.PI) / ARMS;
const PITCH = 0.2126; // tan(12°) — spiral pitch angle
const GALAXY_RADIUS = 500; // units (50,000 ly)
const BULGE_RADIUS = 60;
const DISK_HEIGHT_SIGMA = 25; // thicker disk — visible stars when looking up
const BULGE_HEIGHT_SIGMA = 40;

// Sun position in the Orion arm spur
export const SUN_GALAXY_POSITION: [number, number, number] = (() => {
  const r = 260; // 26,000 ly from center
  const armIndex = 3; // Orion arm (4th arm)
  const theta = Math.log(r / 20) / PITCH;
  const angle = theta + armIndex * ARM_ANGLE_OFFSET;
  return [r * Math.cos(angle), r * Math.sin(angle), 0];
})();

function gaussRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

export interface GalaxyData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
}

export function generateGalaxy(): GalaxyData {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    let x: number, y: number, z: number;
    let r: number, g: number, b: number;

    const roll = Math.random();

    if (roll < 0.04) {
      // === BULGE (4%) — spread out center ===
      const dist = (Math.abs(gaussRandom()) + Math.random() * 3) * BULGE_RADIUS * 1.5;
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = Math.random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      x = dist * sinTheta * Math.cos(phi);
      y = dist * sinTheta * Math.sin(phi);
      z = dist * cosTheta * (BULGE_HEIGHT_SIGMA / BULGE_RADIUS);

      r = 1.0;
      g = 0.7 + Math.random() * 0.2;
      b = 0.3 + Math.random() * 0.2;
    } else if (roll < 0.50) {
      // === ARMS (40%) — spiral structure, loosened scatter ===
      const armIndex = Math.floor(Math.random() * ARMS);
      const distance = 20 + Math.random() * (GALAXY_RADIUS - 20);
      const theta = Math.log(distance / 20) / PITCH;
      const armAngle = theta + armIndex * ARM_ANGLE_OFFSET;

      // Much wider scatter — softer arms
      const scatter = gaussRandom() * (30 + distance * 0.12);
      const angle = armAngle + scatter / distance;

      x = distance * Math.cos(angle);
      y = distance * Math.sin(angle);
      z = gaussRandom() * DISK_HEIGHT_SIGMA;

      // Blue/white in arms
      const armStrength = Math.exp(-(scatter * scatter) / (2 * 50 * 50));
      r = 0.6 + (1 - armStrength) * 0.3;
      g = 0.7 + armStrength * 0.2;
      b = 0.8 + armStrength * 0.2;
    } else if (roll < 0.8) {
      // === INTER-ARM DISK (25%) — uniform disk fill ===
      const distance = 15 + Math.random() * GALAXY_RADIUS;
      const angle = Math.random() * Math.PI * 2;

      x = distance * Math.cos(angle);
      y = distance * Math.sin(angle);
      z = gaussRandom() * DISK_HEIGHT_SIGMA * 1.5;

      // Mixed warm/neutral colors
      r = 0.7 + Math.random() * 0.25;
      g = 0.65 + Math.random() * 0.2;
      b = 0.5 + Math.random() * 0.25;
    } else {
      // === HALO (20%) — fills sky in all directions ===
      const dist = Math.abs(gaussRandom()) * GALAXY_RADIUS * 0.8;
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = Math.random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      x = dist * sinTheta * Math.cos(phi);
      y = dist * sinTheta * Math.sin(phi);
      z = dist * cosTheta * 0.3;

      r = 0.9;
      g = 0.6 + Math.random() * 0.2;
      b = 0.4 + Math.random() * 0.15;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;

    // Smaller sizes overall
    const sizeRoll = Math.random();
    sizes[i] = 0.1 + sizeRoll * sizeRoll * 0.4;

    phases[i] = Math.random() * Math.PI * 2;
  }

  return { positions, colors, sizes, phases };
}
