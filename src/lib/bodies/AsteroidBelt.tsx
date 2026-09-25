import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneClock } from "../../hooks/useSceneClock";
import { KM_PER_UNIT } from "../../helper/units";
import { DAY_MS } from "../../helper/kepler";
import { getBodyBySlug } from "../../helper/bodies";

const COUNT = 5000;
const AU_KM = 149597870.7;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

// Each asteroid circles the Sun at its own Keplerian rate: positions are
// computed on the GPU from the simulated time and the same log/realistic
// blend as the planets (d^0.3 vs d / KM_PER_UNIT)
const vertexShader = `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aRate;
  attribute float aSize;
  uniform float uDays;
  uniform float uBlend;
  uniform float uKmPerUnit;
  uniform float uDpr;
  varying float vAlpha;

  void main() {
    float angle = aAngle + aRate * uDays;
    vec3 km = vec3(aRadius * cos(angle), aRadius * sin(angle), aHeight);
    float d = length(km);
    vec3 logPos = km / d * pow(d, 0.3);
    vec3 realPos = km / uKmPerUnit;
    vec3 pos = mix(logPos, realPos, uBlend);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uDpr;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = 0.35;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.6, 0.52, 0.42, vAlpha * (1.0 - smoothstep(0.2, 0.5, d)));
  }
`;

const BELT = getBodyBySlug("asteroid-belt")!.region!;

/** Main asteroid belt, between Mars and Jupiter */
export default function AsteroidBelt() {
  const { blendRef, getTime } = useSceneClock();
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const attributes = useMemo(() => {
    const radius = new Float32Array(COUNT);
    const angle = new Float32Array(COUNT);
    const height = new Float32Array(COUNT);
    const rate = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const position = new Float32Array(COUNT * 3); // unused, but required by three
    for (let i = 0; i < COUNT; i++) {
      // Denser in the middle of the belt, with the Kirkwood gap at 2.5 AU thinned out
      let a = BELT.innerAU + Math.pow(Math.random(), 0.9) * (BELT.outerAU - BELT.innerAU);
      if (Math.abs(a - 2.5) < 0.03 && Math.random() < 0.8) a += 0.08;
      radius[i] = a * AU_KM;
      angle[i] = Math.random() * Math.PI * 2;
      height[i] = (Math.random() - 0.5) * 2 * Math.sin((Math.random() * 15 * Math.PI) / 180) * a * AU_KM;
      rate[i] = ((0.9856076686 / Math.pow(a, 1.5)) * Math.PI) / 180; // rad/day
      size[i] = 0.8 + Math.random() * 1.2;
    }
    return { radius, angle, height, rate, size, position };
  }, []);

  const uniforms = useMemo(
    () => ({
      uDays: { value: 0 },
      uBlend: { value: 0 },
      uKmPerUnit: { value: KM_PER_UNIT },
      uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
    }),
    []
  );

  useFrame(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uDays.value = (getTime() - J2000_MS) / DAY_MS;
    materialRef.current.uniforms.uBlend.value = blendRef.current;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[attributes.radius, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[attributes.angle, 1]} />
        <bufferAttribute attach="attributes-aHeight" args={[attributes.height, 1]} />
        <bufferAttribute attach="attributes-aRate" args={[attributes.rate, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[attributes.size, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
