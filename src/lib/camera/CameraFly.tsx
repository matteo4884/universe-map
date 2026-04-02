import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TrackballControls as TrackballControlsImpl } from "three-stdlib";
import {
  CameraNavigationContext,
  ViewDirection,
} from "../../context/cameraNavigation";
import { ScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import {
  blendPosition,
  blendMoonPosition,
  blendRadius,
  KM_PER_UNIT,
} from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";
import { EphemerisData } from "../../services/horizons";

interface CameraFlyProps {
  controlsRef: React.RefObject<TrackballControlsImpl | null>;
}

// Neptune's semi-major axis — outermost planet, defines system extent
const NEPTUNE_DIST_KM = 4495000000;

function computeBodyPosition(
  body: CelestialBody,
  positions: EphemerisData,
  blend: number
): THREE.Vector3 {
  if (body.type === "star") return new THREE.Vector3(0, 0, 0);

  const pos = positions[body.horizonsId];

  if (body.type === "moon") {
    const parentPlanet = SOLAR_SYSTEM.children.find((p) =>
      p.children.some((m) => m.id === body.id && m.name === body.name)
    );
    if (parentPlanet) {
      const planetPos = positions[parentPlanet.horizonsId];
      const moonPos = pos;
      if (planetPos && moonPos) {
        const pp = blendPosition(planetPos.x, planetPos.y, planetPos.z, blend);
        const relX = moonPos.x - planetPos.x;
        const relY = moonPos.y - planetPos.y;
        const relZ = moonPos.z - planetPos.z;
        const mp = blendMoonPosition(relX, relY, relZ, blend);
        return new THREE.Vector3(
          pp[0] + mp[0],
          pp[1] + mp[1],
          pp[2] + mp[2]
        );
      }
    }
  }

  if (pos) {
    const p = blendPosition(pos.x, pos.y, pos.z, blend);
    return new THREE.Vector3(p[0], p[1], p[2]);
  }

  const fallbackZ =
    body.distanceFromParent / KM_PER_UNIT +
    blendRadius(SOLAR_SYSTEM.radius, blend);
  return new THREE.Vector3(0, 0, fallbackZ);
}

/**
 * Camera lands on the Sun–body line, between the two.
 * Always shows the sunlit hemisphere.
 */
function computeCameraLanding(
  bodyPos: THREE.Vector3,
  bodyRadius: number
): THREE.Vector3 {
  const dist = Math.max(bodyRadius * 4, 5);

  const len = bodyPos.length();
  if (len < 0.01) {
    // Sun itself — approach from a default direction
    return new THREE.Vector3(dist, 0, 0);
  }

  // Unit vector from planet toward Sun (origin)
  const dirToSun = bodyPos.clone().negate().normalize();

  // Place camera between planet and Sun
  return bodyPos.clone().addScaledVector(dirToSun, dist);
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const scaleCtx = useContext(ScaleContext);
  const { positions } = useContext(EphemerisContext);

  const { camera } = useThree();

  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const animationDuration = useRef(1.5);
  const startPosition = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPosition = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const startUp = useRef(new THREE.Vector3());
  const endUp = useRef(new THREE.Vector3());
  const currentBodyRadius = useRef(0);
  const currentBodyPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !scaleCtx || !positions) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo, viewSnap, setViewSnap } = cameraNav;
    const { blend } = scaleCtx;

    // Handle view snap — fixed positions that scale with blend
    if (viewSnap && !isAnimating.current) {
      const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, blend);
      const viewDist = Math.abs(nx) * 1.4;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      startUp.current.copy(camera.up);
      endTarget.current.set(0, 0, 0);

      if (viewSnap === "top") {
        endPosition.current.set(0, 0, viewDist);
        endUp.current.set(0, -1, 0);
      } else {
        endPosition.current.set(0, viewDist, 0);
        endUp.current.set(0, 0, 1);
      }

      animationDuration.current = 1.0;
      animationProgress.current = 0;
      isAnimating.current = true;
      currentBodyRadius.current = 0;
      controls.enabled = false;

      setViewSnap(null);
    }

    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, positions, blend);
      const bodyRadius = blendRadius(flyTo.radius, blend);

      const cameraLanding = computeCameraLanding(bodyPos, bodyRadius);

      const flyDist = camera.position.distanceTo(cameraLanding);
      const maxDist = 500000;
      const t = Math.min(flyDist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      startUp.current.copy(camera.up);
      endPosition.current.copy(cameraLanding);
      endTarget.current.copy(bodyPos);
      endUp.current.set(0, 0, 1); // Ecliptic north always up
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

      camera.position.lerpVectors(
        startPosition.current,
        endPosition.current,
        t
      );
      controls.target.lerpVectors(
        startTarget.current,
        endTarget.current,
        t
      );
      camera.up.lerpVectors(startUp.current, endUp.current, t).normalize();
      camera.lookAt(controls.target);

      if (rawT >= 1) {
        camera.position.copy(endPosition.current);
        controls.target.copy(endTarget.current);
        camera.up.copy(endUp.current).normalize();

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
