import { createContext, useState } from "react";
import { CelestialBody } from "../data";

export type ViewDirection = "top" | "front" | "home" | "milkyway" | null;

export type CameraNavigationContextType = {
  flyTo: CelestialBody | null;
  setFlyTo: (body: CelestialBody | null) => void;
  viewSnap: ViewDirection;
  setViewSnap: (dir: ViewDirection) => void;
};

export const CameraNavigationContext = createContext<
  CameraNavigationContextType | undefined
>(undefined);

export function CameraNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flyTo, setFlyTo] = useState<CelestialBody | null>(null);
  const [viewSnap, setViewSnap] = useState<ViewDirection>(null);

  return (
    <CameraNavigationContext.Provider
      value={{ flyTo, setFlyTo, viewSnap, setViewSnap }}
    >
      {children}
    </CameraNavigationContext.Provider>
  );
}
