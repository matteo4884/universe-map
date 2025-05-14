import { useRef, useContext } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { StarParam } from "../../data";
import { ScaleEarthUnitSize, ScaleDistance } from "../../helper/units";
import Planet from "../planets/Planet";
import * as THREE from "three";

interface StarProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  starObj: StarParam;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Star({
  map,
  position,
  size,
  starObj,
  visible,
  setVisible,
}: StarProps) {
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance)
    throw new Error(
      "MyComponent must be used within ScaleDistanceScaleProvider"
    );
  const { scaleDistance } = contextScaleDistance;

  const glowRef = useRef<THREE.Mesh>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  let texture;
  let color;
  let emessive;
  let light;
  switch (map) {
    case "g":
      texture = "2k_sun.jpg";
      color = "orange";
      emessive = new THREE.Color(1, 1, 0.6);
      light = "#fffde3";
      break;
  }

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
    setVisible(distance < 10000000);
  });

  const sunTexture = useLoader(THREE.TextureLoader, `/${texture}`);

  const planets: React.ReactNode[] = [];

  starObj.planets.map((planet) => {
    return planets.push(
      <Planet
        map={planet.map}
        position={[
          ScaleDistance({ distance: 0, scale: scaleDistance }),
          ScaleDistance({ distance: 0, scale: scaleDistance }),
          ScaleDistance({
            distance: planet.distanceFromStar,
            scale: scaleDistance,
          }) +
            ScaleEarthUnitSize({ size: starObj.radius }) +
            +ScaleEarthUnitSize({ size: planet.radius }),
        ]}
        size={ScaleEarthUnitSize({ size: planet.radius })}
        rotation={planet.info.axialTilt}
        key={`${starObj.id}-${planet.id}`}
        planetObj={planet}
        starObj={starObj}
      />
    );
  });

  return visible ? (
    <group position={position}>
      {/* Sfera visiva del Sole */}
      <mesh
        ref={meshRef}
        onClick={() => {
          console.log("clicked");
        }}
      >
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial
          map={sunTexture}
          emissiveMap={sunTexture}
          emissiveIntensity={2}
          emissive={emessive}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[size + 0.5, 64, 64]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.2}
          depthWrite={false}
          emissiveIntensity={2}
          emissive={color}
        />
      </mesh>

      {planets}
      {/* <Html position={[0, 0, 0]} center>
        <div className="px-2 rounded-md font-bold bg-white">SUN</div>
      </Html> */}
      {/* Luce reale emessa */}
      <pointLight intensity={2} distance={5000000} decay={0} color={light} />
    </group>
  ) : null;
}
