import { CELESTIAL_BODIES, SCALE_SIZE } from "../data";

interface EarthUnitSizeProps {
  size: number;
}

interface ScaleDistanceProps {
  distance: number;
  scale: number;
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

export function ScaleDistance({ distance, scale }: ScaleDistanceProps) {
  const earth = CELESTIAL_BODIES.find(
    (body) => body.name === "Sun"
  )?.children.find((planet) => planet.name === "Earth");
  if (!earth) throw new Error("Earth not found");
  const scaledDistance = distance / scale / earth.radius;
  return scaledDistance;
}
