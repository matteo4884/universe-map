import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateGalaxy } from "./generateGalaxy";
import { generateSkyStars } from "./generateSky";
import {
  starVertexShader,
  starFragmentShader,
  bakeVertexShader,
  diskBakeFragmentShader,
  diskVertexShader,
  diskFragmentShader,
} from "./galaxyShaders";
import { ARMS, BAR, KPC, GALAXY_MATRIX, GALAXY_MATRIX_INVERSE, GALAXY_SCALE } from "../../helper/galaxy";
import { isSoftwareRenderer } from "../../helper/webgl";

// Stars fainter than this aren't drawn (fading over the last 1.5 magnitudes,
// like the limit of a long exposure)
const STAR_MAG_LIMIT = 12;
const STAR_GAIN = 1.25;
// The disk's glow is the disk seen from outside: it fades in as the camera
// climbs out of the disk (kpc above the plane)
const GLOW_HEIGHT_FROM = 0.01;
const GLOW_HEIGHT_TO = 0.4;
const DISK_RADIUS = 17.5 * KPC;
// The face-on disk's glow: 2048 px across 35 kpc, finer than the model's details
const GLOW_TEXTURE_SIZE = 2048;
// Drawn a strip per frame, so slow GPUs never stall long
const GLOW_STRIPS = 4;
// Without a GPU (WebGL on the CPU) it would take a minute: a quarter of the resolution
const SOFTWARE_SCALE = 0.25;

const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Renders the disk's glow from the model once, into a texture (the shader is
 * heavy: noise along every arm). Compiled off the main thread where supported,
 * then drawn a strip per frame.
 */
function useGlowTexture(): THREE.Texture | null {
  const gl = useThree((s) => s.gl);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const size = GLOW_TEXTURE_SIZE * (isSoftwareRenderer(gl.getContext()) ? SOFTWARE_SCALE : 1);
    const target = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    target.texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    const material = new THREE.ShaderMaterial({
      vertexShader: bakeVertexShader,
      fragmentShader: diskBakeFragmentShader,
      uniforms: {
        uStrip: { value: new THREE.Vector2(0, 1) },
        uRadius: { value: DISK_RADIUS },
        uArmA: { value: ARMS.map((a) => new THREE.Vector4(a.r, a.angle, a.tanPitch, a.span)) },
        uArmB: { value: ARMS.map((a, i) => new THREE.Vector4(a.width, a.strength, a.major ? 1 : 0, i * 37.7)) },
        uBar: { value: new THREE.Vector3(BAR.halfLength, BAR.halfWidth, BAR.angle) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    let cancelled = false;
    let frame = 0;
    let strip = 0;
    const drawStrip = () => {
      if (cancelled) return;
      material.uniforms.uStrip.value.set(strip / GLOW_STRIPS, (strip + 1) / GLOW_STRIPS);
      const previous = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      gl.autoClear = strip === 0;
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(previous);
      gl.autoClear = autoClear;
      strip++;
      if (strip < GLOW_STRIPS) frame = requestAnimationFrame(drawStrip);
      else setTexture(target.texture);
    };
    gl.compileAsync(scene, camera).then(drawStrip);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      quad.geometry.dispose();
      material.dispose();
      target.dispose();
    };
  }, [gl]);

  return texture;
}

type StarUniforms = Record<"uScenePerParsec" | "uMagLimit" | "uGain" | "uDpr", { value: number }>;

function Stars({
  data,
  uniforms,
}: {
  data: { positions: Float32Array; colors: Float32Array; absMags: Float32Array };
  uniforms: StarUniforms;
}) {
  return (
    <points frustumCulled={false} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aAbsMag" args={[data.absMags, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * The Milky Way (model in helper/galaxy.ts), placed so the Sun sits at the
 * origin and tilted like the real galaxy relative to the ecliptic.
 * - Stars: the 24,000 stars around the Sun (generateSky) and the galaxy's
 *   clusters (generateGalaxy), all drawn with the same photometry, from their
 *   absolute magnitude and their distance to the camera. From the planets
 *   they're our night sky and the Milky Way's band; from afar, the galaxy.
 * - The disk's glow, rendered from the model, seen from above the disk.
 */
export default function MilkyWay() {
  const galaxy = useMemo(generateGalaxy, []);
  const skyStars = useMemo(generateSkyStars, []);
  const glow = useGlowTexture();
  const diskRef = useRef<THREE.Mesh>(null);

  // The model → scene transform, as position / rotation / scale
  const transform = useMemo(() => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    GALAXY_MATRIX.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }, []);

  const starUniforms = useMemo<StarUniforms>(
    () => ({
      uScenePerParsec: { value: (KPC / 1000) * GALAXY_SCALE },
      uMagLimit: { value: STAR_MAG_LIMIT },
      uGain: { value: STAR_GAIN },
      uDpr: { value: 1 },
    }),
    []
  );

  const diskUniforms = useMemo(
    () => ({
      uGlow: { value: null as THREE.Texture | null },
      uRadius: { value: DISK_RADIUS },
      uCamera: { value: new THREE.Vector3() },
      uOpacity: { value: 0 },
    }),
    []
  );

  const diskGeometry = useMemo(() => new THREE.CircleGeometry(DISK_RADIUS, 128), []);
  useEffect(() => () => diskGeometry.dispose(), [diskGeometry]);

  useFrame(({ camera, viewport }) => {
    starUniforms.uDpr.value = viewport.dpr;

    diskUniforms.uGlow.value = glow;
    const cam = diskUniforms.uCamera.value.copy(camera.position).applyMatrix4(GALAXY_MATRIX_INVERSE);
    const opacity = smoothstep(GLOW_HEIGHT_FROM, GLOW_HEIGHT_TO, Math.abs(cam.z) / KPC);
    diskUniforms.uOpacity.value = opacity;
    if (diskRef.current) diskRef.current.visible = !!glow && opacity > 0.001;
  });

  return (
    <group position={transform.position} quaternion={transform.quaternion} scale={transform.scale}>
      <mesh ref={diskRef} geometry={diskGeometry} visible={false} frustumCulled={false} raycast={() => null}>
        <shaderMaterial
          vertexShader={diskVertexShader}
          fragmentShader={diskFragmentShader}
          uniforms={diskUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Stars data={galaxy} uniforms={starUniforms} />
      <Stars data={skyStars} uniforms={starUniforms} />
    </group>
  );
}
