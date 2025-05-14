import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface EarthProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
}

export default function Earth({ position, size }: EarthProps) {
  const colorMap = useLoader(THREE.TextureLoader, "/2k_earth_daymap.jpg");
  const cloudMap = useLoader(THREE.TextureLoader, "/2k_earth_clouds.jpg");
  const nightMap = useLoader(THREE.TextureLoader, "/2k_earth_nightmap.jpg");
  const moonMap = useLoader(THREE.TextureLoader, "/2k_moon.jpg");

  //   useFrame(() => {
  //     if (earth.current) {
  //       earth.current.rotation.y += 0.002;
  //     }
  //   });

  return (
    <group
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
      position={position}
    >
      {/* Sfera base con day + night map */}
      <group rotation={[0, 0, THREE.MathUtils.degToRad(23.44)]}>
        <mesh>
          <sphereGeometry args={[size, 64, 64]} />
          <meshStandardMaterial
            map={colorMap}
            emissiveMap={nightMap}
            emissiveIntensity={1.2}
            emissive={new THREE.Color(0xffffff)}
          />
        </mesh>

        {/* Sfera leggermente più grande per le nuvole */}
        <mesh>
          <sphereGeometry args={[size + 0.002, 64, 64]} />
          <meshStandardMaterial
            map={cloudMap}
            transparent={true}
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh position={[2, 2, 2]}>
        <sphereGeometry args={[size * 0.04, 64, 64]} />
        <meshStandardMaterial map={moonMap} />
      </mesh>
    </group>
  );
}
