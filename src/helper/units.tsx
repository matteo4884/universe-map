import { CELESTIAL_BODIES, SCALE_SIZE } from "../data";

export const KM_PER_UNIT = 6371; // 1 Three.js unit = 1 Earth radius

export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

interface EarthUnitSizeProps {
  size: number;
}

export function ScaleEarthUnitSize({ size }: EarthUnitSizeProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "Sun"
  )?.children.find((planet) => planet.name === "Earth");

  if (!earth) throw new Error("Earth not found");
  const SizeCompareToEarth = size / earth.radius;

  if (SCALE_SIZE > 1) {
    const SizeScaled =
      SizeCompareToEarth > 1
        ? SizeCompareToEarth / SCALE_SIZE
        : SizeCompareToEarth + (1 - SizeCompareToEarth) * (SCALE_SIZE / 10);
    return SizeScaled;
  } else if (SCALE_SIZE === 1) {
    return SizeCompareToEarth;
  } else {
    throw new Error("'scale' cannot be lower than 1");
  }
}
