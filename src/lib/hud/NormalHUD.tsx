import { useContext, useEffect, useState, type ReactNode } from "react";
import {
  ScaleContext,
  CameraNavigationContext,
  EphemerisContext,
  LayersContext,
  Layer,
  ViewDirection,
} from "../../context/contexts";
import { SHORTCUTS } from "../../helper/shortcuts";

interface NormalHUDProps {
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
  /** Where the camera is: the Solar System or the whole galaxy */
  level: "system" | "galaxy";
}

// What can be shown, by where it is
const SETTINGS: { title: string; items: [Layer, string][] }[] = [
  {
    title: "Solar System",
    items: [
      ["orbits", "Orbits"],
      ["moons", "Moons"],
      ["spacecraft", "Spacecraft"],
      ["belt", "Asteroid belt"],
      ["labels", "Names"],
    ],
  },
  {
    title: "Milky Way",
    items: [
      ["galaxy", "Stars"],
      ["clouds", "Dark clouds"],
      ["nebulae", "Nebulae"],
      ["galaxyNames", "Names"],
    ],
  },
];

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="w-full flex items-center justify-between gap-3 cursor-pointer group min-h-9 sm:min-h-8"
      onClick={onToggle}
    >
      <span className="text-[11px] text-white/70 group-hover:text-white tracking-[2px] uppercase transition-colors">{label}</span>
      <span className={`w-9 h-5 shrink-0 rounded-full transition-colors relative ${on ? "bg-[#4a90d9]" : "bg-white/20"}`}>
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

const buttonClass =
  "cursor-pointer transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60";

/** Small line icons (16 px grid, current color) */
const ICONS: Record<string, ReactNode> = {
  sun: (
    <>
      <circle cx="8" cy="8" r="2.6" fill="currentColor" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </>
  ),
  galaxy: (
    <>
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <path d="M9.4 8.4c1.7.9 1.6 3.6-.5 4.5-2.8 1.2-5.8-1-5.6-4" />
      <path d="M6.6 7.6c-1.7-.9-1.6-3.6.5-4.5 2.8-1.2 5.8 1 5.6 4" />
    </>
  ),
  overview: (
    <>
      <ellipse cx="8" cy="8" rx="6.5" ry="2.8" transform="rotate(-18 8 8)" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </>
  ),
  top: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </>
  ),
  side: (
    <>
      <path d="M1.5 8h13" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7v4.5" />
      <circle cx="8" cy="4.8" r=".8" fill="currentColor" />
    </>
  ),
  chevron: <path d="M4.5 6.5 8 10l3.5-3.5" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
};

function Icon({ name, className = "w-4 h-4" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] tracking-[3px] text-white/55 uppercase mb-1.5">{children}</div>
);

/** Solar System or the whole galaxy: shows where the camera is, flies to the other */
function LevelSwitch({ level, onPick }: { level: NormalHUDProps["level"]; onPick: (level: NormalHUDProps["level"]) => void }) {
  const levels = [
    { id: "system", label: "Solar System", icon: "sun" },
    { id: "galaxy", label: "Milky Way", icon: "galaxy" },
  ] as const;
  return (
    <div role="group" aria-label="Scale" className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
      {levels.map(({ id, label, icon }) => {
        const active = level === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(id)}
            className={`${buttonClass} flex items-center justify-center gap-1.5 h-9 sm:h-8 rounded-md text-[10px] tracking-[1.5px] uppercase ${
              active ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon name={icon} className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const VIEWS = [
  { name: "Overview", icon: "overview", system: "home", galaxy: "milkyway" },
  { name: "Top", icon: "top", system: "top", galaxy: "milkyway-top" },
  { name: "Side", icon: "side", system: "front", galaxy: "milkyway-side" },
] as const satisfies readonly { name: string; icon: string; system: ViewDirection; galaxy: ViewDirection }[];

/** The ways to frame the current level; the one on screen stays lit until the camera moves otherwise */
function ViewButtons({
  level,
  active,
  onView,
}: {
  level: NormalHUDProps["level"];
  active: ViewDirection;
  onView: (view: ViewDirection) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {VIEWS.map((v) => {
        const view = level === "galaxy" ? v.galaxy : v.system;
        const on = active === view;
        return (
          <button
            key={v.name}
            type="button"
            aria-pressed={on}
            onClick={() => onView(view)}
            className={`${buttonClass} flex flex-col items-center justify-center gap-1 h-12 rounded-md border text-[10px] tracking-[1.5px] uppercase ${
              on
                ? "border-[#4a90d9]/70 bg-[#4a90d9]/20 text-white"
                : "border-white/10 bg-white/[0.03] hover:bg-white/10 text-white/75 hover:text-white"
            }`}
          >
            <Icon name={v.icon} />
            {v.name}
          </button>
        );
      })}
    </div>
  );
}

/** Brightness of the stars and the galaxy, as a share of the calibrated look */
function BrightnessSlider() {
  const { brightness, setBrightness } = useContext(LayersContext);
  return (
    <label className="flex items-center justify-between gap-3 min-h-9 sm:min-h-8">
      <span className="text-[11px] text-white/70 tracking-[2px] uppercase">Brightness</span>
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={0.4}
          max={1.6}
          step={0.05}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          aria-label="Star brightness"
          className="w-20 accent-[#4a90d9] cursor-pointer"
        />
        <span className="w-9 text-right text-[10px] text-white/55 tabular-nums">{Math.round(brightness * 100)}%</span>
      </span>
    </label>
  );
}

/** What's drawn and how: a disclosure, closed until needed; the current level's group first */
function Settings({ level }: { level: NormalHUDProps["level"] }) {
  const { layers, setLayer } = useContext(LayersContext);
  const [open, setOpen] = useState(false);
  const groups = level === "galaxy" ? [...SETTINGS].reverse() : SETTINGS;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${buttonClass} w-full flex items-center justify-between min-h-9 sm:min-h-8 text-[10px] tracking-[3px] uppercase text-white/55 hover:text-white`}
      >
        Settings
        <Icon name="chevron" className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-1">
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title}>
              <div className="text-[10px] tracking-[2px] text-[#4a90d9]/90 uppercase mt-1">{group.title}</div>
              {group.items.map(([layer, label]) => (
                <Toggle key={layer} label={label} on={layers[layer]} onToggle={() => setLayer(layer, !layers[layer])} />
              ))}
            </div>
          ))}
          <div role="group" aria-label="Display">
            <div className="text-[10px] tracking-[2px] text-[#4a90d9]/90 uppercase mt-1">Display</div>
            <BrightnessSlider />
          </div>
        </div>
      )}
    </div>
  );
}

export default function NormalHUD({ infoOpen, setInfoOpen, level }: NormalHUDProps) {
  const scaleCtx = useContext(ScaleContext);
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
  const view = (direction: ViewDirection) => cameraNav?.setViewSnap(direction);

  const infoButton = (
    <button
      type="button"
      aria-label="About and shortcuts"
      onClick={() => setInfoOpen(true)}
      className={`${buttonClass} w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10`}
    >
      <Icon name="info" />
    </button>
  );

  const controls = (
    <div className="flex flex-col gap-3">
      <LevelSwitch level={level} onPick={(next) => view(next === "galaxy" ? "milkyway" : "home")} />
      <div>
        <SectionTitle>View</SectionTitle>
        <ViewButtons level={level} active={cameraNav?.activeView ?? null} onView={view} />
      </div>
      {level === "system" && (
        <div className="border-t border-white/10 pt-1">
          <Toggle label="Real scale" on={realisticMode} onToggle={() => setRealisticMode(!realisticMode)} />
        </div>
      )}
      <div className="border-t border-white/10 pt-1">
        <Settings level={level} />
      </div>
    </div>
  );

  return (
    <>
      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

      <nav aria-label="Map controls" className="fixed z-[999999999] top-4 left-4 font-mono pointer-events-none">
        {/* Desktop: one compact panel */}
        <div className="hidden sm:block pointer-events-auto w-[256px] max-h-[calc(100dvh-7rem)] overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-black/60 bg-blur-custom">
          <div className="flex items-center justify-between pl-3.5 pr-1.5 pt-1.5">
            <h1 className="text-[12px] tracking-[6px] uppercase text-white/85 font-light">Universe Map</h1>
            {infoButton}
          </div>
          <div className="px-3 pb-3 pt-2">{controls}</div>
        </div>

        {/* Mobile: the title, the same panel behind a menu button */}
        <div className="sm:hidden pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(!menuOpen)}
              className={`${buttonClass} w-9 h-9 flex items-center justify-center rounded-md border border-white/15 bg-black/60 bg-blur-custom text-white/80`}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
            <h1 className="text-[12px] tracking-[6px] uppercase text-white/85 font-light">Universe Map</h1>
          </div>
          {menuOpen && (
            <div className="mt-2 w-[min(86vw,280px)] max-h-[calc(100dvh-10rem)] overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-black/80 bg-blur-custom p-3">
              {controls}
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className={`${buttonClass} w-full mt-3 pt-2 min-h-9 border-t border-white/10 flex items-center justify-between text-[10px] tracking-[3px] uppercase text-white/55 hover:text-white`}
              >
                About & shortcuts
                <Icon name="info" />
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
