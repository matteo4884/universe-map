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
import { blendPosition, blendRadius, poleToEcliptic } from "../../helper/units";
import { scenePosition, regionRadiiKm, hasRenderedRings } from "../../helper/bodyPosition";
import { getBodyBySlug } from "../../helper/bodies";
import { homeOffset, systemViewOffset } from "../../helper/views";
import { ZoomPath, zoomPath, peakDistance, flightEase, flightTiming } from "../../helper/flight";
import { GALACTIC_CENTER, galaxyViewOffset, cameraUp } from "../../helper/galaxy";
import { CelestialBody } from "../../data";

interface CameraRigProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

// Far enough to frame the whole galaxy on a portrait screen
export const DEFAULT_MAX_DISTANCE = 1500000000000;
const ARTEMIS_MAX_DISTANCE = 150; // Limit zoom to Earth-Moon view
const PANEL_WIDTH = 380;
const PANEL_MIN_SCREEN = 640; // the desktop panel exists from Tailwind's sm: breakpoint
const WORLD_UP = new THREE.Vector3(0, 0, 1);
const DEG = Math.PI / 180;
// Arrival: sunward of the body, turned aside and a little above, so the terminator shows
const ARRIVAL_PHASE = 35 * DEG;
const ARRIVAL_ELEVATION = 15 * DEG;
// Ringed planets: seen from this high above the rings, on their sunlit face
const RING_VIEW_ELEVATION = 25 * DEG;
// Flights that zoom out across the Solar System rise this much above the planets' plane mid-way
const MAX_LIFT = 22 * DEG;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Something the camera can track: its current position and size (scene units) */
type Focus = {
  body: CelestialBody | null; // null for Orion
  position: () => THREE.Vector3 | null;
  radius: () => number;
};

/**
 * A flight along a zoom path (helper/flight.ts): the view center slides from
 * the start target to the end target while the camera's distance follows the
 * path and its direction turns around the center. Both targets are
 * re-evaluated every frame, bodies keep moving.
 */
type Flight = {
  from: () => THREE.Vector3;
  to: () => THREE.Vector3 | null;
  lastTo: THREE.Vector3;
  path: ZoomPath;
  endDistance: number;
  theta0: number; // direction from the center, around the ecliptic pole
  turn: number;
  phi0: number; // and from the pole
  phi1: number;
  lift: number;
  duration: number;
  rampIn: number;
  rampOut: number;
  elapsed: number;
  /** Tracked after arrival */
  focus: Focus | null;
};

/** Distance to land at: the body fills about half the view (Saturn: its rings) */
function landingDistance(body: CelestialBody, radius: number, blend: number): number {
  if (body.type === "spacecraft") return THREE.MathUtils.lerp(30, 3000, blend);
  return radius * (hasRenderedRings(body) ? 6 : 4);
}

function direction(phi: number, theta: number, out = new THREE.Vector3()): THREE.Vector3 {
  const s = Math.sin(phi);
  return out.set(s * Math.cos(theta), s * Math.sin(theta), Math.cos(phi));
}

/** Angles of a direction: around the ecliptic pole (theta) and from it (phi) */
function angles(v: THREE.Vector3): { theta: number; phi: number } {
  const len = v.length();
  return {
    theta: Math.atan2(v.y, v.x),
    phi: len > 0 ? Math.acos(THREE.MathUtils.clamp(v.z / len, -1, 1)) : Math.PI / 2,
  };
}

const wrapAngle = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/**
 * Where to look at a body from: toward the Sun, turned 35° aside (whichever side
 * is nearer the camera) and a bit above, so it shows a lit, three-dimensional
 * gibbous face rather than a flat full disc. Ringed planets are seen from
 * above the rings' sunlit face; the Sun is approached head-on.
 */
function arrivalDirection(body: CelestialBody, bodyPos: THREE.Vector3, fromDir: THREE.Vector3): THREE.Vector3 {
  if (bodyPos.length() < 1e-6) {
    const { theta, phi } = angles(fromDir);
    return direction(THREE.MathUtils.clamp(phi, 50 * DEG, 80 * DEG), theta);
  }
  const sunward = bodyPos.clone().negate().normalize();
  const sun = angles(sunward);
  const phi = THREE.MathUtils.clamp(sun.phi - ARRIVAL_ELEVATION, 10 * DEG, 170 * DEG);
  const a = direction(phi, sun.theta + ARRIVAL_PHASE);
  const b = direction(phi, sun.theta - ARRIVAL_PHASE);
  const dir = a.dot(fromDir) >= b.dot(fromDir) ? a : b;

  const { poleRA, poleDec } = body.info;
  if (!hasRenderedRings(body) || poleRA == null || poleDec == null) return dir;
  const pole = poleToEcliptic(poleRA, poleDec);
  const litSide = Math.sign(sunward.dot(pole)) || 1;
  const inPlane = dir.addScaledVector(pole, -dir.dot(pole)).normalize();
  return inPlane.multiplyScalar(Math.cos(RING_VIEW_ELEVATION)).addScaledVector(pole, litSide * Math.sin(RING_VIEW_ELEVATION));
}

/** Behind `subject`, looking past it toward `toward`, a bit above and to the side */
function chaseOffset(subject: THREE.Vector3, toward: THREE.Vector3, dist: number, up: number, side: number): THREE.Vector3 {
  const dir = toward.clone().sub(subject).normalize();
  const sideDir = new THREE.Vector3().crossVectors(dir, WORLD_UP).normalize();
  return dir.multiplyScalar(-dist).addScaledVector(WORLD_UP, dist * up).addScaledVector(sideDir, dist * side);
}

const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _keepPosition = new THREE.Vector3();
const _keepTarget = new THREE.Vector3();

/**
 * Forget the motion the controls still carry from the user's last drag. With
 * damping they glide on for a while, but they only update while enabled: a
 * glide left over when a flight starts would play out after it, at the scale
 * it began (a pan made in the galaxy view throws the camera kiloparsecs away
 * from the Solar System). An undamped update spends it; the camera is put back.
 */
function settleControls(controls: OrbitControlsImpl, camera: THREE.Camera) {
  _keepPosition.copy(camera.position);
  _keepTarget.copy(controls.target);
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damping;
  camera.position.copy(_keepPosition);
  controls.target.copy(_keepTarget);
  // Nothing left to apply: this one just turns the camera back to its target
  controls.update();
}

export default function CameraRig({ controlsRef }: CameraRigProps) {
  const cameraNav = useContext(CameraNavigationContext);
  const setActiveView = cameraNav?.setActiveView;
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

  useEffect(() => {
    const canvas = gl.domElement;
    // Right-click disengages Artemis tracking
    const onDown = (e: MouseEvent) => {
      if (e.button === 2 && cameraLockedRef.current) setCameraLocked(null);
    };
    // Grabbing the view mid-flight stops the flight. Capture phase: the
    // controls get the same event and start the drag or zoom right away
    const takeOver = () => {
      // The view chosen from the controls is no longer what's on screen
      setActiveView?.(null);
      if (!flight.current) return;
      flight.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("pointerdown", takeOver, { capture: true });
    canvas.addEventListener("wheel", takeOver, { capture: true, passive: true });
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("pointerdown", takeOver, { capture: true });
      canvas.removeEventListener("wheel", takeOver, { capture: true });
    };
  }, [gl, setCameraLocked, controlsRef, setActiveView]);

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

    /** Width/height of the part of the screen the panel leaves free */
    const freeAspect = () => {
      const panel = panelOpen && size.width >= PANEL_MIN_SCREEN && !artemis.active;
      return (panel ? size.width - PANEL_WIDTH : size.width) / size.height;
    };

    function startFlight(to: Flight["to"], endOffset: THREE.Vector3, nextFocus: Focus | null, fixedDuration?: number) {
      settleControls(controls!, camera);
      const startTarget = controls!.target.clone();
      // Leaving a body we were following: keep following it while we pull away
      const leaving = focus.current;
      const leavingPos = leaving?.position();
      let from: Flight["from"] = () => startTarget;
      if (leaving && leavingPos) {
        const shift = startTarget.clone().sub(leavingPos);
        from = () => leaving.position()?.add(shift) ?? startTarget;
      }

      const endTarget = to() ?? startTarget;
      const startOffset = camera.position.clone().sub(startTarget);
      const w0 = Math.max(startOffset.length(), 1e-9);
      const w1 = Math.max(endOffset.length(), 1e-9);
      const path = zoomPath(w0, w1, endTarget.distanceTo(startTarget));
      const timing = fixedDuration
        ? { duration: reducedMotion() ? Math.min(fixedDuration, 0.6) : fixedDuration, rampIn: 0.5, rampOut: 0.5 }
        : flightTiming(path.length, reducedMotion());
      const a = angles(startOffset);
      const b = angles(endOffset);
      // The more the path zooms out beyond both ends, the higher it rises
      const zoomOut = Math.log(peakDistance(path, w0, w1) / Math.max(w0, w1));

      flight.current = {
        from,
        to,
        lastTo: endTarget.clone(),
        path,
        endDistance: w1,
        theta0: a.theta,
        turn: wrapAngle(b.theta - a.theta),
        phi0: a.phi,
        phi1: b.phi,
        lift: MAX_LIFT * Math.min(zoomOut / 2, 1),
        ...timing,
        elapsed: 0,
        focus: nextFocus,
      };
      focus.current = null;
      controls!.enabled = false;
    }

    /** A region (asteroid belt): frame the whole ring from above */
    function flyToRegion(body: CelestialBody) {
      const [outer] = blendPosition(regionRadiiKm(body).outer, 0, 0, blend);
      const dist = outer * 2.4;
      const elevation = 55 * DEG;
      const offset = new THREE.Vector3(0, -dist * Math.cos(elevation), dist * Math.sin(elevation));
      const center = new THREE.Vector3();
      startFlight(() => center, offset, null);
    }

    function flyToBody(body: CelestialBody) {
      if (body.type === "region") return flyToRegion(body);
      const f = bodyFocus(body);
      const pos = f.position();
      if (!pos) return;
      const fromDir = camera.position.clone().sub(pos).normalize();
      const offset = arrivalDirection(body, pos, fromDir).multiplyScalar(landingDistance(body, f.radius(), blend));
      startFlight(f.position, offset, f);
    }

    function snapTo(view: Exclude<ViewDirection, null>) {
      const aspect = freeAspect();
      if (view === "milkyway" || view === "milkyway-top" || view === "milkyway-side") {
        const kind = view === "milkyway" ? "overview" : view === "milkyway-top" ? "top" : "side";
        startFlight(() => GALACTIC_CENTER, galaxyViewOffset(aspect, persp.fov, kind), null);
        return;
      }
      // Framed for where the scale is going, not where the blend is now
      const targetBlend = scaleCtx!.realisticMode ? 1 : 0;
      const offset =
        view === "home"
          ? new THREE.Vector3(...homeOffset(targetBlend, aspect))
          : new THREE.Vector3(...systemViewOffset(view === "top" ? "top" : "side", targetBlend, aspect, persp.fov));
      const sun = new THREE.Vector3();
      startFlight(() => sun, offset, null);
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
        startFlight(orionFocus.position, chaseOffset(orion, moonPos, closeDist, 0.3, 0.15), orionFocus, duration);
      } else {
        const body = target === "earth" ? earth : moon;
        const f = bodyFocus(body);
        const pos = f.position();
        if (!pos) return;
        const r = f.radius();
        startFlight(f.position, chaseOffset(pos, orion, r * 4, 1.5 / 4, 1 / 4), f, duration);
      }
    }

    // ---- Requests (a new one takes over a flight in progress) ----
    if (cameraNav.flyTo) {
      flyToBody(cameraNav.flyTo);
      cameraNav.setFlyTo(null);
    }
    if (cameraNav.viewSnap) {
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
      f.elapsed += delta;
      const t = Math.min(f.elapsed / f.duration, 1);
      const p = flightEase(t, f.rampIn, f.rampOut);
      const { u, w } = t >= 1 ? { u: 1, w: f.endDistance } : f.path.at(p * f.path.length);
      const to = f.to();
      if (to) f.lastTo.copy(to);
      const center = f.from().clone().lerp(f.lastTo, u);

      // Turn around the center; mid-way, rise toward the nearer pole
      const phiLinear = f.phi0 + (f.phi1 - f.phi0) * p;
      const rise = f.lift * Math.sin(Math.PI * p) * (phiLinear <= Math.PI / 2 ? -1 : 1);
      const phi = THREE.MathUtils.clamp(phiLinear + rise, 0.001, Math.PI - 0.001);
      direction(phi, f.theta0 + f.turn * p, _dir);

      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(_dir, w);
      camera.up.copy(cameraUp(camera.position.length(), _up));
      camera.lookAt(center);

      if (t >= 1) {
        flight.current = null;
        controls.enabled = true;
        focus.current = f.focus;
        lastFocusPos.current = f.focus ? center.clone() : null;
        lastFocusRadius.current = f.focus ? f.focus.radius() : 0;
      }
    } else {
      if (focus.current) {
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
      // Ecliptic north is up among the planets, galactic north out in the galaxy
      cameraUp(camera.position.length(), _up);
      if (camera.up.distanceToSquared(_up) > 1e-14) {
        camera.up.copy(_up);
        camera.lookAt(controls.target);
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
