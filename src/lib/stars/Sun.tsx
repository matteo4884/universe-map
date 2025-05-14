import { useRef, useState } from "react";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface SunProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
}

export default function Sun({ position, size }: SunProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [visible, setVisible] = useState(true);

  useFrame(() => {
    if (glowRef.current) {
      glowRef.current.rotation.y += 0.002;
    }
  });

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const intensity = 2 + Math.sin(time * 2) * 0.3;
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = intensity;
    }

    const distance = camera.position.length();
    // Puoi cambiare questa soglia in base alla scala della tua scena
    setVisible(distance < 10000);
  });

  const sunTexture = useLoader(THREE.TextureLoader, "/2k_sun.jpg");
  return visible ? (
    <group position={position}>
      {/* Sfera visiva del Sole */}
      <mesh ref={meshRef} onClick={() => console.log("clicked")}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial
          map={sunTexture}
          emissiveMap={sunTexture}
          emissiveIntensity={2}
          emissive={new THREE.Color(1, 1, 0.6)}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[size + 0.1, 64, 64]} />
        <meshStandardMaterial
          color="orange"
          transparent
          opacity={0.2}
          depthWrite={false}
          emissiveIntensity={2}
          emissive={"orange"}
        />
      </mesh>

      <group>
        {/* Sfera base con day + night map */}
        <mesh
          position={[0, 80, 21.8 + 10]}
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
            console.log("click: ", e.pointerId);
          }}
        >
          <sphereGeometry args={[10, 64, 64]} />
          <meshStandardMaterial color={"red"} />
        </mesh>
      </group>

      {/* <Html position={[0, size + 5, 0]} center>
        <div className="px-2 rounded-md font-bold bg-white">SUN</div>
      </Html> */}
      {/* Luce reale emessa */}
      <pointLight intensity={500} distance={500} decay={1} color={"#fffde3"} />
    </group>
  ) : null;
}
