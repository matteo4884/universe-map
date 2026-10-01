import { useEffect, useMemo, useState } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateSkyStars } from "./generateSky";
import {
  galaxyStarVertexShader,
  skyStarVertexShader,
  pointFragmentShader,
  splatFragmentShader,
  nebulaVertexShader,
  nebulaFragmentShader,
  screenVertexShader,
  blurFragmentShader,
  stretchFragmentShader,
  bakeVertexShader,
  dustBakeFragmentShader,
} from "./galaxyShaders";
import { ARMS, BAR, KPC, GALAXY_MATRIX, GALAXY_MATRIX_INVERSE, GALAXY_SCALE } from "../../helper/galaxy";
import { isSoftwareRenderer } from "../../helper/webgl";

// How many groups of stars make the galaxy: fewer on phones, far fewer without a GPU
const STARS_DESKTOP = 2000000;
const STARS_MOBILE = 600000;
const STARS_SOFTWARE = 150000;
// A group's absolute magnitude with the desktop count. The galaxy's light is
// shared among the groups: with fewer, each one is brighter
const PARTICLE_MAG = -7.8;
// Groups nearer the camera than this (kpc) show as points, beyond the second
// as glow, gradually in between: far away, their stars can't be told apart
const RESOLVED_KPC = new THREE.Vector2(12, 24);
const NEBULAE = 6000;
const NEBULA_BRIGHTNESS = 1.5e-3;
const NEBULA_MIN_PX = 1.5;
const NEBULA_MAX_PX = 48;
// Stars as points: fainter than this aren't drawn (fading over the last 1.5
// magnitudes, like the limit of a long exposure)
const STAR_MAG_LIMIT = 12;
const STAR_GAIN = 1.25;
// The galaxy's glow: blurred like any unresolved light (Gaussian, CSS px, out
// to this many sigmas), then stretched, in light per CSS pixel (a magnitude-1
// star = 1): linear below the softening, logarithmic above, white past white
const GLOW_BLUR = 1;
const GLOW_BLUR_REACH = 4;
const GLOW_SOFTENING = 3e-4;
const GLOW_WHITE = 0.03;
// Dust: optical depth per kpc through unit density (~1 magnitude per kpc in
// the plane near the Sun)
const DUST_OPACITY = 7;
// The dust map: 1024 px across 35 kpc (34 pc per pixel)
const DUST_RADIUS_KPC = 17.5;
const DUST_MAP_SIZE = 1024;
const DUST_STRIPS = 4;

const armUniforms = () => ({
  uArmA: { value: ARMS.map((a) => new THREE.Vector4(a.r, a.angle, a.tanPitch, a.span)) },
  uArmB: { value: ARMS.map((a, i) => new THREE.Vector4(a.width, a.strength, a.major ? 1 : 0, i * 37.7)) },
  uBar: { value: new THREE.Vector3(BAR.halfLength, BAR.halfWidth, BAR.angle) },
});

/**
 * Renders the dust's surface density from the model once, into a texture the
 * stars read to know how much dust lies in front of them. Compiled off the
 * main thread where supported, then drawn a strip per frame.
 */
function useDustMap(): THREE.Texture | null {
  const gl = useThree((s) => s.gl);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const target = new THREE.WebGLRenderTarget(DUST_MAP_SIZE, DUST_MAP_SIZE, {
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const material = new THREE.ShaderMaterial({
      vertexShader: bakeVertexShader,
      fragmentShader: dustBakeFragmentShader,
      uniforms: { ...armUniforms(), uStrip: { value: new THREE.Vector2(0, 1) }, uRadius: { value: DUST_RADIUS_KPC } },
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
      material.uniforms.uStrip.value.set(strip / DUST_STRIPS, (strip + 1) / DUST_STRIPS);
      const previous = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      gl.autoClear = strip === 0;
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(previous);
      gl.autoClear = autoClear;
      strip++;
      if (strip < DUST_STRIPS) frame = requestAnimationFrame(drawStrip);
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

/** How many groups of stars this device can draw every frame */
function useStarCount(): number {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    if (isSoftwareRenderer(gl.getContext())) return STARS_SOFTWARE;
    return window.matchMedia("(pointer: coarse)").matches ? STARS_MOBILE : STARS_DESKTOP;
  }, [gl]);
}

/** Points with no buffers: the shader makes each one from its index */
function useProceduralPoints(count: number): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setDrawRange(0, count);
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const clearColor = new THREE.Color();
const bufferSize = new THREE.Vector2();

const lightBuffer = () =>
  new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

/** A full-screen pass: the blur of the galaxy's light, one direction at a time */
function useBlurPass() {
  return useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: screenVertexShader,
      fragmentShader: blurFragmentShader,
      uniforms: {
        uSource: { value: null as THREE.Texture | null },
        uStep: { value: new THREE.Vector2() },
        uSigma: { value: 1 },
        uRadius: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    return { scene, material, geometry: quad.geometry, camera: new THREE.Camera() };
  }, []);
}

/**
 * The Milky Way (model in helper/galaxy.ts), placed so the Sun sits at the
 * origin and tilted like the real galaxy relative to the ecliptic. Made of
 * stars and dust only, the same rules from every viewpoint (galaxyShaders.ts):
 * millions of points generated on the GPU, the 120,000 stars around the Sun
 * (generateSky), star-forming nebulae, all dimmed by the dust in front.
 * Stars near the camera are drawn as points. Farther, too close together to
 * tell, they're light summed in a buffer of its own, blurred and stretched
 * onto the screen under everything else: the galaxy is always far behind the
 * planets.
 */
export default function MilkyWay() {
  const count = useStarCount();
  const starGeometry = useProceduralPoints(count);
  const nebulaGeometry = useProceduralPoints(NEBULAE);
  const skyStars = useMemo(generateSkyStars, []);
  const dust = useDustMap();
  const [galaxyScene] = useState(() => new THREE.Scene());
  const light = useMemo(lightBuffer, []);
  const blurred = useMemo(lightBuffer, []);
  const blur = useBlurPass();
  useEffect(
    () => () => {
      light.dispose();
      blurred.dispose();
      blur.material.dispose();
      blur.geometry.dispose();
    },
    [light, blurred, blur]
  );

  // The model → scene transform, as position / rotation / scale
  const transform = useMemo(() => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    GALAXY_MATRIX.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }, []);

  // Shared by every material: the model, the dust, the photometry, the camera
  const uniforms = useMemo(
    () => ({
      ...armUniforms(),
      uDust: { value: null as THREE.Texture | null },
      uDustRadius: { value: DUST_RADIUS_KPC },
      uDustOpacity: { value: DUST_OPACITY },
      uCameraKpc: { value: new THREE.Vector3() },
      uScenePerParsec: { value: (KPC / 1000) * GALAXY_SCALE },
      uMagLimit: { value: STAR_MAG_LIMIT },
      uGain: { value: STAR_GAIN },
      uDpr: { value: 1 },
      uResolved: { value: RESOLVED_KPC },
    }),
    []
  );
  const starUniforms = useMemo(
    () => ({
      ...uniforms,
      uCount: { value: count },
      uParticleMag: { value: PARTICLE_MAG + 2.5 * Math.log10(count / STARS_DESKTOP) },
      // As points, brightness is compressed (flux^0.42): to keep the band's
      // light with fewer groups, each must gain more than its share
      uPointFlux: { value: Math.pow(STARS_DESKTOP / count, 0.58 / 0.42) },
    }),
    [uniforms, count]
  );
  const nebulaUniforms = useMemo(
    () => ({
      ...uniforms,
      uScenePerKpc: { value: KPC * GALAXY_SCALE },
      uFocalPx: { value: 1 },
      uMinPx: { value: NEBULA_MIN_PX },
      uMaxPx: { value: NEBULA_MAX_PX },
      uBrightness: { value: NEBULA_BRIGHTNESS },
    }),
    [uniforms]
  );

  const stretchUniforms = useMemo(
    () => ({
      uLight: { value: light.texture },
      uPerCssPixel: { value: 1 },
      uSoftening: { value: GLOW_SOFTENING },
      uScale: { value: 1 / Math.asinh(GLOW_WHITE / GLOW_SOFTENING) },
    }),
    [light]
  );

  // The galaxy's light, once the camera has moved this frame (priority between
  // the camera's updates and the composer's render): summed, then blurred
  useFrame(({ gl, camera, size, viewport }) => {
    if (!dust) return;
    const dpr = viewport.dpr;
    uniforms.uDust.value = dust;
    uniforms.uCameraKpc.value.copy(camera.position).applyMatrix4(GALAXY_MATRIX_INVERSE).divideScalar(KPC);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    nebulaUniforms.uFocalPx.value = (size.height * dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    nebulaUniforms.uMinPx.value = NEBULA_MIN_PX * dpr;
    nebulaUniforms.uMaxPx.value = NEBULA_MAX_PX * dpr;
    // Light per device pixel: a CSS pixel's worth is spread over dpr² of them
    nebulaUniforms.uBrightness.value = NEBULA_BRIGHTNESS / (dpr * dpr);
    stretchUniforms.uPerCssPixel.value = dpr * dpr;
    uniforms.uDpr.value = dpr;

    gl.getDrawingBufferSize(bufferSize);
    if (light.width !== bufferSize.x || light.height !== bufferSize.y) {
      light.setSize(bufferSize.x, bufferSize.y);
      blurred.setSize(bufferSize.x, bufferSize.y);
    }
    const previous = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    const clearAlpha = gl.getClearAlpha();
    gl.getClearColor(clearColor);
    gl.autoClear = false;
    gl.setRenderTarget(light);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(galaxyScene, camera);

    const sigma = GLOW_BLUR * dpr;
    const blurUniforms = blur.material.uniforms;
    blurUniforms.uSigma.value = sigma;
    blurUniforms.uRadius.value = Math.ceil(sigma * GLOW_BLUR_REACH);
    for (const [from, to, x, y] of [
      [light, blurred, 1, 0],
      [blurred, light, 0, 1],
    ] as const) {
      blurUniforms.uSource.value = from.texture;
      blurUniforms.uStep.value.set(x / bufferSize.x, y / bufferSize.y);
      gl.setRenderTarget(to);
      gl.render(blur.scene, blur.camera);
    }

    gl.autoClear = autoClear;
    gl.setClearColor(clearColor, clearAlpha);
    gl.setRenderTarget(previous);
  }, 0.5);

  // Until the dust is known the stars would shine through it: wait for it
  if (!dust) return null;

  return (
    <>
      {createPortal(
        <group position={transform.position} quaternion={transform.quaternion} scale={transform.scale}>
          <points geometry={starGeometry} frustumCulled={false} raycast={() => null}>
            <shaderMaterial
              vertexShader={galaxyStarVertexShader}
              fragmentShader={splatFragmentShader}
              uniforms={starUniforms}
              transparent
              depthTest={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
          <points geometry={nebulaGeometry} frustumCulled={false} raycast={() => null}>
            <shaderMaterial
              vertexShader={nebulaVertexShader}
              fragmentShader={nebulaFragmentShader}
              uniforms={nebulaUniforms}
              transparent
              depthTest={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>,
        galaxyScene
      )}
      <mesh frustumCulled={false} renderOrder={-1000} raycast={() => null}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={screenVertexShader}
          fragmentShader={stretchFragmentShader}
          uniforms={stretchUniforms}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group position={transform.position} quaternion={transform.quaternion} scale={transform.scale}>
        <points geometry={starGeometry} frustumCulled={false} raycast={() => null}>
          <shaderMaterial
            defines={{ CRISP: "" }}
            vertexShader={galaxyStarVertexShader}
            fragmentShader={pointFragmentShader}
            uniforms={starUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        <points frustumCulled={false} raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[skyStars.positions, 3]} />
            <bufferAttribute attach="attributes-aColor" args={[skyStars.colors, 3]} />
            <bufferAttribute attach="attributes-aAbsMag" args={[skyStars.absMags, 1]} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={skyStarVertexShader}
            fragmentShader={pointFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}
