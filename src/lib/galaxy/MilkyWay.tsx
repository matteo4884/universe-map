import { useMemo, useRef, useContext, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateGalaxy, SUN_GALAXY_POSITION } from "./generateGalaxy";
import { Html } from "@react-three/drei";
import { CameraNavigationContext } from "../../context/cameraNavigation";

const vertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uDpr;

  void main() {
    vColor = aColor * 0.7;
    float twinkle = 0.8 + 0.2 * sin(uTime * 0.5 + aPhase);
    vAlpha = twinkle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (40.0 / -mvPosition.z) * uDpr;
    gl_PointSize = clamp(gl_PointSize, 0.3 * uDpr, 2.0 * uDpr);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.1, 0.5, d);
    gl_FragColor = vec4(vColor, alpha * vAlpha * 0.14);
  }
`;

export default function MilkyWay() {
  const cameraNav = useContext(CameraNavigationContext);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const galaxy = useMemo(() => generateGalaxy(), []);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDpr: { value: window.devicePixelRatio || 1 } }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  const { camera } = useThree();
  const [labelVisible, setLabelVisible] = useState(true);
  const handleSunClick = () => cameraNav?.setViewSnap("home");

  // Hide label when camera is close to the solar system (inside it)
  useFrame(() => {
    const dist = camera.position.length();
    const shouldShow = dist > 10000000;
    if (shouldShow !== labelVisible) setLabelVisible(shouldShow);
  });

  // Galaxy scaled so stars are a distant backdrop from inside the solar system
  const S = 250000000;
  // Offset galaxy so the Sun's galactic position lands at world origin (where the solar system is)
  const offset: [number, number, number] = [
    -SUN_GALAXY_POSITION[0] * S,
    -SUN_GALAXY_POSITION[1] * S,
    -SUN_GALAXY_POSITION[2] * S,
  ];

  return (
    <group position={offset} scale={[S, S, S]}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[galaxy.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[galaxy.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[galaxy.sizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[galaxy.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </points>

      {/* Solar System label — hidden when camera is close */}
      {labelVisible && (
        <Html position={SUN_GALAXY_POSITION} center>
          <div
            className="px-2 py-1 rounded-md font-bold bg-[#ffffff1e] hover:bg-[#919191] uppercase pointer-events-auto text-white text-[11px] cursor-pointer noselect"
            onClick={handleSunClick}
          >
            Solar System
          </div>
        </Html>
      )}
    </group>
  );
}
