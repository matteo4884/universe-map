import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

export default function StarPoints() {
  const circleTexture = useLoader(THREE.TextureLoader, "/circle.png");
  const count = 9000;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 5000000000;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5000000000;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5000000000;
    }
    return arr;
  }, [count]);

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1}
        sizeAttenuation
        color="white"
        transparent
        opacity={0.2}
        depthWrite={false}
        map={circleTexture}
        alphaMap={circleTexture}
      />
    </points>
  );
}
