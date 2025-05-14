import React, { useState } from "react";
import { ScaleDistanceScaleContext } from "./contexts";

type Props = {
  children: React.ReactNode;
};

export function ScaleDistanceScaleProvider({ children }: Props) {
  const [scaleDistance, setScaleDistance] = useState<number>(50);

  return (
    <ScaleDistanceScaleContext.Provider
      value={{ scaleDistance, setScaleDistance }}
    >
      {children}
    </ScaleDistanceScaleContext.Provider>
  );
}
