import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { LOAD_STEPS } from "../helper/loadingStore";
import { useLoadingSteps } from "../hooks/useLoadingSteps";

// Whatever hangs, the scene shows after this long
const GIVE_UP_MS = 30000;
const FADE_MS = 700;

/** The Sun and three planets on their orbits */
function Orrery() {
  return (
    <svg viewBox="-50 -50 100 100" className="w-24 h-24 mx-auto mb-8 overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id="loading-sun">
          <stop offset="0%" stopColor="#fff4d6" />
          <stop offset="40%" stopColor="#ffb340" />
          <stop offset="100%" stopColor="#ff9500" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[18, 30, 44].map((r) => (
        <circle key={r} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" />
      ))}
      <circle r="10" fill="url(#loading-sun)" />
      <g className="orrery-orbit" style={{ animationDuration: "2.6s" }}>
        <circle cx="18" r="1.6" fill="#b9b4ad" />
      </g>
      <g className="orrery-orbit" style={{ animationDuration: "5.4s", animationDelay: "-2s" }}>
        <circle cx="30" r="2.2" fill="#4a90d9" />
      </g>
      <g className="orrery-orbit" style={{ animationDuration: "12s", animationDelay: "-7s" }}>
        <circle cx="44" r="3" fill="#d9a066" />
      </g>
    </svg>
  );
}

/**
 * Covers the app until the scene is really ready (helper/loadingStore.ts):
 * orbits, textures, the Milky Way, then the compiled scene and its first
 * frames. Shows the step under way and how far along it all is.
 */
export default function LoadingScreen({ error }: { error: boolean }) {
  const steps = useLoadingSteps();
  const { progress: textureProgress } = useProgress();
  const [gaveUp, setGaveUp] = useState(false);
  const [phase, setPhase] = useState<"loading" | "fading" | "gone">("loading");
  const [offline, setOffline] = useState(false);
  const ready = steps.has("scene") || gaveUp;

  useEffect(() => {
    const timer = window.setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setPhase("fading");
    if (error) setOffline(true);
    const hideTimer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    const offlineTimer = window.setTimeout(() => setOffline(false), FADE_MS + 3000);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(offlineTimer);
    };
  }, [ready, error]);

  if (phase === "gone" && !offline) return null;

  const current = LOAD_STEPS.find(({ step }) => !steps.has(step));
  const doneCount = LOAD_STEPS.filter(({ step }) => steps.has(step)).length;
  const partial = current?.step === "textures" ? textureProgress / 100 : 0;
  const percent = ready ? 100 : Math.round(((doneCount + partial) / LOAD_STEPS.length) * 100);
  const fading = phase === "fading";

  return (
    <>
      {phase !== "gone" && (
        <div
          className={`fixed inset-0 z-[9999999999] flex items-center justify-center bg-black transition-opacity ease-out ${
            fading ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{
            transitionDuration: `${FADE_MS}ms`,
            backgroundImage: "radial-gradient(ellipse at center, #0b1022 0%, #000 65%)",
          }}
        >
          <div
            role="status"
            aria-live="polite"
            className={`text-center font-mono text-white transition-transform ease-out ${fading ? "scale-105" : ""}`}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <Orrery />
            <div className="text-[13px] tracking-[8px] pl-[8px] uppercase font-light text-white/85">Universe Map</div>
            <div className="mt-6 h-4 text-[11px] tracking-[3px] uppercase text-white/60">
              {current?.label ?? "Ready"}
            </div>
            <div
              role="progressbar"
              aria-label="Loading"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-3 mx-auto w-48 h-[2px] rounded-full bg-white/10 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4a90d9] to-white/80 transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] tracking-[2px] text-white/55 tabular-nums">{percent}%</div>
          </div>
        </div>
      )}
      {offline && phase === "gone" && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999999999] bg-[#000000b3] bg-blur-custom text-white/70 text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider font-mono"
        >
          Using offline data
        </div>
      )}
    </>
  );
}
