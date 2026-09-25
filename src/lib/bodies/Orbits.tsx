import { useContext, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CelestialBody } from "../../data";
import { SelectionContext, LayersContext, ArtemisModeContext } from "../../context/contexts";
import { useSceneClock } from "../../hooks/useSceneClock";
import { Ephemeris } from "../../helper/ephemeris";
import { Vec3, DAY_MS } from "../../helper/kepler";
import { SCENE_BODIES, getParent } from "../../helper/bodies";
import { blendPosition, blendRadius } from "../../helper/units";
import { moonOffset, scenePosition } from "../../helper/bodyPosition";

const ORBIT_SEGMENTS = 360;
const PLANET_OPACITY = 0.3;
const MOON_OPACITY = 0.22;
const SELECTED_OPACITY = 0.75;
const TRAIL_OPACITY = 0.7;
// Moon orbits appear once their planet is at least this big on screen (px radius)
const MOON_ORBIT_MIN_PLANET_PX = 12;
const MOON_ORBIT_FULL_PLANET_PX = 30;
// An orbit seen almost edge-on is just a line across the screen: fade it out
const EDGE_ON_HIDDEN = 0.06; // |sin(elevation)| of the view above the orbit plane
const EDGE_ON_FULL = 0.25;
// Same when the camera sits right on the line (close-ups): distance / orbit radius
const NEAR_HIDDEN = 0.04;
const NEAR_FULL = 0.2;
// Checking every Nth point is plenty to find the nearest one
const NEAR_SAMPLE_STEP = 4;
const ECLIPTIC_NORMAL = new THREE.Vector3(0, 0, 1);

type OrbitLine = {
  body: CelestialBody;
  path: Vec3[]; // km, relative to the orbit's center
  line: THREE.Line;
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  normal: THREE.Vector3; // plane the edge-on test uses
  radius: number; // mean radius in scene units, updated with the blend
  /** Trails: buffer slot currently holding the live position instead of its sample */
  liveSlot?: number;
};

function makeLine(pointCount: number, color: string, dashed: boolean) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3));
  const params = { color, transparent: true, opacity: 0, depthWrite: false };
  const material = dashed ? new THREE.LineDashedMaterial(params) : new THREE.LineBasicMaterial(params);
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  return { line, material };
}

/** Rewrite the line's points in scene units; returns their mean distance from the center */
function writePoints(o: OrbitLine, map: (p: Vec3) => Vec3): number {
  const attr = o.line.geometry.getAttribute("position") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  let sum = 0;
  for (let i = 0; i < o.path.length; i++) {
    const p = map(o.path[i]);
    arr[i * 3] = p[0];
    arr[i * 3 + 1] = p[1];
    arr[i * 3 + 2] = p[2];
    sum += Math.hypot(p[0], p[1], p[2]);
  }
  attr.needsUpdate = true;
  const radius = sum / o.path.length;
  if (o.material instanceof THREE.LineDashedMaterial) {
    // Dash length follows the orbit's size, so the pattern survives the scale change
    o.material.dashSize = radius * 0.02;
    o.material.gapSize = radius * 0.016;
    o.line.computeLineDistances();
  }
  return radius;
}

function planeNormal(path: Vec3[]): THREE.Vector3 {
  const a = new THREE.Vector3(...path[0]);
  const b = new THREE.Vector3(...path[Math.floor(path.length / 4)]);
  return a.cross(b).normalize();
}

function buildOrbits(ephemeris: Ephemeris) {
  const sunOrbits: OrbitLine[] = [];
  const moonOrbits: OrbitLine[] = [];
  const trails: OrbitLine[] = [];

  for (const body of SCENE_BODIES) {
    const parent = getParent(body);
    if (!parent || body.type === "star" || body.type === "region") continue;

    if (body.type === "spacecraft") {
      // Only Sun-centered paths: an Earth-bound halo orbit would be a scribble
      const traj = ephemeris.trajectory(body);
      if (!traj || parent.type !== "star") continue;
      const { line, material } = makeLine(traj.points.length + 1, body.color, false);
      trails.push({ body, path: traj.points, line, material, normal: new THREE.Vector3(0, 0, 1), radius: 0 });
      continue;
    }

    const path = ephemeris.orbit(body, ORBIT_SEGMENTS);
    if (!path) continue;
    const dashed = body.category === "Dwarf planet";
    const { line, material } = makeLine(path.length, body.color, dashed);
    const aroundSun = parent.type === "star";
    // Sun orbits are judged against the ecliptic, so an inclined one (Pluto)
    // fades with the rest in close-ups; moons against their own plane
    const normal = aroundSun ? ECLIPTIC_NORMAL.clone() : planeNormal(path);
    (aroundSun ? sunOrbits : moonOrbits).push({ body, path, line, material, normal, radius: 0 });
  }
  return { sunOrbits, moonOrbits, trails };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const _center = new THREE.Vector3();
const _view = new THREE.Vector3();

/**
 * 0–1 visibility of an orbit drawn around `center`: hidden when seen edge-on
 * or when the camera is right on top of it, where it only adds streaks
 */
function orbitVisibility(o: OrbitLine, center: THREE.Vector3, camera: THREE.Camera): number {
  _view.copy(center).sub(camera.position);
  const dist = _view.length();
  if (dist < 1e-12) return 0;
  const edgeFactor = smoothstep(EDGE_ON_HIDDEN, EDGE_ON_FULL, Math.abs(_view.dot(o.normal)) / dist);
  if (edgeFactor === 0) return 0;

  const arr = (o.line.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  let nearest = Infinity;
  for (let i = 0; i < o.path.length; i += NEAR_SAMPLE_STEP) {
    const dx = center.x + arr[i * 3] - camera.position.x;
    const dy = center.y + arr[i * 3 + 1] - camera.position.y;
    const dz = center.z + arr[i * 3 + 2] - camera.position.z;
    nearest = Math.min(nearest, dx * dx + dy * dy + dz * dz);
  }
  return edgeFactor * smoothstep(NEAR_HIDDEN, NEAR_FULL, Math.sqrt(nearest) / Math.max(o.radius, 1e-12));
}

/**
 * Orbits of planets and dwarf planets (tinted, dwarfs dashed), orbits of moons
 * (only when their planet is close enough to see them), and the path flown by
 * the selected spacecraft. Orbits fade out when seen edge-on or from up close.
 */
export default function Orbits() {
  const { blendRef, getTime, ephemeris } = useSceneClock();
  const { selected } = useContext(SelectionContext);
  const { layers } = useContext(LayersContext);
  const { active: missionActive } = useContext(ArtemisModeContext);

  const orbits = useMemo(() => (ephemeris ? buildOrbits(ephemeris) : null), [ephemeris]);

  useEffect(() => {
    if (!orbits) return;
    return () => {
      for (const o of [...orbits.sunOrbits, ...orbits.moonOrbits, ...orbits.trails]) {
        o.line.geometry.dispose();
        o.material.dispose();
      }
    };
  }, [orbits]);

  const drawnBlend = useRef<number | null>(null);

  useFrame(({ camera, size }) => {
    if (!orbits) return;
    const blend = blendRef.current;
    const t = getTime();
    const selectedId = selected?.id;
    const showOrbits = layers.orbits && !missionActive;

    // Geometry depends on the scale only: rewrite it when the blend moves
    if (blend !== drawnBlend.current) {
      drawnBlend.current = blend;
      const toScene = (p: Vec3) => blendPosition(p[0], p[1], p[2], blend);
      for (const o of orbits.sunOrbits) o.radius = writePoints(o, toScene);
      for (const o of orbits.trails) writePoints(o, toScene);
      for (const o of orbits.moonOrbits) {
        const planet = getParent(o.body)!;
        o.radius = writePoints(o, (p) => moonOffset(o.body, planet, p, blend));
      }
    }

    _center.set(0, 0, 0);
    for (const o of orbits.sunOrbits) {
      const base = o.body.id === selectedId ? SELECTED_OPACITY : PLANET_OPACITY;
      const opacity = showOrbits ? base * orbitVisibility(o, _center, camera) : 0;
      o.material.opacity = opacity;
      o.line.visible = opacity > 0.002;
    }

    // Moon orbits follow their planet, fading in as it grows on screen
    const focalPx = size.height / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
    for (const o of orbits.moonOrbits) {
      const planet = getParent(o.body)!;
      const p = showOrbits ? scenePosition(planet, ephemeris, t, blend) : null;
      if (!p) {
        o.line.visible = false;
        continue;
      }
      o.line.position.set(p[0], p[1], p[2]);
      _center.set(p[0], p[1], p[2]);
      const px = (blendRadius(planet.radius, blend) / Math.max(camera.position.distanceTo(_center), 1e-9)) * focalPx;
      const zoomFactor = smoothstep(MOON_ORBIT_MIN_PLANET_PX, MOON_ORBIT_FULL_PLANET_PX, px);
      const base = o.body.id === selectedId ? SELECTED_OPACITY : MOON_OPACITY;
      const opacity = zoomFactor > 0 ? base * zoomFactor * orbitVisibility(o, _center, camera) : 0;
      o.material.opacity = opacity;
      o.line.visible = opacity > 0.002;
    }

    // Spacecraft: only the selected one's path, ending at its current position
    for (const o of orbits.trails) {
      const traj = ephemeris!.trajectory(o.body)!;
      const index = Math.floor((t - traj.start) / (traj.stepDays * DAY_MS));
      if (o.body.id !== selectedId || index < 0 || missionActive) {
        o.line.visible = false;
        continue;
      }
      o.line.visible = true;
      o.material.opacity = TRAIL_OPACITY;
      const count = Math.min(index + 1, traj.points.length);
      const current = scenePosition(o.body, ephemeris, t, blend);
      const attr = o.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      // Put back the sample the live position replaced last frame
      if (o.liveSlot !== undefined && o.liveSlot < o.path.length) {
        const s = o.path[o.liveSlot];
        attr.setXYZ(o.liveSlot, ...blendPosition(s[0], s[1], s[2], blend));
      }
      if (current) {
        attr.setXYZ(count, current[0], current[1], current[2]);
        o.liveSlot = count;
      }
      attr.needsUpdate = true;
      o.line.geometry.setDrawRange(0, current ? count + 1 : count);
    }
  });

  if (!orbits) return null;
  return (
    <>
      {[...orbits.sunOrbits, ...orbits.moonOrbits, ...orbits.trails].map((o) => (
        <primitive key={`orbit-${o.body.id}`} object={o.line} />
      ))}
    </>
  );
}
