import { createContext } from "react";

export type ScaleContextType = {
  scaleDistance: number;
  setScaleDistance: (value: number) => void;
};

// valore iniziale "vuoto", verrà riempito dal provider
export const ScaleDistanceScaleContext = createContext<
  ScaleContextType | undefined
>(undefined);
