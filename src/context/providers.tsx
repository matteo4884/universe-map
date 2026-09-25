import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { CelestialBody } from "../data";
import { getBodyBySlug } from "../helper/bodies";
import {
  ScaleContext,
  CameraNavigationContext,
  ViewDirection,
  TimeContext,
  SelectionContext,
  SelectOptions,
  LayersContext,
  Layer,
} from "./contexts";

type Props = {
  children: React.ReactNode;
};

// Scale transition rate (1/s): ~99% of the way in 1 second
const BLEND_SPEED = 5;

export function ScaleProvider({ children }: Props) {
  const [realisticMode, setRealisticMode] = useState(false);
  // Kept in a ref: 3D components read it every frame, so animating it
  // must not re-render the scene tree
  const blendRef = useRef(0);

  useEffect(() => {
    const target = realisticMode ? 1 : 0;
    let frame: number;
    let last = performance.now();

    // Exponential ease toward the target, timed in seconds so it takes
    // about a second whatever the frame rate
    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const current = blendRef.current + (target - blendRef.current) * (1 - Math.exp(-BLEND_SPEED * dt));
      if (Math.abs(current - target) < 0.001) {
        blendRef.current = target;
        return;
      }
      blendRef.current = current;
      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [realisticMode]);

  const setBlendInstant = useCallback((value: number) => {
    blendRef.current = value;
  }, []);

  const value = useMemo(
    () => ({ realisticMode, setRealisticMode, blendRef, setBlendInstant }),
    [realisticMode, setBlendInstant]
  );

  return (
    <ScaleContext.Provider value={value}>
      {children}
    </ScaleContext.Provider>
  );
}

export function CameraNavigationProvider({ children }: Props) {
  const [flyTo, setFlyTo] = useState<CelestialBody | null>(null);
  const [viewSnap, setViewSnap] = useState<ViewDirection>(null);

  const value = useMemo(
    () => ({ flyTo, setFlyTo, viewSnap, setViewSnap }),
    [flyTo, viewSnap]
  );

  return (
    <CameraNavigationContext.Provider value={value}>
      {children}
    </CameraNavigationContext.Provider>
  );
}

/**
 * Simulated clock. Time is derived from an anchor instead of being stored
 * per frame: sim = anchorSim + (real − anchorReal) × rate.
 */
export function TimeProvider({ children }: Props) {
  const [rate, setRateState] = useState(1);
  const [paused, setPausedState] = useState(false);
  const [live, setLive] = useState(true);
  const anchor = useRef({ real: Date.now(), sim: Date.now(), rate: 1, paused: false });
  // Frozen once per frame (see tick): at high speeds bodies move a lot per
  // millisecond, and everything drawn in a frame must agree on the instant
  const frameTime = useRef<number | null>(null);

  const computeTime = useCallback(() => {
    const a = anchor.current;
    return a.paused ? a.sim : a.sim + (Date.now() - a.real) * a.rate;
  }, []);

  const getTime = useCallback(() => frameTime.current ?? computeTime(), [computeTime]);

  const tick = useCallback(() => {
    frameTime.current = computeTime();
  }, [computeTime]);

  /** Re-anchor at the current simulated instant, then apply changes */
  const reanchor = useCallback(
    (changes: Partial<{ sim: number; rate: number; paused: boolean }>) => {
      const sim = changes.sim ?? computeTime();
      anchor.current = {
        real: Date.now(),
        sim,
        rate: changes.rate ?? anchor.current.rate,
        paused: changes.paused ?? anchor.current.paused,
      };
      frameTime.current = sim;
      setRateState(anchor.current.rate);
      setPausedState(anchor.current.paused);
    },
    [computeTime]
  );

  const setRate = useCallback((r: number) => {
    reanchor({ rate: r });
    setLive(false);
  }, [reanchor]);

  const setPaused = useCallback((p: boolean) => {
    reanchor({ paused: p });
    setLive(false);
  }, [reanchor]);

  const setTime = useCallback((ms: number) => {
    reanchor({ sim: ms });
    setLive(false);
  }, [reanchor]);

  const goLive = useCallback(() => {
    reanchor({ sim: Date.now(), rate: 1, paused: false });
    setLive(true);
  }, [reanchor]);

  const value = useMemo(
    () => ({ getTime, tick, rate, paused, live, setRate, setPaused, setTime, goLive }),
    [getTime, tick, rate, paused, live, setRate, setPaused, setTime, goLive]
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

function bodyFromUrl(): CelestialBody | null {
  const slug = new URLSearchParams(window.location.search).get("body");
  return slug ? getBodyBySlug(slug) ?? null : null;
}

function writeBodyToUrl(body: CelestialBody | null) {
  const url = new URL(window.location.href);
  const current = url.searchParams.get("body");
  const next = body?.map ?? null;
  if (current === next) return;
  if (next) url.searchParams.set("body", next);
  else url.searchParams.delete("body");
  history.pushState(null, "", url.toString());
}

/** Selected body, kept in sync with ?body=… (shareable links, back button) */
export function SelectionProvider({ children }: Props) {
  const cameraNav = useContext(CameraNavigationContext);
  const setFlyTo = cameraNav?.setFlyTo;
  const setViewSnap = cameraNav?.setViewSnap;
  const [selected, setSelected] = useState<CelestialBody | null>(bodyFromUrl);
  const [panelOpen, setPanelOpen] = useState(() => bodyFromUrl() !== null);

  const flyTo = useCallback(
    (body: CelestialBody) => {
      if (body.type === "galaxy") setViewSnap?.("milkyway");
      else setFlyTo?.(body);
    },
    [setFlyTo, setViewSnap]
  );

  const select = useCallback(
    (body: CelestialBody | null, { fly = false, openPanel = true }: SelectOptions = {}) => {
      setSelected(body);
      if (body && openPanel) setPanelOpen(true);
      if (body && fly) flyTo(body);
      writeBodyToUrl(body);
    },
    [flyTo]
  );

  // A shared link flies straight to its body (once)
  const initialBody = useRef(selected);
  useEffect(() => {
    if (!initialBody.current) return;
    flyTo(initialBody.current);
    initialBody.current = null;
  }, [flyTo]);

  // Back/forward buttons walk through previous selections
  useEffect(() => {
    const onPop = () => {
      const body = bodyFromUrl();
      setSelected(body);
      if (body) flyTo(body);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [flyTo]);

  const value = useMemo(
    () => ({ selected, select, panelOpen, setPanelOpen }),
    [selected, select, panelOpen]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

const LAYERS_KEY = "universe-map:layers";
const DEFAULT_LAYERS: Record<Layer, boolean> = { orbits: true, spacecraft: true, belt: true, labels: true };

function loadLayers(): Record<Layer, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? "{}");
    return { ...DEFAULT_LAYERS, ...saved };
  } catch {
    return DEFAULT_LAYERS;
  }
}

/** Scene filters, remembered between visits */
export function LayersProvider({ children }: Props) {
  const [layers, setLayers] = useState(loadLayers);

  const setLayer = useCallback((layer: Layer, visible: boolean) => {
    setLayers((prev) => {
      const next = { ...prev, [layer]: visible };
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked: the choice lasts until reload
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ layers, setLayer }), [layers, setLayer]);
  return <LayersContext.Provider value={value}>{children}</LayersContext.Provider>;
}
