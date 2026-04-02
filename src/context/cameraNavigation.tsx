import { createContext, useState } from "react";
import { PlanetParam } from "../data";

export type CameraNavigationContextType = {
  flyTo: PlanetParam | null;
  setFlyTo: (planet: PlanetParam | null) => void;
};

export const CameraNavigationContext = createContext<
  CameraNavigationContextType | undefined
>(undefined);

export function CameraNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flyTo, setFlyTo] = useState<PlanetParam | null>(null);

  return (
    <CameraNavigationContext.Provider value={{ flyTo, setFlyTo }}>
      {children}
    </CameraNavigationContext.Provider>
  );
}
