import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

interface MoonProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
}

export default function Moon({ position, size }: MoonProps) {
  const moonMap = useLoader(THREE.TextureLoader, "/2k_moon.jpg");
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 64, 64]} />
      <meshStandardMaterial map={moonMap} />
    </mesh>
  );
}
