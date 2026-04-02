import { useContext, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { ScaleDistance, ScaleEarthUnitSize } from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";

interface CameraFlyProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function computeBodyPosition(
  body: CelestialBody,
  scaleDistance: number
): THREE.Vector3 {
  if (body.type === "star") {
    return new THREE.Vector3(0, 0, 0);
  }

  if (body.type === "planet") {
    const star = SOLAR_SYSTEM;
    const x = ScaleDistance({ distance: 0, scale: scaleDistance });
    const y = ScaleDistance({ distance: 0, scale: scaleDistance });
    const z =
      ScaleDistance({ distance: body.distanceFromParent, scale: scaleDistance }) +
      ScaleEarthUnitSize({ size: star.radius }) +
      ScaleEarthUnitSize({ size: body.radius });
    return new THREE.Vector3(x, y, z);
  }

  // Moon: find parent planet, compute planet pos, then add moon offset
  if (body.type === "moon") {
    const parentPlanet = SOLAR_SYSTEM.children.find((p) =>
      p.children.some((m) => m.id === body.id && m.name === body.name)
    );
    if (!parentPlanet) return new THREE.Vector3(0, 0, 0);

    const planetPos = computeBodyPosition(parentPlanet, scaleDistance);
    const moonOffset =
      ScaleDistance({ distance: body.distanceFromParent, scale: scaleDistance }) +
      ScaleEarthUnitSize({ size: parentPlanet.radius }) +
      ScaleEarthUnitSize({ size: body.radius });

    return new THREE.Vector3(
      planetPos.x + moonOffset,
      planetPos.y + moonOffset,
      planetPos.z
    );
  }

  return new THREE.Vector3(0, 0, 0);
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
  const currentBodyRadius = useRef(0);
  const currentBodyPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!cameraNav || !contextScaleDistance) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo } = cameraNav;
    const { scaleDistance } = contextScaleDistance;

    // Start a new fly-to animation
    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, scaleDistance);
      const bodyRadius = ScaleEarthUnitSize({ size: flyTo.radius });

      // Camera landing position: radius * 3 in front, offset up by radius * 1.5
      const cameraTarget = new THREE.Vector3(
        bodyPos.x,
        bodyPos.y + bodyRadius * 1.5,
        bodyPos.z - bodyRadius * 3
      );

      // Calculate animation duration proportional to distance (0.8s - 3s)
      const dist = camera.position.distanceTo(cameraTarget);
      const maxDist = 500000;
      const t = Math.min(dist / maxDist, 1);
      animationDuration.current = 0.8 + t * 2.2;

      // Store start/end state
      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      endPosition.current.copy(cameraTarget);
      endTarget.current.copy(bodyPos);
      currentBodyRadius.current = bodyRadius;
      currentBodyPos.current.copy(bodyPos);

      // Begin animation
      animationProgress.current = 0;
      isAnimating.current = true;
      controls.enabled = false;

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
        controls.minDistance = currentBodyRadius.current * 1.5;
        controls.update();
      }
    }

    // minDistance reset: when far enough from body, remove the constraint
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
