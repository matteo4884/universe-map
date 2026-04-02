import { createContext } from "react";
import { UseEphemerisResult } from "../hooks/useEphemeris";

export const EphemerisContext = createContext<UseEphemerisResult>({
  positions: null,
  trajectories: null,
  loading: true,
  error: false,
});
