import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { ScaleEarthUnitSize } from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";
import { KM_PER_UNIT, EphemerisData } from "../../services/horizons";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computeBodyPosition(
  body: CelestialBody,
  positions: EphemerisData,
  scaleDistance: number
): THREE.Vector3 {
  const pos = positions[body.horizonsId];
  if (pos) {
    return new THREE.Vector3(
      pos.x / KM_PER_UNIT / scaleDistance,
      pos.y / KM_PER_UNIT / scaleDistance,
      pos.z / KM_PER_UNIT / scaleDistance
    );
  }

  // Fallback: static position along Z axis
  if (body.type === "star") return new THREE.Vector3(0, 0, 0);

  const fallbackZ =
    body.distanceFromParent / KM_PER_UNIT / scaleDistance +
    ScaleEarthUnitSize({ size: SOLAR_SYSTEM.radius }) +
    ScaleEarthUnitSize({ size: body.radius });
  return new THREE.Vector3(0, 0, fallbackZ);
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  const { positions } = useContext(EphemerisContext);

  const { camera } = useThree();

  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const animationDuration = useRef(1.5);
  const startPosition = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPosition = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const currentBodyRadius = useRef(0);
  const currentBodyPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !contextScaleDistance || !positions) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, positions, scaleDistance);
      const bodyRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      const cameraTarget = new THREE.Vector3(
        bodyPos.x,
        bodyPos.y + bodyRadius * 1.5,
        bodyPos.z - bodyRadius * 3
      );

      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000;
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(bodyPos);
      currentBodyRadius.current = bodyRadius;
      currentBodyPos.current.copy(bodyPos);

      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

      setFlyTo(null);
    }

    if (isAnimating.current) {
      animationProgress.current += delta / animationDuration.current;
      const rawT = Math.min(animationProgress.current, 1);
      const t = 1 - Math.pow(1 - rawT, 3);

      camera.position.lerpVectors(startPosition.current, endPosition.current, t);
      controls.target.lerpVectors(startTarget.current, endTarget.current, t);
      controls.update();

      if (rawT >= 1) {
        isAnimating.current = false;
        controls.enabled = true;
        controls.minDistance = currentBodyRadius.current * 1.5;
        controls.update();
      }
    }

    if (!isAnimating.current && currentBodyRadius.current > 0) {
      const distToBody = camera.position.distanceTo(currentBodyPos.current);
      if (distToBody > currentBodyRadius.current * 20) {
        controls.minDistance = 0;
        currentBodyRadius.current = 0;
      }
    }
  });

  return null;
}
