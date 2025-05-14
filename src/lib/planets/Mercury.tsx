import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface MercuryProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
}

export default function Mercury({ position, size }: MercuryProps) {
  const colorMap = useLoader(THREE.TextureLoader, "/2k_mercury.jpg");
  return (
    <group>
      {/* Sfera base con day + night map */}
      <mesh
        position={position}
        onPointerEnter={(e) => {
          // Only the mesh closest to the camera will be processed
          e.stopPropagation();
          // You may optionally capture the target
          console.log("hover: ", e.pointerId);
        }}
        onPointerDown={(e) => {
          // Only the mesh closest to the camera will be processed
          e.stopPropagation();
          // You may optionally capture the target
          console.log("click: ", e);
        }}
      >
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial map={colorMap} />
      </mesh>
    </group>
  );
}
