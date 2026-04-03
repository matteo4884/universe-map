import { createContext } from "react";

export type ScaleContextType = {
  realisticMode: boolean;
  setRealisticMode: (value: boolean) => void;
  blend: number; // 0 = log (easy), 1 = realistic — animated
  setBlendInstant: (value: number) => void; // skip animation, set blend directly
};

export const ScaleContext = createContext<ScaleContextType | undefined>(
  undefined
);
