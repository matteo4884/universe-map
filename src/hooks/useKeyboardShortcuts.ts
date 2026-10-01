import { useContext, useEffect } from "react";
import {
  CameraNavigationContext,
  ScaleContext,
  SelectionContext,
  TimeContext,
  LayersContext,
} from "../context/contexts";
import { getBodyBySlug } from "../helper/bodies";
import { NUMBER_KEY_BODIES } from "../helper/shortcuts";
import { stepSpeed } from "../helper/timeSpeeds";

interface Options {
  enabled: boolean;
  modalOpen: boolean;
  /** Where the camera is: the views (O, T, S) apply to it */
  level: "system" | "galaxy";
}

/** Global shortcuts (listed in helper/shortcuts.ts), ignored while typing */
export function useKeyboardShortcuts({ enabled, modalOpen, level }: Options) {
  const { select, setPanelOpen } = useContext(SelectionContext);
  const cameraNav = useContext(CameraNavigationContext);
  const scale = useContext(ScaleContext);
  const time = useContext(TimeContext);
  const { layers, setLayer } = useContext(LayersContext);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || modalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

      const key = e.key.toLowerCase();
      const galaxy = level === "galaxy";
      if (/^[0-9]$/.test(key)) {
        const body = getBodyBySlug(NUMBER_KEY_BODIES[Number(key)]);
        if (body) select(body, { fly: true });
        return;
      }
      switch (key) {
        case "escape":
          setPanelOpen(false);
          break;
        case "g":
          cameraNav?.setViewSnap(galaxy ? "home" : "milkyway");
          break;
        case "o":
          cameraNav?.setViewSnap(galaxy ? "milkyway" : "home");
          break;
        case "t":
          cameraNav?.setViewSnap(galaxy ? "milkyway-top" : "top");
          break;
        case "s":
        case "f":
          cameraNav?.setViewSnap(galaxy ? "milkyway-side" : "front");
          break;
        case "r":
          scale?.setRealisticMode(!scale.realisticMode);
          break;
        case "l":
          setLayer("orbits", !layers.orbits);
          break;
        case " ":
          // Space on a focused button already clicks it
          if (target?.tagName === "BUTTON") return;
          e.preventDefault();
          time?.setPaused(!time.paused);
          break;
        case "[":
          if (time) time.setRate(stepSpeed(time.rate, -1));
          break;
        case "]":
          if (time) time.setRate(stepSpeed(time.rate, 1));
          break;
        case "n":
          time?.goLive();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, modalOpen, level, layers, setLayer, select, setPanelOpen, cameraNav, scale, time]);
}
