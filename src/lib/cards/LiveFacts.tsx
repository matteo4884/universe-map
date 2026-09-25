import { useContext } from "react";
import { CelestialBody } from "../../data";
import { EphemerisContext, TimeContext } from "../../context/contexts";
import { liveFacts } from "../../helper/bodyFacts";
import { useSimTimeSeconds } from "../../hooks/useSimTimeSeconds";

/** Distances, light travel time and Moon phase at the simulated time, refreshed every second */
export default function LiveFacts({ body }: { body: CelestialBody }) {
  const { ephemeris } = useContext(EphemerisContext);
  const time = useContext(TimeContext);
  const t = useSimTimeSeconds();
  const facts = ephemeris ? liveFacts(body, ephemeris, t) : [];

  if (facts.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] text-white/55 uppercase tracking-wider mb-2">
        {time?.live ? (
          <>
            <span className="w-[5px] h-[5px] rounded-full bg-[#00ff88]" />
            Right now
          </>
        ) : (
          "At the selected date"
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
        {facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-white/55">{f.label}</dt>
            <dd className="text-white text-right tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
