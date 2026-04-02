import React, { useState, useEffect, useRef } from "react";
import { ScaleContext } from "./contexts";

type Props = {
  children: React.ReactNode;
};

export function ScaleProvider({ children }: Props) {
  const [realisticMode, setRealisticMode] = useState(false);
  const [blend, setBlend] = useState(0); // 0 = log, 1 = realistic
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = realisticMode ? 1 : 0;
    let frame: number;
    let current = blend;

    function step() {
      const target = targetRef.current;
      current += (target - current) * 0.08;
      if (Math.abs(current - target) < 0.001) {
        setBlend(target);
        return;
      }
      setBlend(current);
      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [realisticMode]);

  return (
    <ScaleContext.Provider value={{ realisticMode, setRealisticMode, blend }}>
      {children}
    </ScaleContext.Provider>
  );
}
