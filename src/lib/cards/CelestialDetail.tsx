import { useContext } from "react";
import { CelestialBody } from "../../data";
import { FaEye } from "react-icons/fa";
import { CameraNavigationContext } from "../../context/cameraNavigation";

interface CelestialDetailProps {
  body: CelestialBody;
  onSelectChild: (index: number) => void;
}

export default function CelestialDetail({
  body,
  onSelectChild,
}: CelestialDetailProps) {
  const cameraNav = useContext(CameraNavigationContext);

  const typeLabel =
    body.type === "star"
      ? "Star"
      : body.type === "planet"
        ? body.info.atmosphere.length > 0 &&
          body.info.gravity > 5 &&
          body.radius > 10000
          ? "Gas Giant"
          : "Rocky Planet"
        : "Moon";

  return (
    <div className="flex flex-col gap-4">
      {/* Hero section */}
      <div className="flex gap-4 items-center">
        <img
          src={`/images/${body.image}`}
          alt={body.name}
          className="w-28 h-28 object-contain flex-shrink-0"
        />
        <div>
          <div className="text-2xl font-bold uppercase tracking-wider">
            {body.name}
          </div>
          <div className="text-[10px] text-[#888] uppercase tracking-[3px] mb-3">
            {typeLabel}
          </div>
          <div className="text-xs text-[#aaa] leading-relaxed">
            <div>
              Radius: <span className="text-white">{body.radius.toLocaleString()} km</span>
            </div>
            <div>
              Mass: <span className="text-white">{body.info.mass}</span>
            </div>
            <div>
              Temp: <span className="text-white">{body.info.temperature}°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#ffffff15]" />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Day</div>
          <div className="text-sm font-semibold">{body.info.dayLength}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Year</div>
          <div className="text-sm font-semibold">{body.info.yearLength}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">
            {body.type === "star" ? "Planets" : "Moons"}
          </div>
          <div className="text-sm font-semibold">{body.children.length}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Gravity</div>
          <div className="text-sm font-semibold">{body.info.gravity} m/s²</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Tilt</div>
          <div className="text-sm font-semibold">{body.info.axialTilt}°</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#666] uppercase">Rings</div>
          <div className="text-sm font-semibold">
            {body.info.rings ? "Yes" : "No"}
          </div>
        </div>
      </div>

      {/* Atmosphere */}
      {body.info.atmosphere.length > 0 && (
        <div>
          <div className="text-[9px] text-[#666] uppercase tracking-wider mb-2">
            Atmosphere
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {body.info.atmosphere.map((comp) => (
              <span
                key={comp}
                className="bg-[#ffffff12] px-2 py-1 rounded text-[11px]"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fun fact */}
      <div className="bg-[#ffffff08] border-l-2 border-[#4a90d9] py-2.5 px-3 rounded-r-lg text-xs text-[#aaa] leading-relaxed">
        {body.info.funFact}
      </div>

      {/* Go to button */}
      <button
        className="w-full py-2.5 bg-[#ffffff15] border border-[#ffffff20] rounded-lg text-[13px] uppercase tracking-[2px] cursor-pointer hover:bg-[#ffffff25] transition-colors"
        onClick={() => cameraNav?.setFlyTo(body)}
      >
        Go to {body.name} →
      </button>

      {/* Children list */}
      {body.children.length > 0 && (
        <div>
          <div className="text-[9px] text-[#666] uppercase tracking-wider mb-2">
            {body.type === "star" ? "Planets" : "Moons"}
          </div>
          <div>
            {body.children.map((child, index) => (
              <div
                key={child.id}
                className="py-2 first:border-t border-b border-[#ffffff1e] flex justify-between items-center"
              >
                <span
                  className="uppercase text-sm font-bold cursor-pointer hover:text-[#4a90d9] transition-colors"
                  onClick={() => onSelectChild(index)}
                >
                  {child.name}
                </span>
                <FaEye
                  className="cursor-pointer hover:opacity-70 text-sm"
                  onClick={() => cameraNav?.setFlyTo(child)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
