import { useContext } from "react";
import { CelestialBody } from "../../data";
import { SelectionContext, CameraNavigationContext } from "../../context/contexts";
import { SCENE_BODIES } from "../../helper/bodies";
import { GALAXY_LANDMARKS } from "../../helper/galaxy";
import { overlayStore, hoverStore } from "./overlayStore";

const TEXT_SHADOW = "0 0 4px #000, 0 0 8px #000";

function register(map: Map<number, HTMLElement>, id: number) {
  return (el: HTMLElement | null) => {
    if (el) map.set(id, el);
    else map.delete(id);
  };
}

function labelTone(body: CelestialBody): string {
  if (body.type === "spacecraft") return "text-[#9ff5dc]/80";
  if (body.type === "region") return "text-[#d8c7a8]/70 text-[10px]";
  if (body.type === "moon") return "text-white/60 text-[10px]";
  return "text-white/75";
}

/**
 * DOM layer over the canvas. Everything starts hidden: LabelProjector (inside
 * the Canvas) positions and shows elements every frame.
 */
export default function SceneOverlay() {
  const { select } = useContext(SelectionContext);
  const cameraNav = useContext(CameraNavigationContext);

  const handlers = (body: CelestialBody) => ({
    onClick: () => select(body),
    onDoubleClick: () => select(body, { fly: true }),
    onMouseEnter: () => hoverStore.set(body.id),
    onMouseLeave: () => {
      if (hoverStore.get() === body.id) hoverStore.set(null);
    },
  });

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1] font-mono noselect">
      {/* Selection ring */}
      <div
        ref={(el) => {
          overlayStore.ring = el;
        }}
        className="absolute left-0 top-0 rounded-full border border-[#4a90d9] shadow-[0_0_8px_rgba(74,144,217,0.6)]"
        style={{ visibility: "hidden" }}
      />

      {SCENE_BODIES.map((body) => (
        <button
          key={`marker-${body.id}`}
          ref={register(overlayStore.markers, body.id)}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="group absolute left-0 top-0 -ml-2 -mt-2 w-4 h-4 flex items-center justify-center pointer-events-auto cursor-pointer"
          style={{ visibility: "hidden" }}
          {...handlers(body)}
        >
          <span
            className={`block transition-transform group-hover:scale-150 group-data-[active=true]:scale-150 ${
              body.type === "spacecraft" ? "w-[6px] h-[6px] rotate-45" : "w-[5px] h-[5px] rounded-full"
            }`}
            style={{ background: body.color, boxShadow: `0 0 6px ${body.color}` }}
          />
        </button>
      ))}

      {SCENE_BODIES.map((body) => (
        <button
          key={`label-${body.id}`}
          ref={register(overlayStore.labels, body.id)}
          type="button"
          className={`absolute left-0 top-0 px-1 leading-4 text-[11px] tracking-[2px] uppercase whitespace-nowrap pointer-events-auto cursor-pointer transition-colors hover:text-white focus-visible:text-white data-[active=true]:text-white ${labelTone(body)}`}
          style={{ visibility: "hidden", textShadow: TEXT_SHADOW }}
          {...handlers(body)}
        >
          {body.name}
        </button>
      ))}

      {/* Galaxy view: the center and the arms */}
      {GALAXY_LANDMARKS.map((l) => (
        <div
          key={`galaxy-${l.key}`}
          ref={(el) => {
            if (el) overlayStore.galaxyLabels.set(l.key, el);
            else overlayStore.galaxyLabels.delete(l.key);
          }}
          className={`absolute left-0 top-0 text-[10px] leading-4 tracking-[3px] uppercase whitespace-nowrap text-white/55 ${
            l.point ? "flex items-center gap-2 -ml-[3px] -mt-[3px]" : "-translate-x-1/2 -translate-y-1/2 text-center"
          }`}
          style={{ visibility: "hidden", textShadow: TEXT_SHADOW }}
        >
          {l.point && <span className="self-start w-[6px] h-[6px] rounded-full border border-white/70" />}
          <span className="block">
            {l.text}
            {l.sub && <span className="block tracking-[1px] normal-case text-white/45">{l.sub}</span>}
          </span>
        </div>
      ))}

      {/* Galaxy view: where the Solar System is */}
      <button
        ref={(el) => {
          overlayStore.sunMarker = el;
        }}
        type="button"
        aria-label="Solar System, you are here: fly back"
        onClick={() => cameraNav?.setViewSnap("home")}
        className="group absolute left-0 top-0 flex items-start gap-2 -ml-[9px] -mt-[9px] pointer-events-auto cursor-pointer"
        style={{ visibility: "hidden", textShadow: TEXT_SHADOW }}
      >
        <span className="relative w-[18px] h-[18px] rounded-full border border-[#ffd27a]/80 flex items-center justify-center transition-transform group-hover:scale-125">
          <span className="absolute inset-0 rounded-full border border-[#ffd27a]/50 motion-safe:animate-ping" />
          <span className="w-[4px] h-[4px] rounded-full bg-[#ffd27a] shadow-[0_0_6px_#ffd27a]" />
        </span>
        {/* Two lines centered on the ring */}
        <span className="flex flex-col items-start leading-4 -mt-[7px]">
          <span className="text-[11px] tracking-[2px] uppercase text-white/80 group-hover:text-white transition-colors">Solar System</span>
          <span className="text-[10px] tracking-[2px] uppercase text-[#ffd27a]/80">You are here</span>
        </span>
      </button>

      {/* Scale bar (realistic scale) */}
      <div
        ref={(el) => {
          overlayStore.scaleBar = el;
        }}
        className="absolute left-4 bottom-28 sm:bottom-6 text-white/70 text-[11px] tracking-[1px]"
        style={{ visibility: "hidden" }}
      >
        <div className="h-[6px] border-x border-b border-white/60" />
        <div
          ref={(el) => {
            overlayStore.scaleBarText = el;
          }}
          className="mt-1"
        />
      </div>
    </div>
  );
}
