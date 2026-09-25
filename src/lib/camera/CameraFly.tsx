import { useContext, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TrackballControls as TrackballControlsImpl } from "three-stdlib";
import {
  CameraNavigationContext,
  ScaleContext,
  ArtemisModeContext,
  ArtemisCameraTarget,
} from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { blendPosition, blendRadius } from "../../helper/units";
import { planetPosition, moonOffset } from "../../helper/bodyPosition";
import { SOLAR_SYSTEM, CelestialBody } from "../../data";
import { EphemerisData } from "../../services/horizons";
import { SUN_GALAXY_POSITION } from "../galaxy/generateGalaxy";

interface CameraFlyProps {
  controlsRef: React.RefObject<TrackballControlsImpl | null>;
}

// Neptune's semi-major axis — outermost planet, defines system extent
const NEPTUNE_DIST_KM = 4495000000;
const DEFAULT_MAX_DISTANCE = 300000000000;
const ARTEMIS_MAX_DISTANCE = 150; // Limit zoom to Earth-Moon view
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737;
const WORLD_UP = new THREE.Vector3(0, 0, 1);

function computeBodyPosition(
  body: CelestialBody,
  positions: EphemerisData,
  blend: number
): THREE.Vector3 {
  if (body.type === "star") return new THREE.Vector3(0, 0, 0);

  if (body.type === "moon") {
    const parentPlanet = SOLAR_SYSTEM.children.find((p) =>
      p.children.some((m) => m.id === body.id)
    );
    if (parentPlanet) {
      const planet = planetPosition(parentPlanet, SOLAR_SYSTEM, positions, blend);
      const offset = moonOffset(body, parentPlanet, positions, blend);
      return new THREE.Vector3(...planet).add(new THREE.Vector3(...offset));
    }
  }

  return new THREE.Vector3(...planetPosition(body, SOLAR_SYSTEM, positions, blend));
}

/**
 * Camera lands on the Sun–body line, between the two.
 * Always shows the sunlit hemisphere.
 */
function computeCameraLanding(
  bodyPos: THREE.Vector3,
  bodyRadius: number
): THREE.Vector3 {
  const dist = Math.max(bodyRadius * 4, bodyRadius < 0.1 ? bodyRadius * 8 : 5);

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

/**
 * Camera behind `subject`, looking past it toward `toward`,
 * raised by `upFactor * dist` and shifted sideways by `sideFactor * dist`.
 */
function chaseCamera(
  subject: THREE.Vector3,
  toward: THREE.Vector3,
  dist: number,
  upFactor: number,
  sideFactor: number
): THREE.Vector3 {
  const dir = toward.clone().sub(subject).normalize();
  const side = new THREE.Vector3().crossVectors(dir, WORLD_UP).normalize();
  return subject.clone()
    .addScaledVector(dir, -dist)
    .addScaledVector(WORLD_UP, dist * upFactor)
    .addScaledVector(side, dist * sideFactor);
}

/** Realistic-scale position of a body tracked in Artemis mode */
function artemisBodyPosition(
  body: Exclude<ArtemisCameraTarget, null>,
  orion: THREE.Vector3,
  positions: EphemerisData
): THREE.Vector3 {
  if (body === "orion") return orion.clone();
  const eph = positions[body === "earth" ? "399" : "301"];
  return eph ? new THREE.Vector3(...blendPosition(eph.x, eph.y, eph.z, 1)) : new THREE.Vector3();
}

export default function CameraFly({ controlsRef }: CameraFlyProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const scaleCtx = useContext(ScaleContext);
  const { positions } = useContext(EphemerisContext);
  const artemis = useContext(ArtemisModeContext);
  const { setCameraLocked } = artemis;
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
        setCameraLocked(null);
      }
    };
    canvas.addEventListener("mousedown", onDown);
    return () => canvas.removeEventListener("mousedown", onDown);
  }, [gl, setCameraLocked]);

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
    const blend = scaleCtx.blendRef.current;

    /** Start a camera transition from the current view */
    function startAnimation(
      position: THREE.Vector3,
      target: THREE.Vector3,
      up: THREE.Vector3,
      duration: number,
      bodyRadius = 0
    ) {
      startPosition.current.copy(camera.position);
      startTarget.current.copy(controls!.target);
      startUp.current.copy(camera.up);
      endPosition.current.copy(position);
      endTarget.current.copy(target);
      endUp.current.copy(up);
      animationDuration.current = duration;
      animationProgress.current = 0;
      isAnimating.current = true;
      currentBodyRadius.current = bodyRadius;
      controls!.enabled = false;
    }

    const spacecraft = artemis.active ? artemis.getSpacecraftPosition() : null;
    const orionVec = spacecraft
      ? new THREE.Vector3(...blendPosition(spacecraft.x, spacecraft.y, spacecraft.z, 1))
      : null;

    /** Fly to Orion, Earth or Moon in Artemis mode, then keep tracking it */
    function startArtemisFly(target: Exclude<ArtemisCameraTarget, null>, orion: THREE.Vector3, duration: number) {
      setCameraLocked(target);
      const moonVec = artemisBodyPosition("moon", orion, positions!);
      let camPos: THREE.Vector3;
      let camTarget: THREE.Vector3;

      if (target === "orion") {
        const closeDist = artemis.orionEnhanced ? 0.15 : 0.000008;
        camTarget = orion;
        camPos = chaseCamera(orion, moonVec, closeDist, 0.3, 0.15);
      } else {
        const radius = blendRadius(target === "earth" ? EARTH_RADIUS_KM : MOON_RADIUS_KM, 1);
        camTarget = artemisBodyPosition(target, orion, positions!);
        camPos = chaseCamera(camTarget, orion, radius * 4, 1.5 / 4, 1 / 4);
      }

      startAnimation(camPos, camTarget, WORLD_UP, duration);
    }

    // Re-fly to Orion when enhanced mode toggles
    if (artemis.active && artemis.orionEnhanced !== prevOrionEnhanced.current) {
      prevOrionEnhanced.current = artemis.orionEnhanced;
      artemis.setCameraTarget("orion");
    }

    // Fly to Orion when Artemis mode activates
    if (artemis.active && !prevArtemisActive.current) {
      pendingArtemisFly.current = true;
    }
    if (pendingArtemisFly.current && orionVec && !isAnimating.current) {
      pendingArtemisFly.current = false;
      controls.maxDistance = ARTEMIS_MAX_DISTANCE;
      startArtemisFly("orion", orionVec, 2.5);
    }

    // Restore maxDistance when exiting Artemis
    if (!artemis.active && prevArtemisActive.current) {
      controls.maxDistance = DEFAULT_MAX_DISTANCE;
    }
    prevArtemisActive.current = artemis.active;

    // Artemis camera target navigation (Earth, Moon, Orion buttons)
    if (artemis.cameraTarget && orionVec && !isAnimating.current) {
      const target = artemis.cameraTarget;
      artemis.setCameraTarget(null);
      startArtemisFly(target, orionVec, 2.0);
    }

    // Camera tracking — follow selected body in Artemis mode
    if (artemis.cameraLocked && orionVec && !isAnimating.current) {
      const newTarget = artemisBodyPosition(artemis.cameraLocked, orionVec, positions);
      const trackingOffset = newTarget.clone().sub(controls.target);
      if (trackingOffset.lengthSq() > 1e-20) {
        camera.position.add(trackingOffset);
        controls.target.copy(newTarget);
      }
    }

    // Clear tracking on Artemis exit
    if (!artemis.active && artemis.cameraLocked) setCameraLocked(null);

    // Handle view snap — fixed positions that scale with blend
    if (viewSnap && !isAnimating.current) {
      // For "home", use TARGET blend (where the scale is going), not current
      const targetBlend = viewSnap === "home"
        ? (scaleCtx.realisticMode ? 1 : 0)
        : blend;
      const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, targetBlend);
      const viewDist = Math.abs(nx) * 1.4;

      const snapPosition = new THREE.Vector3();
      const snapTarget = new THREE.Vector3(0, 0, 0);
      const snapUp = WORLD_UP.clone();

      if (viewSnap === "top") {
        snapPosition.set(0, 0, viewDist);
        snapUp.set(0, -1, 0);
      } else if (viewSnap === "front") {
        snapPosition.set(0, viewDist, 0);
      } else if (viewSnap === "home") {
        // "home" — midway between top and front
        const angle = Math.PI / 4;
        snapPosition.set(0, viewDist * Math.sin(angle), viewDist * Math.cos(angle));
      } else {
        // "milkyway" — galactic overview, centered on galaxy center
        const GALAXY_SCALE = 250000000;
        snapTarget.set(
          -SUN_GALAXY_POSITION[0] * GALAXY_SCALE,
          -SUN_GALAXY_POSITION[1] * GALAXY_SCALE,
          -SUN_GALAXY_POSITION[2] * GALAXY_SCALE
        );

        const galaxyDist = 280000000000;
        const angle = Math.PI / 6; // 30° above galactic plane
        snapPosition.set(
          snapTarget.x + galaxyDist * Math.sin(angle) * 0.3,
          snapTarget.y + galaxyDist * Math.sin(angle),
          snapTarget.z + galaxyDist * Math.cos(angle)
        );
      }

      const snapDist = camera.position.distanceTo(snapPosition);
      startAnimation(snapPosition, snapTarget, snapUp, Math.min(1.0 + snapDist / 100000000000 * 2.0, 3.5));
      setViewSnap(null);
    }

    if (flyTo && !isAnimating.current) {
      const bodyPos = computeBodyPosition(flyTo, positions, blend);
      const bodyRadius = blendRadius(flyTo.radius, blend);
      const cameraLanding = computeCameraLanding(bodyPos, bodyRadius);

      const flyDist = camera.position.distanceTo(cameraLanding);
      const t = Math.min(flyDist / 500000, 1);

      // Ecliptic north always up
      startAnimation(cameraLanding, bodyPos, WORLD_UP, 0.8 + t * 2.2, bodyRadius);
      currentBodyPos.current.copy(bodyPos);
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
