import { useContext, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CelestialBody } from "../../data";
import { ArtemisModeContext, SelectionContext, LayersContext } from "../../context/contexts";
import { useSceneClock } from "../../hooks/useSceneClock";
import { SCENE_BODIES, getParent } from "../../helper/bodies";
import { scenePosition, regionAnchor } from "../../helper/bodyPosition";
import { blendRadius, KM_PER_UNIT } from "../../helper/units";
import { overlayStore, hoverStore } from "./overlayStore";

// Visibility rules, in screen pixels (radius of the body's disc)
const LABEL_MAX_PX = 60; // bigger than this, the body speaks for itself
const MARKER_MAX_PX = 2.5; // smaller than this, draw a dot so it stays findable
// Moons get markers and labels once their planet is clearly big on screen
const PLANET_DISC_MARKER_PX = 12;
const PLANET_DISC_LABEL_PX = 14;
const LABEL_GAP_PX = 6;
const LABEL_HEIGHT_PX = 16;
const LABEL_PADDING_PX = 4;
const SCALE_BAR_TARGET_PX = 110;

const AU_KM = 149597870.7;
const LY_KM = 9.4607e12;

type Entry = {
  body: CelestialBody;
  world: THREE.Vector3;
  x: number;
  y: number;
  px: number; // disc radius on screen
  dist: number;
  radius: number; // scene units
  present: boolean; // exists at this time (spacecraft before launch don't)
  visible: boolean; // on screen and not hidden behind another body
};

function priority(body: CelestialBody, hovered: number | null, selected: number | undefined): number {
  if (body.id === hovered) return 1000;
  if (body.id === selected) return 900;
  switch (body.type) {
    case "star": return 800;
    case "planet": return body.category === "Dwarf planet" ? 300 : 500 + body.radius / 1000;
    case "spacecraft": return 200;
    case "region": return 250;
    default: return 100 + body.radius / 100;
  }
}

function niceScale(km: number): { km: number; text: string } {
  const pick = (value: number) => {
    const exp = Math.floor(Math.log10(value));
    const base = value / 10 ** exp;
    const nice = base >= 5 ? 5 : base >= 2 ? 2 : 1;
    return nice * 10 ** exp;
  };
  if (km < 0.1 * AU_KM) {
    const v = pick(km);
    return { km: v, text: `${v.toLocaleString("en-US")} km` };
  }
  if (km < 0.1 * LY_KM) {
    const v = pick(km / AU_KM);
    return { km: v * AU_KM, text: `${v.toLocaleString("en-US")} AU` };
  }
  const v = pick(km / LY_KM);
  return { km: v * LY_KM, text: `${v.toLocaleString("en-US")} ly` };
}

function show(el: HTMLElement, visible: boolean) {
  const value = visible ? "visible" : "hidden";
  if (el.style.visibility !== value) el.style.visibility = value;
}

function setActive(el: HTMLElement, active: boolean) {
  const value = active ? "true" : "false";
  if (el.dataset.active !== value) el.dataset.active = value;
}

/**
 * Projects every body to the screen each frame and drives the DOM overlay:
 * labels (hidden behind other bodies, decluttered by priority), dots for bodies
 * too small to see, the selection ring and the scale bar.
 */
export default function LabelProjector({ solarSystemVisible }: { solarSystemVisible: boolean }) {
  const { blendRef, getTime, ephemeris } = useSceneClock();
  const { selected } = useContext(SelectionContext);
  const { active: artemisActive } = useContext(ArtemisModeContext);
  const { layers } = useContext(LayersContext);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const widths = useMemo(() => new Map<number, number>(), []);
  const entries = useMemo<Entry[]>(
    () =>
      SCENE_BODIES.map((body) => ({
        body, world: new THREE.Vector3(), x: 0, y: 0, px: 0, dist: 0, radius: 0, present: false, visible: false,
      })),
    []
  );
  const byId = useMemo(() => new Map(entries.map((e) => [e.body.id, e])), [entries]);
  const _ndc = useMemo(() => new THREE.Vector3(), []);
  const _toBody = useMemo(() => new THREE.Vector3(), []);
  const _toOther = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    // CameraRig moved the camera this frame: project with its new matrix, not last frame's
    cam.updateMatrixWorld();
    const t = getTime();
    const blend = blendRef.current;
    const focal = size.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const hovered = hoverStore.get();
    const selectedId = selected?.id;

    // ---- Project ----
    const viewer: [number, number, number] = [cam.position.x, cam.position.y, cam.position.z];
    for (const e of entries) {
      // A region's label sits on the near edge of its ring
      const p = e.body.type === "region" ? regionAnchor(e.body, viewer, blend) : scenePosition(e.body, ephemeris, t, blend);
      e.visible = false;
      e.present = !!p && solarSystemVisible;
      if (!p || !solarSystemVisible) continue;
      e.world.set(p[0], p[1], p[2]);
      e.radius = e.body.type === "spacecraft" || e.body.type === "region" ? 0 : blendRadius(e.body.radius, blend);
      e.dist = cam.position.distanceTo(e.world);
      e.px = (e.radius / Math.max(e.dist, 1e-12)) * focal;
      _ndc.copy(e.world).project(cam);
      if (_ndc.z > 1 || _ndc.z < -1) continue; // behind the camera
      e.x = ((_ndc.x + 1) / 2) * size.width;
      e.y = ((1 - _ndc.y) / 2) * size.height;
      e.visible = e.x > -50 && e.x < size.width + 50 && e.y > -50 && e.y < size.height + 50;
    }

    // ---- Occlusion: is a nearer sphere between the camera and this body? ----
    for (const e of entries) {
      if (!e.visible) continue;
      _toBody.copy(e.world).sub(cam.position).normalize();
      for (const o of entries) {
        if (o === e || !o.present || o.radius === 0 || o.dist >= e.dist) continue;
        _toOther.copy(o.world).sub(cam.position);
        const along = _toOther.dot(_toBody);
        if (along <= 0) continue;
        const miss2 = _toOther.lengthSq() - along * along;
        if (miss2 < o.radius * o.radius) {
          e.visible = false;
          break;
        }
      }
    }

    // ---- Decide labels and markers ----
    const parentPx = (body: CelestialBody) => {
      const parent = getParent(body);
      return (parent && byId.get(parent.id)?.px) || 0;
    };

    const candidates: Entry[] = [];
    for (const e of entries) {
      const marker = overlayStore.markers.get(e.body.id);
      const onPlanet = getParent(e.body)?.type === "planet";
      let wantsMarker = false;
      let wantsLabel = false;

      if (e.visible && !artemisActive) {
        const isSpacecraft = e.body.type === "spacecraft";
        const important = e.body.id === hovered || e.body.id === selectedId;
        // Filters: hidden kinds still show once selected
        const filteredOut =
          !important && ((isSpacecraft && !layers.spacecraft) || (e.body.type === "region" && !layers.belt));
        const planetPx = onPlanet ? parentPx(e.body) : Infinity;
        wantsMarker =
          !filteredOut && e.body.type !== "region" && planetPx >= PLANET_DISC_MARKER_PX && (isSpacecraft || e.px < MARKER_MAX_PX);
        if (filteredOut || (!layers.labels && !important)) wantsLabel = false;
        else if (e.body.type === "star") wantsLabel = e.px < MARKER_MAX_PX * 2 || important;
        else wantsLabel = (planetPx >= PLANET_DISC_LABEL_PX && e.px < LABEL_MAX_PX) || important;
      } else if (e.visible && artemisActive) {
        wantsLabel = e.body.map === "earth" || e.body.map === "moon";
      }

      if (marker) {
        show(marker, wantsMarker);
        if (wantsMarker) marker.style.transform = `translate3d(${e.x}px, ${e.y}px, 0)`;
        setActive(marker, e.body.id === hovered || e.body.id === selectedId);
      }
      if (wantsLabel) candidates.push(e);
      else {
        const label = overlayStore.labels.get(e.body.id);
        if (label) show(label, false);
      }
    }

    // Highest priority first; a label that would overlap one already placed is hidden
    candidates.sort((a, b) => priority(b.body, hovered, selectedId) - priority(a.body, hovered, selectedId));
    const placed: [number, number, number, number][] = [];
    for (const e of candidates) {
      const label = overlayStore.labels.get(e.body.id);
      if (!label) continue;
      let w = widths.get(e.body.id);
      if (!w) {
        w = label.offsetWidth || 60;
        widths.set(e.body.id, w);
      }
      const left = e.x - w / 2;
      const top = e.y - Math.max(e.px, 3) - LABEL_GAP_PX - LABEL_HEIGHT_PX;
      const rect: [number, number, number, number] = [left - LABEL_PADDING_PX, top, left + w + LABEL_PADDING_PX, top + LABEL_HEIGHT_PX];
      const overlaps = placed.some((r) => rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1]);
      if (overlaps) {
        show(label, false);
        continue;
      }
      placed.push(rect);
      label.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      // During a mission the HUD drives the camera: labels are just names
      label.style.pointerEvents = artemisActive ? "none" : "auto";
      setActive(label, e.body.id === hovered || e.body.id === selectedId);
      show(label, true);
    }

    // ---- Selection ring ----
    const ring = overlayStore.ring;
    if (ring) {
      const se = selectedId != null ? byId.get(selectedId) : undefined;
      const visible = !!se && se.visible && !artemisActive && se.body.type !== "region";
      show(ring, visible);
      if (visible && se) {
        const d = Math.max(se.px * 2 + 12, 18);
        ring.style.width = `${d}px`;
        ring.style.height = `${d}px`;
        ring.style.transform = `translate3d(${se.x - d / 2}px, ${se.y - d / 2}px, 0)`;
      }
    }

    // ---- Scale bar (realistic scale only: log distances aren't linear) ----
    const bar = overlayStore.scaleBar;
    const barText = overlayStore.scaleBarText;
    if (bar && barText) {
      const visible = blend > 0.98 && solarSystemVisible && !artemisActive;
      show(bar, visible);
      if (visible) {
        const target = controls?.target ?? new THREE.Vector3();
        const dist = cam.position.distanceTo(target);
        const kmPerPx = ((2 * dist * Math.tan((cam.fov * Math.PI) / 360)) / size.height) * KM_PER_UNIT;
        const { km, text } = niceScale(kmPerPx * SCALE_BAR_TARGET_PX);
        const width = `${Math.round(km / kmPerPx)}px`;
        if (bar.style.width !== width) bar.style.width = width;
        if (barText.textContent !== text) barText.textContent = text;
      }
    }
  });

  return null;
}
