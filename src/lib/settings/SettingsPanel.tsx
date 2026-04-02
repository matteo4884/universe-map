import { useState, useContext } from "react";
import { IoSettingsSharp } from "react-icons/io5";
import { ScaleContext } from "../../context/contexts";
import { CameraNavigationContext } from "../../context/cameraNavigation";

interface SettingsPanelProps {
  showOrbits: boolean;
  setShowOrbits: (value: boolean) => void;
}

function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`w-8 h-4 rounded-full transition-colors relative ${
        on ? "bg-[#4a90d9]" : "bg-[#333]"
      }`}
      onClick={onToggle}
    >
      <div
        className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${
          on ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPanel({
  showOrbits,
  setShowOrbits,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const scaleCtx = useContext(ScaleContext);
  const cameraNav = useContext(CameraNavigationContext);
  if (!scaleCtx) return null;
  const { realisticMode, setRealisticMode } = scaleCtx;

  return (
    <div className="fixed z-[999999999] top-0 left-0">
      {/* Gear icon — always visible */}
      <button
        className="p-2.5 bg-[#000000b3] bg-blur-custom rounded-br-lg text-white"
        onClick={() => setOpen(!open)}
      >
        <IoSettingsSharp
          className={`text-lg transition-opacity ${open ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="mt-1 ml-0 p-4 w-52 bg-[#000000cc] bg-blur-custom text-white rounded-r-lg rounded-bl-lg">
          {/* Realistic mode */}
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-[#999] uppercase">
              Realistic scale
            </span>
            <Toggle
              on={realisticMode}
              onToggle={() => {
                setRealisticMode(!realisticMode);
                cameraNav?.setViewSnap("home");
              }}
            />
          </div>

          {/* Show orbits */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-[#999] uppercase">
              Show orbits
            </span>
            <Toggle on={showOrbits} onToggle={() => setShowOrbits(!showOrbits)} />
          </div>

          {/* View presets */}
          <div className="border-t border-[#ffffff15] pt-3">
            <div className="text-[10px] uppercase tracking-[2px] text-[#999] mb-2">
              Camera
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 text-[10px] uppercase tracking-wider py-2 rounded bg-[#ffffff0d] hover:bg-[#ffffff26] transition-colors"
                onClick={() => {
                  cameraNav?.setViewSnap("top");
                  setOpen(false);
                }}
              >
                Top
              </button>
              <button
                className="flex-1 text-[10px] uppercase tracking-wider py-2 rounded bg-[#ffffff0d] hover:bg-[#ffffff26] transition-colors"
                onClick={() => {
                  cameraNav?.setViewSnap("front");
                  setOpen(false);
                }}
              >
                Front
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
