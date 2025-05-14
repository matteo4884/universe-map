import { useState, useContext } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { PlanetParam, StarParam } from "../../data";
import { ScaleEarthUnitSize, ScaleDistance } from "../../helper/units";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html } from "@react-three/drei";

interface PlanetProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  rotation: number;
  planetObj: PlanetParam;
  starObj: StarParam;
}

export default function Planet({
  map,
  position,
  size,
  rotation,
  planetObj,
  starObj,
}: PlanetProps) {
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance)
    throw new Error(
      "MyComponent must be used within ScaleDistanceScaleProvider"
    );
  const { scaleDistance } = contextScaleDistance;
  let texture = "2k_earth_daymap.jpg";
  let clouds = "2k_earth_clouds.jpg";
  let night = "2k_earth_nightmap.jpg";
  // let ring = "2k_saturn_ring_alpha.png";
  switch (map) {
    case "mercury":
      texture = "2k_mars.jpg";
      break;
    case "venus":
      texture = "2k_venus_surface.jpg";
      break;
    case "earth":
      texture = "2k_earth_daymap.jpg";
      clouds = "2k_earth_clouds.jpg";
      night = "2k_earth_nightmap.jpg";
      break;
    case "mars":
      texture = "2k_mars.jpg";
      break;
    case "jupiter":
      texture = "2k_jupiter.jpg";
      break;
    case "saturn":
      texture = "2k_saturn.jpg";
      // ring = "2k_saturn_ring_alpha.png";
      break;
    case "uranus":
      texture = "2k_uranus.jpg";
      break;
    case "neptune":
      texture = "2k_neptune.jpg";
      break;
  }
  const colorMap = useLoader(THREE.TextureLoader, `/${texture}`);
  const nightMap = useLoader(THREE.TextureLoader, `/${night}`);
  const cloudMap = useLoader(THREE.TextureLoader, `/${clouds}`);

  const moons: React.ReactNode[] = [];

  planetObj.moons.map((moon) => {
    if (moon) {
      return moons.push(
        <Moon
          position={[
            ScaleDistance({
              distance: moon.distanceFromPlanet,
              scale: scaleDistance,
            }) +
              ScaleEarthUnitSize({ size: planetObj.radius }) +
              ScaleEarthUnitSize({ size: moon.radius }),
            ScaleDistance({
              distance: moon.distanceFromPlanet,
              scale: scaleDistance,
            }) +
              ScaleEarthUnitSize({ size: planetObj.radius }) +
              ScaleEarthUnitSize({ size: moon.radius }),
            0,
          ]}
          size={ScaleEarthUnitSize({ size: moon.radius })}
          key={`${starObj.id}-${planetObj.id}-${moon.id}`}
        />
      );
    }
  });

  const [visible, setVisible] = useState(false);
  const { camera } = useThree();

  useFrame(() => {
    const planetPos = new THREE.Vector3(...position);
    const distance = camera.position.distanceTo(planetPos);

    setVisible(distance > 100); // 👈 soglia di visibilità
  });

  return (
    <group
      position={position}
      rotation={[0, 0, THREE.MathUtils.degToRad(rotation)]}
      onClick={(e) => {
        console.log(e);
        console.log("scheda");
      }}
    >
      {map === "earth" ? (
        <group>
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
      ) : (
        <mesh>
          <sphereGeometry args={[size, 64, 64]} />
          <meshStandardMaterial map={colorMap} />
        </mesh>
      )}

      {visible && (
        <Html
          className="relative noselect pointer-events-none"
          position={[0, size, 0]}
          center
        >
          <div
            className="px-2 py-1 rounded-md font-bold mb-16 bg-[#ffffff1e] hover:bg-[#919191] uppercase pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              //   console.log(e);
              //   console.log("scheda");
            }}
          >
            {planetObj.name}
          </div>
          {/* <div className="w-6 h-6 rounded-full absolute left-0 right-0 top-0 bottom-0 m-auto border border-[#fff]"></div> */}
        </Html>
      )}

      {moons}
    </group>
  );
}
