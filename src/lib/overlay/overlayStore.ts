/**
 * Bridges the DOM overlay (labels, markers, selection ring, scale bar) and the
 * projector running inside the Canvas. Updated every frame without React.
 */
export const overlayStore = {
  labels: new Map<number, HTMLElement>(),
  markers: new Map<number, HTMLElement>(),
  ring: null as HTMLElement | null,
  scaleBar: null as HTMLElement | null,
  scaleBarText: null as HTMLElement | null,
};

type Listener = () => void;
let hovered: number | null = null;
const hoverListeners = new Set<Listener>();

/** Body under the pointer (3D mesh, label or marker) */
export const hoverStore = {
  get: () => hovered,
  set(id: number | null) {
    if (id === hovered) return;
    hovered = id;
    document.body.style.cursor = id != null ? "pointer" : "";
    hoverListeners.forEach((l) => l());
  },
  subscribe(listener: Listener) {
    hoverListeners.add(listener);
    return () => {
      hoverListeners.delete(listener);
    };
  },
};
