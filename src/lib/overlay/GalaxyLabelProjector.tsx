import { useContext, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ArtemisModeContext, LayersContext } from "../../context/contexts";
import { GALAXY_LANDMARKS, GALACTIC_CENTER, GALACTIC_NORTH, kpcToScene } from "../../helper/galaxy";
import { overlayStore } from "./overlayStore";

// The names of the arms belong to the view of the whole galaxy: they fade in
// between these distances from the Sun (log10 of scene units, ≈ 6,000–25,000 ly)
const NAMES_FADE_FROM = 10.2;
const NAMES_FADE_TO = 10.8;
// Arm names need the disk seen from above: hidden below ~17° of tilt, where they'd pile up
const ARMS_TILT_FROM = 0.3; // sine of the view's elevation above the disk
const ARMS_TILT_TO = 0.5;

const SUN = new THREE.Vector3();
// Kept clear on the right: the Explore tab sits there
const RIGHT_MARGIN_PX = 44;

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

type Rect = [left: number, top: number, right: number, bottom: number];

function place(el: HTMLElement, x: number, y: number, opacity: number) {
  const visible = opacity > 0.01;
  const value = visible ? "visible" : "hidden";
  if (el.style.visibility !== value) el.style.visibility = value;
  if (!visible) return;
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  const o = opacity.toFixed(2);
  if (el.style.opacity !== o) el.style.opacity = o;
}

const overlaps = (a: Rect, b: Rect) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * Projects the galaxy view's names (center, arms) and the Solar System's
 * "you are here" marker, which takes over once the planets are too small to see.
 */
export default function GalaxyLabelProjector({ solarSystemVisible }: { solarSystemVisible: boolean }) {
  const { layers } = useContext(LayersContext);
  const { active: missionActive } = useContext(ArtemisModeContext);
  const anchors = useMemo(() => GALAXY_LANDMARKS.map((l) => kpcToScene(l.kpc[0], l.kpc[1], 0)), []);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _view = useMemo(() => new THREE.Vector3(), []);
  const sizes = useMemo(() => new Map<HTMLElement, [number, number]>(), []);

  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    const project = (p: THREE.Vector3): [number, number] | null => {
      _ndc.copy(p).project(camera);
      if (_ndc.z > 1 || _ndc.z < -1) return null;
      const x = ((_ndc.x + 1) / 2) * size.width;
      const y = ((1 - _ndc.y) / 2) * size.height;
      return x > -100 && x < size.width + 100 && y > -50 && y < size.height + 50 ? [x, y] : null;
    };

    const fromSun = Math.log10(Math.max(camera.position.length(), 1));
    const namesOpacity =
      layers.galaxyNames && layers.galaxy && !missionActive ? smoothstep(NAMES_FADE_FROM, NAMES_FADE_TO, fromSun) : 0;
    const elevation = Math.abs(_view.copy(camera.position).sub(GALACTIC_CENTER).normalize().dot(GALACTIC_NORTH));
    const armsOpacity = namesOpacity * smoothstep(ARMS_TILT_FROM, ARMS_TILT_TO, elevation);
    // Decluttered by priority: the Sun's marker, the center, then the arms.
    // A name that would cover one already placed, or leave the screen, is hidden.
    // `inset`: where the anchor sits in the element (its dot); centered when null
    const placed: Rect[] = [];
    const tryPlace = (el: HTMLElement, at: [number, number] | null, opacity: number, inset: number | null) => {
      let box = sizes.get(el);
      if (!box) {
        box = [el.offsetWidth, el.offsetHeight];
        if (box[0] > 0) sizes.set(el, box);
      }
      const [w, h] = box;
      const left = at ? (inset === null ? at[0] - w / 2 : at[0] - inset) : 0;
      const top = at ? (inset === null ? at[1] - h / 2 : at[1] - inset) : 0;
      const rect: Rect = [left, top, left + w, top + h];
      const fits = !!at && left >= 0 && left + w <= size.width - RIGHT_MARGIN_PX && !placed.some((p) => overlaps(p, rect));
      if (fits) placed.push(rect);
      place(el, at?.[0] ?? 0, at?.[1] ?? 0, fits ? opacity : 0);
    };

    const marker = overlayStore.sunMarker;
    if (marker) tryPlace(marker, !solarSystemVisible && !missionActive ? project(SUN) : null, 1, 9);
    GALAXY_LANDMARKS.forEach((l, i) => {
      const el = overlayStore.galaxyLabels.get(l.key);
      if (!el) return;
      const opacity = l.point ? namesOpacity : armsOpacity;
      tryPlace(el, opacity > 0 ? project(anchors[i]) : null, opacity, l.point ? 3 : null);
    });
  });

  return null;
}
