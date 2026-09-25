import { useContext } from "react";
import { ScaleContext, TimeContext, EphemerisContext } from "../context/contexts";

/** What 3D components need every frame: simulated time, scale blend and the position model */
export function useSceneClock() {
  const scale = useContext(ScaleContext);
  const time = useContext(TimeContext);
  const { ephemeris } = useContext(EphemerisContext);
  if (!scale || !time) throw new Error("Must be within ScaleProvider and TimeProvider");
  return { blendRef: scale.blendRef, getTime: time.getTime, ephemeris };
}
