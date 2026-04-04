import { useContext, useState } from "react";
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
  const [infoOpen, setInfoOpen] = useState(false);

  if (!scaleCtx) return null;
  const { realisticMode, setRealisticMode } = scaleCtx;

  const dataDate = ephemeris.loadedAt
    ? new Date(ephemeris.loadedAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <>
    {/* Info modal — rendered outside the HUD stacking context */}
    {infoOpen && (
      <div className="fixed inset-0 z-[99999999999] flex items-center justify-center pointer-events-auto font-mono">
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
        <div className="relative max-w-md mx-4 border border-[rgba(255,255,255,0.12)] rounded-xl overflow-hidden">
          {/* Gradient top accent */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#4a90d9] to-transparent" />

          <div className="bg-[#080810] p-8">
            {/* Title */}
            <div className="text-center mb-6">
              <div className="text-[9px] tracking-[6px] text-[#4a90d9] uppercase mb-2">About</div>
              <div className="text-xl font-bold tracking-[4px] text-white uppercase">Universe Map</div>
            </div>

            {/* Description */}
            <div className="text-[12px] text-[rgba(255,255,255,0.6)] leading-relaxed mb-6 text-center">
              An interactive 3D visualization of our Solar System and the Milky Way galaxy, with real scale distances and proportions. Built to offer an educational and illustrative experience of the cosmos we live in.
            </div>

            {/* Separator */}
            <div className="border-t border-[rgba(255,255,255,0.08)] mb-6" />

            {/* Credits grid */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.35)] uppercase">Built by</span>
                <a
                  href="https://matteobeu.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#4a90d9] hover:text-white transition-colors"
                >
                  Matteo Beu
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.35)] uppercase">Data</span>
                <span className="text-[11px] text-[rgba(255,255,255,0.6)]">NASA JPL Horizons</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.35)] uppercase">Engine</span>
                <span className="text-[11px] text-[rgba(255,255,255,0.6)]">Three.js + React Three Fiber</span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setInfoOpen(false)}
              className="w-full text-[10px] tracking-[2px] uppercase py-2.5 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.5)] hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-[999999999] pointer-events-none font-mono">

      {/* ============================== */}
      {/* DESKTOP (sm and above)         */}
      {/* ============================== */}

      {/* Top-left: Title + Status */}
      <div className="absolute top-4 left-4 pointer-events-auto hidden sm:block">
        <div className="text-[11px] tracking-[6px] uppercase text-white font-light opacity-60">
          Universe Map
        </div>
        {dataDate && (
          <div className="text-[10px] text-[rgba(255,255,255,0.35)] mt-2 tracking-[1px]">
            Data: {dataDate}
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
              className="text-[10px] tracking-[2px] uppercase py-1.5 px-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.6)] hover:text-white transition-colors cursor-pointer text-center w-full"
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
            <span className="text-[9px] text-[rgba(255,255,255,0.4)] tracking-[2px] uppercase">Real Scale</span>
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

        {/* Info button */}
        <button
          onClick={() => setInfoOpen(true)}
          className="text-[10px] tracking-[2px] uppercase py-1.5 px-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.6)] hover:text-white transition-colors cursor-pointer text-center w-full"
        >
          Info
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
        {dataDate && (
          <div className="text-[7px] text-[rgba(255,255,255,0.3)] mt-1 tracking-[1px]">
            {dataDate}
          </div>
        )}
      </div>

      {/* Mobile: Top-right - Controls */}
      <div className="sm:hidden absolute top-3 right-3 flex gap-1.5 pointer-events-auto">
        {(["top", "front", "home"] as const).map((view) => (
          <button
            key={view}
            onClick={() => cameraNav?.setViewSnap(view)}
            className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-[rgba(255,255,255,0.6)] text-[8px] uppercase tracking-[1px] cursor-pointer active:bg-[rgba(255,255,255,0.15)]"
          >
            {view === "top" ? "T" : view === "front" ? "F" : "H"}
          </button>
        ))}
        <button
          onClick={() => setInfoOpen(true)}
          className="w-8 h-8 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-[rgba(255,255,255,0.6)] text-[9px] cursor-pointer active:bg-[rgba(255,255,255,0.15)]"
        >
          i
        </button>
      </div>

      {/* Mobile: Bottom bar - Toggles + Explore */}
      <div className="sm:hidden absolute bottom-16 left-0 right-0 px-3 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-[rgba(255,255,255,0.4)] tracking-[1px] uppercase">Real Scale</span>
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
    </>
  );
}
