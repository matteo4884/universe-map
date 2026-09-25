import { useContext } from "react";
import { CelestialBody, BodyCategory } from "../../data";
import { FaEye } from "react-icons/fa";
import { SelectionContext, EphemerisContext } from "../../context/contexts";
import { useSimTimeSeconds } from "../../hooks/useSimTimeSeconds";
import { getParent } from "../../helper/bodies";
import { headlineFacts, bodyStats } from "../../helper/bodyFacts";
import BodyImage from "./BodyImage";
import LiveFacts from "./LiveFacts";

interface CelestialDetailProps {
  body: CelestialBody;
  /** Called after a camera flight starts (e.g. to close an overlay covering the scene) */
  onFly?: () => void;
}

const GROUP_TITLES: Partial<Record<BodyCategory, string>> = {
  Star: "Stars",
  "Terrestrial planet": "Planets",
  "Gas giant": "Planets",
  "Ice giant": "Planets",
  "Dwarf planet": "Dwarf planets",
  Moon: "Moons",
  Spacecraft: "Spacecraft",
  "Asteroid belt": "Regions",
};

/** Children grouped under a heading per kind, in data order */
function groupChildren(body: CelestialBody): [string, CelestialBody[]][] {
  const groups = new Map<string, CelestialBody[]>();
  for (const child of body.children) {
    const title = GROUP_TITLES[child.category] ?? child.category;
    groups.set(title, [...(groups.get(title) ?? []), child]);
  }
  return [...groups.entries()];
}

export default function CelestialDetail({ body, onFly }: CelestialDetailProps) {
  const { select } = useContext(SelectionContext);
  const { ephemeris } = useContext(EphemerisContext);
  const t = useSimTimeSeconds();
  const parent = getParent(body);

  // Spacecraft only exist from launch: nothing to fly to before that
  const existsNow = (b: CelestialBody) => b.type !== "spacecraft" || !ephemeris || ephemeris.relative(b, t) !== null;

  const flyTo = (target: CelestialBody) => {
    select(target, { fly: true });
    onFly?.();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Hero section */}
      <div className="flex gap-4 items-center">
        <BodyImage body={body} />
        <div className="min-w-0">
          <h2 className="text-2xl font-bold uppercase tracking-wider leading-tight">{body.name}</h2>
          <div className="text-[11px] text-white/60 uppercase tracking-[3px] mt-1 mb-3">
            {body.type === "region" ? "Region" : body.category}
          </div>
          <div className="text-[13px] text-white/60 leading-relaxed">
            {headlineFacts(body).map((f) => (
              <div key={f.label}>
                {f.label}: <span className="text-white">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Stats grid */}
      <dl className="grid grid-cols-3 gap-3">
        {bodyStats(body).map((s) => (
          <div key={s.label} className="text-center">
            <dt className="text-[10px] text-white/55 uppercase tracking-wide">{s.label}</dt>
            <dd className="text-sm font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <LiveFacts body={body} />

      {/* Atmosphere */}
      {body.info.atmosphere.length > 0 && (
        <div>
          <div className="text-[10px] text-white/55 uppercase tracking-wider mb-2">Atmosphere</div>
          <div className="flex gap-1.5 flex-wrap">
            {body.info.atmosphere.map((comp) => (
              <span key={comp} className="bg-white/10 px-2 py-1 rounded text-[12px]">
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fun fact */}
      <div className="bg-white/5 border-l-2 border-[#4a90d9] py-2.5 px-3 rounded-r-lg text-[13px] text-white/75 leading-relaxed">
        {body.info.funFact}
      </div>

      <button
        className="w-full py-3 bg-white/10 border border-white/15 rounded-lg text-[13px] uppercase tracking-[2px] cursor-pointer hover:bg-white/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/10"
        disabled={!existsNow(body)}
        onClick={() => flyTo(body)}
      >
        {existsNow(body) ? `Go to ${body.name} →` : "Not launched yet at this date"}
      </button>

      {/* Children, grouped by kind */}
      {groupChildren(body).map(([title, children]) => (
        <div key={title}>
          <div className="text-[10px] text-white/55 uppercase tracking-wider mb-2">{title}</div>
          <ul>
            {children.map((child) => (
              <li
                key={child.id}
                className="first:border-t border-b border-white/10 flex justify-between items-center hover:bg-white/5 transition-colors rounded"
              >
                <button
                  type="button"
                  className="flex-1 py-2.5 text-left uppercase text-sm font-bold cursor-pointer flex items-center gap-2"
                  onClick={() => select(child)}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: child.color }} aria-hidden="true" />
                  {child.name}
                </button>
                <button
                  type="button"
                  aria-label={`Fly to ${child.name}`}
                  title={existsNow(child) ? `Fly to ${child.name}` : "Not launched yet at this date"}
                  disabled={!existsNow(child)}
                  className="py-2.5 pl-3 text-white/70 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => flyTo(child)}
                >
                  <FaEye className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {parent && (
        <button
          className="w-full py-2 text-[12px] text-white/60 uppercase tracking-[2px] cursor-pointer hover:text-white transition-colors"
          onClick={() => select(parent)}
        >
          ← {parent.name}
        </button>
      )}
    </div>
  );
}
