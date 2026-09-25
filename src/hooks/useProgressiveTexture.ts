import { useEffect, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

// Full-resolution textures load in the background through their own manager,
// so the loading screen (which tracks the default one) only waits for the
// small previews
const hiResLoader = new THREE.TextureLoader(new THREE.LoadingManager());
const hiResCache = new Map<string, Promise<THREE.Texture>>();

function loadHiRes(file: string): Promise<THREE.Texture> {
  let promise = hiResCache.get(file);
  if (!promise) {
    promise = hiResLoader.loadAsync(`/${file}`);
    hiResCache.set(file, promise);
  }
  return promise;
}

/**
 * A texture from /public: a 512px preview first (suspends until loaded),
 * swapped for the 2k version once it arrives.
 */
export function useProgressiveTexture(file: string): THREE.Texture {
  const preview = useLoader(THREE.TextureLoader, `/textures/low/${file}`);
  const [full, setFull] = useState<{ file: string; texture: THREE.Texture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHiRes(file)
      .then((texture) => {
        if (cancelled) return;
        texture.colorSpace = preview.colorSpace;
        setFull({ file, texture });
      })
      .catch(() => {
        // Keep the preview
      });
    return () => {
      cancelled = true;
    };
  }, [file, preview]);

  return full?.file === file ? full.texture : preview;
}
