import { useContext, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TrackballControls as TrackballControlsImpl } from "three-stdlib";
import {
  CameraNavigationContext,
  ViewDirection,
} from "../../context/cameraNavigation";
import { ScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { ArtemisModeContext } from "../../context/artemisMode";
import {
  blendPosition,
  blendMoonPosition,
  blendRadius,
  KM_PER_UNIT,
} from "../../helper/units";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";
import { EphemerisData } from "../../services/horizons";
import { SUN_GALAXY_POSITION } from "../galaxy/generateGalaxy";

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
  const artemis = useContext(ArtemisModeContext);
  const prevArtemisActive = useRef(false);
  const pendingArtemisFly = useRef(false);
  const prevOrionEnhanced = useRef(artemis.orionEnhanced);
  const cameraLockedRef = useRef(artemis.cameraLocked);

  const { camera, gl } = useThree();

  // Detect right-click to disengage camera tracking
  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (e: MouseEvent) => {
      if (e.button === 2 && cameraLockedRef.current) {
        artemis.setCameraLocked(null);
      }
    };
    canvas.addEventListener("mousedown", onDown);
    return () => canvas.removeEventListener("mousedown", onDown);
  }, [gl]);

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
    cameraLockedRef.current = artemis.cameraLocked;
    if (!cameraNav || !scaleCtx || !positions) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const { flyTo, setFlyTo, viewSnap, setViewSnap } = cameraNav;
    const { blend } = scaleCtx;

    // Re-fly to Orion when enhanced mode toggles
    if (artemis.active && artemis.orionEnhanced !== prevOrionEnhanced.current) {
      prevOrionEnhanced.current = artemis.orionEnhanced;
      artemis.setCameraTarget("orion");
    }

    // Fly to Orion when Artemis mode activates
    if (artemis.active && !prevArtemisActive.current) {
      pendingArtemisFly.current = true;
    }
    if (pendingArtemisFly.current && artemis.active && artemis.position && positions && !isAnimating.current) {
      pendingArtemisFly.current = false;
      artemis.setCameraLocked("orion");
      controls.maxDistance = 150; // Limit zoom to Earth-Moon view
      const orionPos = blendPosition(artemis.position.x, artemis.position.y, artemis.position.z, 1);
      const orionVec = new THREE.Vector3(orionPos[0], orionPos[1], orionPos[2]);
      const moonEph = positions["301"];
      const moonVec = moonEph
        ? new THREE.Vector3(...blendPosition(moonEph.x, moonEph.y, moonEph.z, 1))
        : orionVec.clone().add(new THREE.Vector3(10, 0, 0));

      const orionToMoon = moonVec.clone().sub(orionVec).normalize();
      const upDir = new THREE.Vector3(0, 0, 1);
      const sideDir = new THREE.Vector3().crossVectors(orionToMoon, upDir).normalize();
      const closeDist = artemis.orionEnhanced ? 0.15 : 0.000008;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      startUp.current.copy(camera.up);
      endPosition.current.copy(
        orionVec.clone()
          .addScaledVector(orionToMoon, -closeDist)
          .addScaledVector(upDir, closeDist * 0.3)
          .addScaledVector(sideDir, closeDist * 0.15)
      );
      endTarget.current.copy(orionVec);
      endUp.current.set(0, 0, 1);

      animationDuration.current = 2.5;
      animationProgress.current = 0;
      isAnimating.current = true;
      currentBodyRadius.current = 0;
      controls.enabled = false;
    }

    // Restore maxDistance when exiting Artemis
    if (!artemis.active && prevArtemisActive.current) {
      controls.maxDistance = 300000000000;
    }
    prevArtemisActive.current = artemis.active;

    // Artemis camera target navigation (Earth, Moon, Orion buttons)
    if (artemis.cameraTarget && artemis.active && artemis.position && positions && !isAnimating.current) {
      const target = artemis.cameraTarget;
      artemis.setCameraTarget(null);
      artemis.setCameraLocked(target);

      const orionPos = blendPosition(artemis.position.x, artemis.position.y, artemis.position.z, 1);
      const orionVec = new THREE.Vector3(orionPos[0], orionPos[1], orionPos[2]);
      const earthEph = positions["399"];
      const earthVec = earthEph
        ? new THREE.Vector3(...blendPosition(earthEph.x, earthEph.y, earthEph.z, 1))
        : new THREE.Vector3();
      const moonEph = positions["301"];
      const moonVec = moonEph
        ? new THREE.Vector3(...blendPosition(moonEph.x, moonEph.y, moonEph.z, 1))
        : new THREE.Vector3();

      let camPos: THREE.Vector3;
      let camTarget: THREE.Vector3;

      if (target === "orion") {
        const orionToMoon = moonVec.clone().sub(orionVec).normalize();
        const upDir = new THREE.Vector3(0, 0, 1);
        const sideDir = new THREE.Vector3().crossVectors(orionToMoon, upDir).normalize();
        const closeDist = artemis.orionEnhanced ? 0.15 : 0.000008;
        camTarget = orionVec;
        camPos = orionVec.clone()
          .addScaledVector(orionToMoon, -closeDist)
          .addScaledVector(upDir, closeDist * 0.3)
          .addScaledVector(sideDir, closeDist * 0.15);
      } else if (target === "earth") {
        const earthRadius = blendRadius(6371, 1);
        const toOrion = orionVec.clone().sub(earthVec).normalize();
        const upDir = new THREE.Vector3(0, 0, 1);
        const sideDir = new THREE.Vector3().crossVectors(toOrion, upDir).normalize();
        camTarget = earthVec;
        camPos = earthVec.clone()
          .addScaledVector(toOrion, -earthRadius * 4)
          .addScaledVector(upDir, earthRadius * 1.5)
          .addScaledVector(sideDir, earthRadius);
      } else {
        const moonRadius = blendRadius(1737, 1);
        const toOrion = orionVec.clone().sub(moonVec).normalize();
        const upDir = new THREE.Vector3(0, 0, 1);
        const sideDir = new THREE.Vector3().crossVectors(toOrion, upDir).normalize();
        camTarget = moonVec;
        camPos = moonVec.clone()
          .addScaledVector(toOrion, -moonRadius * 4)
          .addScaledVector(upDir, moonRadius * 1.5)
          .addScaledVector(sideDir, moonRadius);
      }

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      startUp.current.copy(camera.up);
      endPosition.current.copy(camPos);
      endTarget.current.copy(camTarget);
      endUp.current.set(0, 0, 1);

      animationDuration.current = 2.0;
      animationProgress.current = 0;
      isAnimating.current = true;
      currentBodyRadius.current = 0;
      controls.enabled = false;
    }

    // Camera tracking — follow selected body in Artemis mode
    if (artemis.cameraLocked && artemis.active && artemis.position && positions && !isAnimating.current) {
      let bodyPos: [number, number, number];
      if (artemis.cameraLocked === "orion") {
        bodyPos = blendPosition(artemis.position.x, artemis.position.y, artemis.position.z, 1);
      } else if (artemis.cameraLocked === "earth") {
        const e = positions["399"];
        bodyPos = e ? blendPosition(e.x, e.y, e.z, 1) : [0, 0, 0];
      } else {
        const m = positions["301"];
        bodyPos = m ? blendPosition(m.x, m.y, m.z, 1) : [0, 0, 0];
      }
      const newTarget = new THREE.Vector3(bodyPos[0], bodyPos[1], bodyPos[2]);
      const trackingOffset = newTarget.clone().sub(controls.target);
      if (trackingOffset.lengthSq() > 1e-20) {
        camera.position.add(trackingOffset);
        controls.target.copy(newTarget);
      }
    }

    // Clear tracking on Artemis exit
    if (!artemis.active && artemis.cameraLocked) artemis.setCameraLocked(null);

    // Handle view snap — fixed positions that scale with blend
    if (viewSnap && !isAnimating.current) {
      // For "home", use TARGET blend (where the scale is going), not current
      const targetBlend = viewSnap === "home"
        ? (scaleCtx.realisticMode ? 1 : 0)
        : blend;
      const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, targetBlend);
      const viewDist = Math.abs(nx) * 1.4;

      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls.target);
      startUp.current.copy(camera.up);
      endTarget.current.set(0, 0, 0);
      endUp.current.set(0, 0, 1);

      if (viewSnap === "top") {
        endPosition.current.set(0, 0, viewDist);
        endUp.current.set(0, -1, 0);
      } else if (viewSnap === "front") {
        endPosition.current.set(0, viewDist, 0);
      } else if (viewSnap === "home") {
        // "home" — midway between top and front
        const angle = Math.PI / 4;
        endPosition.current.set(
          0,
          viewDist * Math.sin(angle),
          viewDist * Math.cos(angle)
        );
      } else {
        // "milkyway" — galactic overview, centered on galaxy center
        const GALAXY_SCALE = 250000000;
        const galaxyCenter = new THREE.Vector3(
          -SUN_GALAXY_POSITION[0] * GALAXY_SCALE,
          -SUN_GALAXY_POSITION[1] * GALAXY_SCALE,
          -SUN_GALAXY_POSITION[2] * GALAXY_SCALE
        );
        endTarget.current.copy(galaxyCenter);

        const galaxyDist = 280000000000;
        const angle = Math.PI / 6; // 30° above galactic plane
        endPosition.current.set(
          galaxyCenter.x + galaxyDist * Math.sin(angle) * 0.3,
          galaxyCenter.y + galaxyDist * Math.sin(angle),
          galaxyCenter.z + galaxyDist * Math.cos(angle)
        );
      }

      const snapDist = camera.position.distanceTo(endPosition.current);
      animationDuration.current = Math.min(1.0 + snapDist / 100000000000 * 2.0, 3.5);
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
      const t = 0.5 - 0.5 * Math.cos(rawT * Math.PI);

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
        camera.lookAt(controls.target);

        isAnimating.current = false;
        controls.enabled = true;
        controls.minDistance = currentBodyRadius.current * 1.5;
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
