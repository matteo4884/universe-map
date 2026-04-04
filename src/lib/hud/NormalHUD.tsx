import { useContext } from "react";
import { ScaleContext } from "../../context/contexts";
import { CameraNavigationContext } from "../../context/cameraNavigation";
import { EphemerisContext } from "../../context/ephemeris";

interface NormalHUDProps {
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  onToggleExplore: () => void;
  exploreOpen: boolean;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
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

export default function NormalHUD({ showOrbits, setShowOrbits, onToggleExplore, exploreOpen }: NormalHUDProps) {
  const scaleCtx = useContext(ScaleContext);
  const cameraNav = useContext(CameraNavigationContext);
  const ephemeris = useContext(EphemerisContext);

  if (!scaleCtx) return null;
  const { realisticMode, setRealisticMode } = scaleCtx;

  const isOnline = !!ephemeris.positions && !ephemeris.error;
  const lastUpdate = ephemeris.loadedAt
    ? new Date(ephemeris.loadedAt).toLocaleTimeString()
    : null;

  return (
    <div className="fixed inset-0 z-[999999999] pointer-events-none font-mono">

      {/* ============================== */}
      {/* DESKTOP (sm and above)         */}
      {/* ============================== */}

      {/* Top-left: Title + Status */}
      <div className="absolute top-4 left-4 pointer-events-auto hidden sm:block">
        <div className="text-[11px] tracking-[6px] uppercase text-white font-light opacity-60">
          Universe Map
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 text-[8px] ${isOnline ? "text-[#00ff88]" : "text-[#ff6b35]"}`}>
            <span className={`inline-block w-[5px] h-[5px] rounded-full ${isOnline ? "bg-[#00ff88] shadow-[0_0_4px_#00ff88]" : "bg-[#ff6b35]"}`} />
            {isOnline ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        {lastUpdate && (
          <div className="text-[10px] text-[rgba(255,255,255,0.35)] mt-1 tracking-[1px]">
            Last update {lastUpdate}
          </div>
        )}
      </div>

      {/* Top-right: Controls */}
      <div className="absolute top-4 right-4 hidden sm:flex flex-col items-end gap-2 pointer-events-auto">
        {/* Camera presets */}
        <div className="flex flex-col gap-1.5">
          {(["top", "front", "home"] as const).map((view) => (
            <button
              key={view}
              onClick={() => cameraNav?.setViewSnap(view)}
              className="text-[10px] tracking-[2px] uppercase py-1.5 px-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.6)] hover:text-white transition-colors cursor-pointer text-right"
            >
              {view}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-full border-t border-[rgba(255,255,255,0.1)] my-1" />

        {/* Toggles */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-3">
            <span className="text-[9px] text-[rgba(255,255,255,0.4)] tracking-[2px] uppercase">Scale</span>
            <Toggle
              on={realisticMode}
              onToggle={() => {
                setRealisticMode(!realisticMode);
                cameraNav?.setViewSnap("home");
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <span className="text-[9px] text-[rgba(255,255,255,0.4)] tracking-[2px] uppercase">Orbits</span>
            <Toggle on={showOrbits} onToggle={() => setShowOrbits(!showOrbits)} />
          </div>
        </div>

        {/* Separator */}
        <div className="w-full border-t border-[rgba(255,255,255,0.1)] my-1" />

        {/* Explore button */}
        <button
          onClick={onToggleExplore}
          className="text-[10px] tracking-[2px] uppercase py-2 px-4 rounded border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.18)] text-[rgba(255,255,255,0.7)] hover:text-white transition-colors cursor-pointer"
        >
          {exploreOpen ? "✕ Close" : "☰ Explore"}
        </button>
      </div>

      {/* ============================== */}
      {/* MOBILE (below sm)              */}
      {/* ============================== */}

      {/* Mobile: Top-left - Title + Status */}
      <div className="sm:hidden absolute top-3 left-3 pointer-events-auto">
        <div className="text-[9px] tracking-[4px] uppercase text-white font-light opacity-60">
          Universe Map
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-flex items-center gap-1 text-[7px] ${isOnline ? "text-[#00ff88]" : "text-[#ff6b35]"}`}>
            <span className={`inline-block w-[4px] h-[4px] rounded-full ${isOnline ? "bg-[#00ff88]" : "bg-[#ff6b35]"}`} />
            {isOnline ? "LIVE" : "OFF"}
          </span>
        </div>
      </div>

      {/* Mobile: Top-right - Controls */}
      <div className="sm:hidden absolute top-3 right-3 flex gap-1.5 pointer-events-auto">
        {/* Camera presets */}
        {(["top", "front", "home"] as const).map((view) => (
          <button
            key={view}
            onClick={() => cameraNav?.setViewSnap(view)}
            className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-[rgba(255,255,255,0.6)] text-[8px] uppercase tracking-[1px] cursor-pointer active:bg-[rgba(255,255,255,0.15)]"
          >
            {view === "top" ? "T" : view === "front" ? "F" : "H"}
          </button>
        ))}
      </div>

      {/* Mobile: Bottom bar - Toggles + Explore */}
      <div className="sm:hidden absolute bottom-16 left-0 right-0 px-3 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-[rgba(255,255,255,0.4)] tracking-[1px] uppercase">Scale</span>
              <Toggle
                on={realisticMode}
                onToggle={() => {
                  setRealisticMode(!realisticMode);
                  cameraNav?.setViewSnap("home");
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-[rgba(255,255,255,0.4)] tracking-[1px] uppercase">Orbits</span>
              <Toggle on={showOrbits} onToggle={() => setShowOrbits(!showOrbits)} />
            </div>
          </div>
          <button
            onClick={onToggleExplore}
            className="text-[9px] tracking-[1px] uppercase py-1.5 px-3 rounded border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.7)] cursor-pointer active:bg-[rgba(255,255,255,0.18)]"
          >
            {exploreOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
    </div>
  );
}
