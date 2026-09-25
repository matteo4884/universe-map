import { useContext } from "react";
import { CelestialBody } from "../../data";
import { SelectionContext } from "../../context/contexts";
import { SCENE_BODIES } from "../../helper/bodies";
import { overlayStore, hoverStore } from "./overlayStore";

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
          style={{ visibility: "hidden", textShadow: "0 0 4px #000, 0 0 8px #000" }}
          {...handlers(body)}
        >
          {body.name}
        </button>
      ))}

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
