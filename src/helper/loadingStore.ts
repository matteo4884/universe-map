/**
 * What the app waits for before showing the scene, in order: the orbits, the
 * planets' textures, the Milky Way (its dust map and shaders), then the whole
 * scene's shaders and its first frames. Each part marks its step done; the
 * loading screen follows along (hooks/useLoadingSteps.ts).
 */
export type LoadStep = "data" | "textures" | "galaxy" | "scene";

export const LOAD_STEPS: { step: LoadStep; label: string }[] = [
  { step: "data", label: "Loading orbits" },
  { step: "textures", label: "Loading planets" },
  { step: "galaxy", label: "Building the Milky Way" },
  { step: "scene", label: "Preparing the view" },
];

let done: ReadonlySet<LoadStep> = new Set();
const listeners = new Set<() => void>();

export const loadingStore = {
  done: (): ReadonlySet<LoadStep> => done,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  markDone(step: LoadStep) {
    if (done.has(step)) return;
    done = new Set([...done, step]);
    listeners.forEach((listener) => listener());
  },
};
