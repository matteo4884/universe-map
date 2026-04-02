import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { ScaleDistance, ScaleEarthUnitSize } from "../../helper/units";
import { CELESTIAL_BODIES } from "../../data";
import { PlanetParam } from "../../data";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computePlanetPosition(planet: PlanetParam, scaleDistance: number): THREE.Vector3 {
  const star = CELESTIAL_BODIES[0];
  const x = ScaleDistance({ distance: 0, scale: scaleDistance });
  const y = ScaleDistance({ distance: 0, scale: scaleDistance });
  const z =
    ScaleDistance({ distance: planet.distanceFromStar, scale: scaleDistance }) +
    ScaleEarthUnitSize({ size: star.radius }) +
    ScaleEarthUnitSize({ size: planet.radius });
  return new THREE.Vector3(x, y, z);
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);

  const { camera } = useThree();

  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const animationDuration = useRef(1.5);
  const startPosition = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPosition = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const currentPlanetRadius = useRef(0);
  const currentPlanetPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !contextScaleDistance) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    // Start a new fly-to animation
    if (flyTo && !isAnimating.current) {
      const planetPos = computePlanetPosition(flyTo, scaleDistance);
      const planetRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      // Camera landing position: radius * 3 away, offset up by radius * 1.5
      const cameraTarget = new THREE.Vector3(
        planetPos.x,
        planetPos.y + planetRadius * 1.5,
        planetPos.z + planetRadius * 3
      );

      // Calculate animation duration proportional to distance (0.8s - 3s)
      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000; // approximate max scene distance
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      // Store start/end state
      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(planetPos);
      currentPlanetRadius.current = planetRadius;
      currentPlanetPos.current.copy(planetPos);

      // Begin animation
      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

      // Clear flyTo so clicking the same planet again works
      setFlyTo(null);
    }

    // Animate
    if (isAnimating.current) {
      animationProgress.current += delta / animationDuration.current;
      const rawT = Math.min(animationProgress.current, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const t = 1 - Math.pow(1 - rawT, 3);

      camera.position.lerpVectors(startPosition.current, endPosition.current, t);
      controls.target.lerpVectors(startTarget.current, endTarget.current, t);
      controls.update();

      // Animation complete
      if (rawT >= 1) {
        isAnimating.current = false;
        controls.enabled = true;
        controls.minDistance = currentPlanetRadius.current * 1.5;
        controls.update();
      }
    }

    // minDistance reset: when far enough from planet, remove the constraint
    if (
      !isAnimating.current &&
      currentPlanetRadius.current > 0
    ) {
      const distToPlanet = camera.position.distanceTo(currentPlanetPos.current);
      if (distToPlanet > currentPlanetRadius.current * 20) {
        controls.minDistance = 0;
        currentPlanetRadius.current = 0;
      }
    }
  });

  return null;
}
