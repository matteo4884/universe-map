import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneClock } from "../../hooks/useSceneClock";
import { KM_PER_UNIT, blendPosition } from "../../helper/units";
import { DAY_MS } from "../../helper/kepler";
import { getBodyBySlug } from "../../helper/bodies";
import { regionRadiiKm } from "../../helper/bodyPosition";
import { seededRandom, gaussian } from "../../helper/random";

const COUNT = 9000;
const AU_KM = 149597870.7;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const COLOR = new THREE.Color(0.62, 0.56, 0.47);
// Each point stands for a patch of the belt this big, relative to its distance
// from the Sun. Smaller on screen than MIN_PX it's dimmed instead of shrunk,
// so from afar the belt is a soft glow, never a crowd of dots
const PATCH = 0.005;
const MIN_PX = 2;
const MAX_PX = 2.5;
const BRIGHTNESS = 0.55;
// Seen from among the inner planets (camera closer to the Sun than the belt),
// the belt is all around: it fades to this much, so it doesn't clutter the sky
const INSIDE_BRIGHTNESS = 0.15;

// Each asteroid circles the Sun at its own Keplerian rate: positions are
// computed on the GPU from the simulated time and the same log/realistic
// blend as the planets (d^0.3 vs d / KM_PER_UNIT)
const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aRate;
  attribute float aBright;
  uniform float uDays;
  uniform float uBlend;
  uniform float uKmPerUnit;
  uniform float uFocalPx;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uBrightness;
  varying float vAlpha;

  void main() {
    float angle = aAngle + aRate * uDays;
    vec3 km = vec3(aRadius * cos(angle), aRadius * sin(angle), aHeight);
    float d = length(km);
    vec3 logPos = km / d * pow(d, 0.3);
    vec3 realPos = km / uKmPerUnit;
    vec3 pos = mix(logPos, realPos, uBlend);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float px = length(pos) * ${PATCH} * uFocalPx / max(-mvPosition.z, 1e-6);
    gl_PointSize = clamp(px, uMinPx, uMaxPx);
    vAlpha = uBrightness * aBright * min(1.0, (px * px) / (uMinPx * uMinPx));
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - vec2(0.5);
    float a = vAlpha * exp(-dot(c, c) * 14.0);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

const BELT = getBodyBySlug("asteroid-belt")!;
const { innerAU, outerAU } = BELT.region!;

/** Distance from the Sun (AU): most asteroids between 2.2 and 3.2 AU, thinning at the edges */
function beltRadius(random: () => number): number {
  for (;;) {
    const a = innerAU - 0.1 + random() * (outerAU - innerAU + 0.3);
    const x = (a - innerAU + 0.1) / (outerAU - innerAU + 0.3);
    if (random() < Math.pow(Math.sin(Math.PI * x), 0.7)) return a;
  }
}

/** Main asteroid belt, between Mars and Jupiter */
export default function AsteroidBelt() {
  const { blendRef, getTime } = useSceneClock();
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const attributes = useMemo(() => {
    const random = seededRandom(1801); // Ceres was found in 1801
    const radius = new Float32Array(COUNT);
    const angle = new Float32Array(COUNT);
    const height = new Float32Array(COUNT);
    const rate = new Float32Array(COUNT);
    const bright = new Float32Array(COUNT);
    const position = new Float32Array(COUNT * 3); // unused, but required by three
    for (let i = 0; i < COUNT; i++) {
      const a = beltRadius(random);
      // Inclinations: mostly a few degrees, a tail up to ~30°
      const inclination = Math.min(Math.abs(gaussian(random)) * 7 + (random() < 0.15 ? random() * 15 : 0), 30);
      radius[i] = a * AU_KM;
      angle[i] = random() * Math.PI * 2;
      height[i] = Math.sin((inclination * Math.PI) / 180) * Math.sin(random() * Math.PI * 2) * a * AU_KM;
      rate[i] = ((0.9856076686 / Math.pow(a, 1.5)) * Math.PI) / 180; // rad/day
      // Few big ones, many small: most points faint
      bright[i] = 0.12 + 0.88 * Math.pow(random(), 3);
    }
    return { radius, angle, height, rate, bright, position };
  }, []);

  const uniforms = useMemo(
    () => ({
      uDays: { value: 0 },
      uBlend: { value: 0 },
      uKmPerUnit: { value: KM_PER_UNIT },
      uFocalPx: { value: 1 },
      uMinPx: { value: MIN_PX },
      uMaxPx: { value: MAX_PX },
      uBrightness: { value: BRIGHTNESS },
      uColor: { value: COLOR },
    }),
    []
  );

  useFrame(({ camera, size, viewport }) => {
    const material = materialRef.current;
    if (!material) return;
    const blend = blendRef.current;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const u = material.uniforms;
    u.uDays.value = (getTime() - J2000_MS) / DAY_MS;
    u.uBlend.value = blend;
    u.uFocalPx.value = (size.height * viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
    u.uMinPx.value = MIN_PX * viewport.dpr;
    u.uMaxPx.value = MAX_PX * viewport.dpr;
    const beltScene = Math.abs(blendPosition(regionRadiiKm(BELT).mid, 0, 0, blend)[0]);
    const outside = THREE.MathUtils.smoothstep(camera.position.length() / beltScene, 0.75, 1.5);
    u.uBrightness.value = BRIGHTNESS * THREE.MathUtils.lerp(INSIDE_BRIGHTNESS, 1, outside);
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[attributes.radius, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[attributes.angle, 1]} />
        <bufferAttribute attach="attributes-aHeight" args={[attributes.height, 1]} />
        <bufferAttribute attach="attributes-aRate" args={[attributes.rate, 1]} />
        <bufferAttribute attach="attributes-aBright" args={[attributes.bright, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
