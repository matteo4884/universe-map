import { useContext, useEffect, useRef, useState } from "react";
import { CelestialBody } from "../../data";
import { SelectionContext } from "../../context/contexts";
import { breadcrumb, SUN } from "../../helper/bodies";
import CelestialDetail from "./CelestialDetail";
import Breadcrumb from "./Breadcrumb";
import ExploreTab from "./ExploreTab";

/** Desktop side panel showing the selected body (the Sun when nothing is selected) */
export default function CelestialCard() {
  const { selected, select, panelOpen, setPanelOpen } = useContext(SelectionContext);
  const target = selected ?? SUN;

  // Slide out the old body, then slide the new one in from the side of travel
  const [shown, setShown] = useState<CelestialBody>(target);
  const [phase, setPhase] = useState<"idle" | "out">("idle");
  const [direction, setDirection] = useState<"deeper" | "up">("deeper");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target.id === shown.id) return;
    setDirection(breadcrumb(target).length >= breadcrumb(shown).length ? "deeper" : "up");
    setPhase("out");
    const timer = setTimeout(() => {
      setShown(target);
      setPhase("idle");
      scrollRef.current?.scrollTo({ top: 0 });
    }, 250);
    return () => clearTimeout(timer);
  }, [target, shown]);

  const slideClass =
    phase === "out"
      ? direction === "deeper"
        ? "-translate-x-full opacity-0"
        : "translate-x-full opacity-0"
      : "translate-x-0 opacity-100";

  return (
    <div
      className={`fixed z-[999999999] sm:block hidden duration-500 top-0 right-0 h-screen ${
        panelOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <aside
        ref={scrollRef}
        aria-label={`${shown.name} details`}
        className="h-full w-[380px] bg-black/70 bg-blur-custom p-6 pb-28 overflow-y-auto custom-scrollbar text-white"
        inert={!panelOpen}
      >
        <Breadcrumb crumbs={breadcrumb(shown)} onNavigate={(body) => select(body)} />
        <div className="overflow-hidden">
          <div className={`transition-all duration-200 ease-in-out ${slideClass}`}>
            <CelestialDetail body={shown} />
          </div>
        </div>
      </aside>

      {/* Toggle tab */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full">
        {panelOpen ? (
          <button
            type="button"
            aria-label="Close explore panel"
            title="Close  Esc"
            className="bg-black/70 bg-blur-custom text-white text-[12px] py-3 px-2.5 rounded-l-lg hover:bg-white/15 transition-colors border border-r-0 border-white/10 cursor-pointer"
            onClick={() => setPanelOpen(false)}
          >
            ✕
          </button>
        ) : (
          <ExploreTab onClick={() => setPanelOpen(true)} />
        )}
      </div>
    </div>
  );
}
