import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { loadingStore } from "../helper/loadingStore";
import { useLoadingSteps } from "../hooks/useLoadingSteps";

/**
 * Inside the Canvas, tells the loading screen how far the scene is. Its first
 * effect runs only once the whole tree has mounted, so every texture preview
 * the bodies wait for has arrived. Then, once the Milky Way is built, it
 * compiles every shader in the scene (off the main thread where supported)
 * and lets two frames reach the screen before the curtain lifts.
 */
export default function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const galaxyBuilt = useLoadingSteps().has("galaxy");

  useEffect(() => loadingStore.markDone("textures"), []);

  useEffect(() => {
    if (!galaxyBuilt) return;
    let cancelled = false;
    let frame = 0;
    gl.compileAsync(scene, camera)
      .catch(() => {
        // Compiled on first use instead
      })
      .then(() => {
        if (cancelled) return;
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => loadingStore.markDone("scene"));
        });
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [galaxyBuilt, gl, scene, camera]);

  return null;
}
