import { useState, useContext } from "react";
import { IoSettingsSharp } from "react-icons/io5";
import { ScaleDistanceScaleContext } from "../../context/contexts";

interface SettingsPanelProps {
  showOrbits: boolean;
  setShowOrbits: (value: boolean) => void;
}

export default function SettingsPanel({
  showOrbits,
  setShowOrbits,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance) return null;
  const { scaleDistance, setScaleDistance } = contextScaleDistance;

  return (
    <div className="fixed z-[999999999] top-0 left-0">
      <div
        className={`bg-[#000000b3] bg-blur-custom text-white rounded-br-lg overflow-hidden transition-all duration-300 ${
          open ? "p-4 w-56" : "p-2 w-auto cursor-pointer"
        }`}
        onClick={!open ? () => setOpen(true) : undefined}
      >
        {!open ? (
          <IoSettingsSharp className="text-lg opacity-60 hover:opacity-100 transition-opacity" />
        ) : (
          <>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase tracking-[2px] text-[#888]">
                Settings
              </span>
              <button
                className="text-[#888] hover:text-white text-xs"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Scale distance */}
            <div className="mb-3">
              <div className="text-[10px] text-[#666] uppercase mb-1">
                Scale distance:{" "}
                {scaleDistance === 1 ? "Real" : `1 : ${scaleDistance}`}
              </div>
              <input
                onChange={(e) => setScaleDistance(Number(e.target.value))}
                type="range"
                min="1"
                max="1000"
                value={scaleDistance}
                className="custom-range w-full"
              />
            </div>

            {/* Show orbits */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-[#666] uppercase">
                Show orbits
              </span>
              <button
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  showOrbits ? "bg-[#4a90d9]" : "bg-[#333]"
                }`}
                onClick={() => setShowOrbits(!showOrbits)}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${
                    showOrbits ? "left-4" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
