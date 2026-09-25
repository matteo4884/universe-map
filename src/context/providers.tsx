import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CelestialBody } from "../data";
import { ScaleContext, CameraNavigationContext, ViewDirection } from "./contexts";

type Props = {
  children: React.ReactNode;
};

export function ScaleProvider({ children }: Props) {
  const [realisticMode, setRealisticMode] = useState(false);
  // Kept in a ref: 3D components read it every frame, so animating it
  // must not re-render the scene tree
  const blendRef = useRef(0);

  useEffect(() => {
    const target = realisticMode ? 1 : 0;
    let frame: number;

    function step() {
      const current = blendRef.current + (target - blendRef.current) * 0.08;
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
