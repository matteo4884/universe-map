import { useContext, useEffect, useState } from "react";
import { TimeContext } from "../context/contexts";

/** The simulated time, re-read once per second — for UI that doesn't need every frame */
export function useSimTimeSeconds(): number {
  const time = useContext(TimeContext);
  const [t, setT] = useState(() => time?.getTime() ?? Date.now());
  useEffect(() => {
    if (!time) return;
    setT(time.getTime());
    const id = window.setInterval(() => setT(time.getTime()), 1000);
    return () => clearInterval(id);
  }, [time]);
  return t;
}
