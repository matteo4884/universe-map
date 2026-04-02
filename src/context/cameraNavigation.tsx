import { createContext, useState } from "react";
import { CelestialBody } from "../data";

export type CameraNavigationContextType = {
  flyTo: CelestialBody | null;
  setFlyTo: (body: CelestialBody | null) => void;
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

  return (
    <CameraNavigationContext.Provider value={{ flyTo, setFlyTo }}>
      {children}
    </CameraNavigationContext.Provider>
  );
}
