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

const BAR_HALF_LENGTH = 110; // ~11,000 ly
// The bar points ~27° away from the Sun–center line
const BAR_ANGLE = Math.atan2(SUN_GALAXY_POSITION[1], SUN_GALAXY_POSITION[0]) - (27 * Math.PI) / 180;

/** Share of stars per component (the rest is the halo) */
const SHARE = { bulge: 0.05, bar: 0.08, arms: 0.47, disk: 0.25 };

export function generateGalaxy(): GalaxyData {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    let x: number, y: number, z: number;
    let r: number, g: number, b: number;
    let size = 0.2 + Math.random() ** 2 * 0.5;

    const roll = Math.random();

    if (roll < SHARE.bulge) {
      // === BULGE — round, old, warm stars ===
      const dist = Math.abs(gaussRandom()) * BULGE_RADIUS;
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = Math.random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      x = dist * sinTheta * Math.cos(phi);
      y = dist * sinTheta * Math.sin(phi);
      z = dist * cosTheta * (BULGE_HEIGHT_SIGMA / BULGE_RADIUS);
      r = 1.0;
      g = 0.78 + Math.random() * 0.1;
      b = 0.5 + Math.random() * 0.1;
      size += 0.1;
    } else if (roll < SHARE.bulge + SHARE.bar) {
      // === BAR — elongated through the center ===
      const along = gaussRandom() * BAR_HALF_LENGTH * 0.5;
      const across = gaussRandom() * BAR_HALF_LENGTH * 0.16;
      x = along * Math.cos(BAR_ANGLE) - across * Math.sin(BAR_ANGLE);
      y = along * Math.sin(BAR_ANGLE) + across * Math.cos(BAR_ANGLE);
      z = gaussRandom() * 10;
      r = 1.0;
      g = 0.75 + Math.random() * 0.12;
      b = 0.45 + Math.random() * 0.12;
    } else if (roll < SHARE.bulge + SHARE.bar + SHARE.arms) {
      // === ARMS — log spirals starting from the bar's ends ===
      const armIndex = Math.floor(Math.random() * ARMS);
      const distance = BAR_HALF_LENGTH * 0.6 + Math.random() ** 0.85 * (GALAXY_RADIUS - BAR_HALF_LENGTH * 0.6);
      const theta = Math.log(distance / 20) / PITCH;
      const armAngle = theta + armIndex * ARM_ANGLE_OFFSET;

      // Tight core, soft edges
      const scatter = gaussRandom() * (10 + distance * 0.05) + gaussRandom() * 6;
      const angle = armAngle + scatter / distance;

      x = distance * Math.cos(angle);
      y = distance * Math.sin(angle);
      z = gaussRandom() * DISK_HEIGHT_SIGMA * 0.8;

      // Young blue-white stars along the arms, with pink star-forming knots
      const armStrength = Math.exp(-(scatter * scatter) / (2 * 18 * 18));
      if (Math.random() < 0.03 * armStrength) {
        r = 1.0;
        g = 0.45;
        b = 0.7;
        size += 0.35;
      } else {
        r = 0.62 + (1 - armStrength) * 0.3;
        g = 0.74 + armStrength * 0.16;
        b = 0.88 + armStrength * 0.12;
      }
    } else if (roll < SHARE.bulge + SHARE.bar + SHARE.arms + SHARE.disk) {
      // === DISK between the arms — exponential falloff ===
      const distance = 20 - Math.log(1 - Math.random() * 0.98) * 140;
      const angle = Math.random() * Math.PI * 2;
      x = distance * Math.cos(angle);
      y = distance * Math.sin(angle);
      z = gaussRandom() * DISK_HEIGHT_SIGMA * 1.3;
      r = 0.85 + Math.random() * 0.15;
      g = 0.78 + Math.random() * 0.12;
      b = 0.62 + Math.random() * 0.2;
    } else {
      // === HALO — fills the sky in all directions ===
      const dist = Math.abs(gaussRandom()) * GALAXY_RADIUS * 0.8;
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = Math.random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      x = dist * sinTheta * Math.cos(phi);
      y = dist * sinTheta * Math.sin(phi);
      z = dist * cosTheta * 0.3;
      r = 0.9;
      g = 0.65 + Math.random() * 0.2;
      b = 0.45 + Math.random() * 0.15;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;
    sizes[i] = size;
    phases[i] = Math.random() * Math.PI * 2;
  }

  return { positions, colors, sizes, phases };
}
