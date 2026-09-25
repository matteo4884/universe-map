import { useContext, useEffect, useState } from "react";
import { ScaleContext, CameraNavigationContext, EphemerisContext, LayersContext, Layer } from "../../context/contexts";
import { SHORTCUTS } from "../../helper/shortcuts";

interface NormalHUDProps {
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
}

const LAYER_LABELS: [Layer, string][] = [
  ["orbits", "Orbits"],
  ["spacecraft", "Spacecraft"],
  ["belt", "Asteroid belt"],
  ["labels", "Labels"],
];

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="flex items-center gap-2 cursor-pointer group min-h-9"
      onClick={onToggle}
    >
      <span className="text-[11px] text-white/70 group-hover:text-white tracking-[2px] uppercase transition-colors">{label}</span>
      <span className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-[#4a90d9]" : "bg-white/20"}`}>
        <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

const IMAGE_CREDITS: [string, string][] = [
  ["Sun, planets, Moon, Saturn's rings", "Solar System Scope (CC BY 4.0)"],
  ["Mimas, Enceladus, Rhea", "NASA/JPL-Caltech/Space Science Institute"],
  ["Iapetus", "NASA/JPL-Caltech/SSI/Lunar and Planetary Institute"],
  ["Phobos, Uranus's moons", "NASA/JPL/USGS (Viking, Voyager 2)"],
  ["Deimos", "P. Stooke, Stooke Small Bodies Maps V3.0, NASA PDS"],
  ["Pluto, Charon", "NASA/JHUAPL/SwRI (New Horizons)"],
  ["Ceres", "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn)"],
];

const presetClass =
  "text-[11px] tracking-[2px] uppercase h-9 sm:h-8 px-3 rounded-md border border-white/20 bg-black/60 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer";

function InfoModal({ onClose }: { onClose: () => void }) {
  const { ephemeris } = useContext(EphemerisContext);
  const updated = ephemeris
    ? new Date(ephemeris.fetchedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="fixed inset-0 z-[99999999999] flex items-center justify-center pointer-events-auto font-mono">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="relative max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/15 rounded-xl"
      >
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#4a90d9] to-transparent" />
        <div className="bg-[#080810] p-7">
          <div className="text-center mb-5">
            <div className="text-[10px] tracking-[6px] text-[#4a90d9] uppercase mb-2">About</div>
            <h2 id="about-title" className="text-xl font-bold tracking-[4px] text-white uppercase">Universe Map</h2>
          </div>

          <p className="text-[13px] text-white/70 leading-relaxed mb-5 text-center">
            An interactive 3D map of the Solar System and the Milky Way. Planets, moons and spacecraft
            are where they really are right now, and you can travel through time to watch them move.
          </p>

          <div className="border-t border-white/10 mb-5" />

          <div className="text-[10px] tracking-[3px] text-white/55 uppercase mb-3">Controls</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px] mb-5">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key} className="contents">
                <dt><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/90">{key}</kbd></dt>
                <dd className="text-white/70">{action}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-white/10 mb-5" />

          <dl className="space-y-2.5 mb-6 text-[12px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[10px] tracking-[2px] text-white/55 uppercase">Built by</dt>
              <dd>
                <a href="https://matteobeu.com" target="_blank" rel="noopener noreferrer" className="text-[#4a90d9] hover:text-white transition-colors">
                  Matteo Beu
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[10px] tracking-[2px] text-white/55 uppercase">Data</dt>
              <dd className="text-white/70 text-right">NASA JPL Horizons{updated ? `, updated ${updated}` : ""}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[10px] tracking-[2px] text-white/55 uppercase">Engine</dt>
              <dd className="text-white/70">Three.js + React Three Fiber</dd>
            </div>
          </dl>

          <div className="text-[10px] tracking-[3px] text-white/55 uppercase mb-2">Imagery</div>
          <ul className="text-[11px] text-white/60 leading-relaxed mb-6 space-y-1">
            {IMAGE_CREDITS.map(([what, who]) => (
              <li key={what}>
                <span className="text-white/80">{what}:</span> {who}
              </li>
            ))}
          </ul>

          <button
            autoFocus
            onClick={onClose}
            className="w-full text-[11px] tracking-[2px] uppercase py-2.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NormalHUD({ infoOpen, setInfoOpen }: NormalHUDProps) {
  const scaleCtx = useContext(ScaleContext);
  const { layers, setLayer } = useContext(LayersContext);
  const cameraNav = useContext(CameraNavigationContext);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the info modal with Escape
  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen, setInfoOpen]);

  if (!scaleCtx) return null;
  const { realisticMode, setRealisticMode } = scaleCtx;

  const presets = (["home", "top", "front"] as const).map((view) => (
    <button key={view} onClick={() => cameraNav?.setViewSnap(view)} className={presetClass}>
      {view === "home" ? "Overview" : view}
    </button>
  ));

  const scaleToggle = <Toggle label="Real scale" on={realisticMode} onToggle={() => setRealisticMode(!realisticMode)} />;

  const filters = (
    <fieldset>
      <legend className="text-[10px] tracking-[3px] text-white/50 uppercase mb-1">Show</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-5">
        {LAYER_LABELS.map(([layer, label]) => (
          <Toggle key={layer} label={label} on={layers[layer]} onToggle={() => setLayer(layer, !layers[layer])} />
        ))}
      </div>
    </fieldset>
  );

  return (
    <>
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

      <div className="fixed z-[999999999] top-4 left-4 font-mono pointer-events-none">
        <h1 className="text-[12px] tracking-[6px] uppercase text-white/80 font-light">Universe Map</h1>

        {/* Desktop */}
        <div className="hidden sm:flex flex-col gap-3 mt-4 pointer-events-auto">
          <div className="flex gap-1.5">{presets}</div>
          <div className="flex items-center gap-5">{scaleToggle}</div>
          <div className="w-fit rounded-lg bg-black/75 bg-blur-custom px-3 py-2 border border-white/10">{filters}</div>
          <button onClick={() => setInfoOpen(true)} className={`${presetClass} w-fit`}>
            Info & controls
          </button>
        </div>

        {/* Mobile: everything behind one menu button */}
        <div className="sm:hidden mt-3 pointer-events-auto">
          <button aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className={presetClass}>
            {menuOpen ? "Close" : "View"}
          </button>
          {menuOpen && (
            <div className="mt-2 p-3 rounded-lg bg-black/80 bg-blur-custom border border-white/10 flex flex-col gap-2 w-[260px]">
              <div className="flex flex-wrap gap-1.5">{presets}</div>
              {scaleToggle}
              {filters}
              <button onClick={() => setInfoOpen(true)} className={`${presetClass} w-full`}>
                Info & controls
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
