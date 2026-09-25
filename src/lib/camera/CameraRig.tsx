import { useContext, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CameraNavigationContext,
  ScaleContext,
  ArtemisModeContext,
  ArtemisCameraTarget,
  SelectionContext,
  ViewDirection,
} from "../../context/contexts";
import { useSceneClock } from "../../hooks/useSceneClock";
import { blendPosition, blendRadius } from "../../helper/units";
import { scenePosition, regionRadiiKm } from "../../helper/bodyPosition";
import { getBodyBySlug } from "../../helper/bodies";
import { systemViewDistance, homeOffset } from "../../helper/views";
import { CelestialBody } from "../../data";
import { SUN_GALAXY_POSITION } from "../galaxy/generateGalaxy";

interface CameraRigProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

export const DEFAULT_MAX_DISTANCE = 300000000000;
const ARTEMIS_MAX_DISTANCE = 150; // Limit zoom to Earth-Moon view
const GALAXY_SCALE = 250000000;
const PANEL_WIDTH = 380;
const PANEL_MIN_SCREEN = 640; // the desktop panel exists from Tailwind's sm: breakpoint
const WORLD_UP = new THREE.Vector3(0, 0, 1);

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Something the camera can track: its current position and size (scene units) */
type Focus = {
  body: CelestialBody | null; // null for Orion
  position: () => THREE.Vector3 | null;
  radius: () => number;
};

type Flight = {
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  /** Where to look at the end — re-evaluated every frame, bodies keep moving */
  endTarget: () => THREE.Vector3 | null;
  /** Camera position relative to the end target */
  endOffset: THREE.Vector3;
  duration: number;
  progress: number;
  /** Tracked after arrival */
  focus: Focus | null;
};

/** Distance to land at: close enough to fill the view, never inside the body */
function landingDistance(body: CelestialBody, radius: number, blend: number): number {
  if (body.type === "spacecraft") return THREE.MathUtils.lerp(30, 3000, blend);
  return Math.max(radius * 4, radius < 0.1 ? radius * 8 : 5);
}

/** Camera offset from a body: between it and the Sun, so the lit side faces us */
function sunlitOffset(bodyPos: THREE.Vector3, dist: number): THREE.Vector3 {
  if (bodyPos.length() < 0.01) return new THREE.Vector3(dist, 0, 0); // the Sun itself
  return bodyPos.clone().negate().normalize().multiplyScalar(dist);
}

/** Behind `subject`, looking past it toward `toward`, a bit above and to the side */
function chaseOffset(subject: THREE.Vector3, toward: THREE.Vector3, dist: number, up: number, side: number): THREE.Vector3 {
  const dir = toward.clone().sub(subject).normalize();
  const sideDir = new THREE.Vector3().crossVectors(dir, WORLD_UP).normalize();
  return dir.multiplyScalar(-dist).addScaledVector(WORLD_UP, dist * up).addScaledVector(sideDir, dist * side);
}

export default function CameraRig({ controlsRef }: CameraRigProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const scaleCtx = useContext(ScaleContext);
  const artemis = useContext(ArtemisModeContext);
  const { panelOpen } = useContext(SelectionContext);
  const { blendRef, getTime, ephemeris } = useSceneClock();
  const { setCameraLocked } = artemis;
  const { camera, gl, size } = useThree();

  const flight = useRef<Flight | null>(null);
  const focus = useRef<Focus | null>(null);
  const lastFocusPos = useRef<THREE.Vector3 | null>(null);
  const lastFocusRadius = useRef(0);
  const prevArtemisActive = useRef(false);
  const pendingArtemisFly = useRef(false);
  const prevOrionEnhanced = useRef(artemis.orionEnhanced);
  const prevRealistic = useRef(scaleCtx?.realisticMode ?? false);
  const cameraLockedRef = useRef(artemis.cameraLocked);
  const viewOffset = useRef(0);

  // Right-click disengages Artemis tracking
  useEffect(() => {
    const canvas = gl.domElement;
    const onDown = (e: MouseEvent) => {
      if (e.button === 2 && cameraLockedRef.current) setCameraLocked(null);
    };
    canvas.addEventListener("mousedown", onDown);
    return () => canvas.removeEventListener("mousedown", onDown);
  }, [gl, setCameraLocked]);

  useFrame((_, delta) => {
    cameraLockedRef.current = artemis.cameraLocked;
    const controls = controlsRef.current;
    if (!cameraNav || !scaleCtx || !controls) return;
    const blend = blendRef.current;
    const persp = camera as THREE.PerspectiveCamera;

    const bodyFocus = (body: CelestialBody): Focus => ({
      body,
      position: () => {
        const p = scenePosition(body, ephemeris, getTime(), blendRef.current);
        return p ? new THREE.Vector3(...p) : null;
      },
      radius: () => (body.type === "spacecraft" || body.type === "region" ? 0 : blendRadius(body.radius, blendRef.current)),
    });

    const orionFocus: Focus = {
      body: null,
      position: () => {
        const p = artemis.getSpacecraftPosition();
        return p ? new THREE.Vector3(...blendPosition(p.x, p.y, p.z, 1)) : null;
      },
      radius: () => 0,
    };

    function startFlight(endTarget: Flight["endTarget"], endOffset: THREE.Vector3, duration: number, nextFocus: Focus | null) {
      flight.current = {
        startPosition: camera.position.clone(),
        startTarget: controls!.target.clone(),
        endTarget,
        endOffset,
        duration: reducedMotion() ? Math.min(duration, 0.6) : duration,
        progress: 0,
        focus: nextFocus,
      };
      focus.current = null;
      controls!.enabled = false;
    }

    /** A region (asteroid belt): frame the whole ring from above */
    function flyToRegion(body: CelestialBody) {
      const [outer] = blendPosition(regionRadiiKm(body).outer, 0, 0, blend);
      const dist = outer * 2.4;
      const elevation = (55 * Math.PI) / 180;
      const offset = new THREE.Vector3(0, -dist * Math.cos(elevation), dist * Math.sin(elevation));
      const center = new THREE.Vector3();
      const travel = camera.position.distanceTo(offset);
      startFlight(() => center, offset, Math.min(1.0 + (travel / 500000) * 2.0, 3), null);
    }

    function flyToBody(body: CelestialBody) {
      if (body.type === "region") return flyToRegion(body);
      const f = bodyFocus(body);
      const pos = f.position();
      if (!pos) return;
      const dist = landingDistance(body, f.radius(), blend);
      const offset = sunlitOffset(pos, dist);
      const t = Math.min(camera.position.distanceTo(pos.clone().add(offset)) / 500000, 1);
      startFlight(f.position, offset, 0.8 + t * 2.2, f);
    }

    function snapTo(view: Exclude<ViewDirection, null>) {
      // For "home", use TARGET blend (where the scale is going), not current
      const targetBlend = view === "home" ? (scaleCtx!.realisticMode ? 1 : 0) : blend;
      const aspect = size.width / size.height;
      const viewDist = systemViewDistance(targetBlend, aspect);

      let target = new THREE.Vector3(0, 0, 0);
      let offset: THREE.Vector3;
      if (view === "top") {
        // Straight down, nudged off the pole so "up" stays defined
        offset = new THREE.Vector3(0, -viewDist * 0.001, viewDist);
      } else if (view === "front") {
        offset = new THREE.Vector3(0, viewDist, 0);
      } else if (view === "home") {
        offset = new THREE.Vector3(...homeOffset(targetBlend, aspect));
      } else {
        target = new THREE.Vector3(...SUN_GALAXY_POSITION).multiplyScalar(-GALAXY_SCALE);
        const galaxyDist = 280000000000;
        const angle = Math.PI / 6; // 30° above galactic plane
        offset = new THREE.Vector3(
          galaxyDist * Math.sin(angle) * 0.3,
          galaxyDist * Math.sin(angle),
          galaxyDist * Math.cos(angle)
        );
      }
      const dist = camera.position.distanceTo(target.clone().add(offset));
      const fixed = target.clone();
      startFlight(() => fixed, offset, Math.min(1.0 + (dist / 100000000000) * 2.0, 3.5), null);
    }

    function artemisFly(target: Exclude<ArtemisCameraTarget, null>, duration: number) {
      const orion = orionFocus.position();
      const earth = getBodyBySlug("earth")!;
      const moon = getBodyBySlug("moon")!;
      if (!orion) return;
      setCameraLocked(target);
      const moonPos = bodyFocus(moon).position() ?? orion.clone().add(new THREE.Vector3(10, 0, 0));
      if (target === "orion") {
        const closeDist = artemis.orionEnhanced ? 0.15 : 0.000008;
        startFlight(orionFocus.position, chaseOffset(orion, moonPos, closeDist, 0.3, 0.15), duration, orionFocus);
      } else {
        const body = target === "earth" ? earth : moon;
        const f = bodyFocus(body);
        const pos = f.position();
        if (!pos) return;
        const r = f.radius();
        startFlight(f.position, chaseOffset(pos, orion, r * 4, 1.5 / 4, 1 / 4), duration, f);
      }
    }

    // ---- Requests ----
    if (cameraNav.flyTo && !flight.current) {
      flyToBody(cameraNav.flyTo);
      cameraNav.setFlyTo(null);
    }
    if (cameraNav.viewSnap && !flight.current) {
      snapTo(cameraNav.viewSnap);
      cameraNav.setViewSnap(null);
    }

    // Scale toggled: stay on the tracked body, otherwise reframe the whole system
    if (scaleCtx.realisticMode !== prevRealistic.current) {
      prevRealistic.current = scaleCtx.realisticMode;
      if (!focus.current && !flight.current && !artemis.active) snapTo("home");
    }

    // ---- Artemis ----
    if (artemis.active && artemis.orionEnhanced !== prevOrionEnhanced.current) {
      prevOrionEnhanced.current = artemis.orionEnhanced;
      artemis.setCameraTarget("orion");
    }
    if (artemis.active && !prevArtemisActive.current) pendingArtemisFly.current = true;
    if (pendingArtemisFly.current && artemis.active && !flight.current && orionFocus.position()) {
      pendingArtemisFly.current = false;
      controls.maxDistance = ARTEMIS_MAX_DISTANCE;
      artemisFly("orion", 2.5);
    }
    if (!artemis.active && prevArtemisActive.current) {
      controls.maxDistance = DEFAULT_MAX_DISTANCE;
      focus.current = null;
    }
    prevArtemisActive.current = artemis.active;
    if (artemis.active && artemis.cameraTarget && !flight.current) {
      const target = artemis.cameraTarget;
      artemis.setCameraTarget(null);
      artemisFly(target, 2.0);
    }
    if (artemis.active && !artemis.cameraLocked && focus.current && !focus.current.body) focus.current = null;
    if (!artemis.active && artemis.cameraLocked) setCameraLocked(null);

    // ---- Flight ----
    const f = flight.current;
    if (f) {
      f.progress += delta / f.duration;
      const raw = Math.min(f.progress, 1);
      const eased = 0.5 - 0.5 * Math.cos(raw * Math.PI);
      const end = f.endTarget() ?? f.startTarget;
      controls.target.lerpVectors(f.startTarget, end, eased);
      camera.position.lerpVectors(f.startPosition, end.clone().add(f.endOffset), eased);
      camera.up.copy(WORLD_UP);
      camera.lookAt(controls.target);

      if (raw >= 1) {
        flight.current = null;
        controls.enabled = true;
        focus.current = f.focus;
        lastFocusPos.current = f.focus ? end.clone() : null;
        lastFocusRadius.current = f.focus ? f.focus.radius() : 0;
      }
    } else if (focus.current) {
      // ---- Tracking: move with the body (time passing, scale changing) ----
      const pos = focus.current.position();
      if (pos && lastFocusPos.current) {
        const radius = focus.current.radius();
        const offset = camera.position.clone().sub(controls.target);
        // Keep the same apparent size while the scale animates
        if (lastFocusRadius.current > 0 && radius > 0 && radius !== lastFocusRadius.current) {
          offset.multiplyScalar(radius / lastFocusRadius.current);
        }
        controls.target.add(pos.clone().sub(lastFocusPos.current));
        camera.position.copy(controls.target).add(offset);
        lastFocusPos.current = pos;
        lastFocusRadius.current = radius;
      }
    }

    controls.minDistance = !flight.current && focus.current ? focus.current.radius() * 1.2 : 0;

    // ---- Keep the target centered in the part of the screen the panel leaves free ----
    const wanted = panelOpen && size.width >= PANEL_MIN_SCREEN && !artemis.active ? PANEL_WIDTH / 2 : 0;
    const next = viewOffset.current + (wanted - viewOffset.current) * Math.min(1, delta * 6);
    const shift = Math.abs(next - wanted) < 0.5 ? wanted : next;
    const resized = persp.view && (persp.view.fullWidth !== size.width || persp.view.fullHeight !== size.height);
    if (shift !== viewOffset.current || (shift !== 0 && resized)) {
      viewOffset.current = shift;
      if (shift === 0) persp.clearViewOffset();
      else persp.setViewOffset(size.width, size.height, shift, 0, size.width, size.height);
    }
  });

  return null;
}
