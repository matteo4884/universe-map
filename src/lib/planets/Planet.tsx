import { useState, useContext, useRef, useMemo } from "react";
import { ScaleDistanceScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { ScaleEarthUnitSize } from "../../helper/units";
import { KM_PER_UNIT } from "../../services/horizons";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";

interface PlanetProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  rotation: number;
  planetObj: CelestialBody;
  starObj: CelestialBody;
  showOrbits?: boolean;
}

export default function Planet({
  map,
  position,
  size,
  rotation,
  planetObj,
  starObj,
  showOrbits = true,
}: PlanetProps) {
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance)
    throw new Error(
      "MyComponent must be used within ScaleDistanceScaleProvider"
    );
  const { scaleDistance } = contextScaleDistance;
  const { positions, trajectories } = useContext(EphemerisContext);
  const isEarth = map === "earth";

  const textureMap: Record<string, string> = {
    mercury: "2k_mercury.jpg",
    venus: "2k_venus_surface.jpg",
    earth: "2k_earth_daymap.jpg",
    mars: "2k_mars.jpg",
    jupiter: "2k_jupiter.jpg",
    saturn: "2k_saturn.jpg",
    uranus: "2k_uranus.jpg",
    neptune: "2k_neptune.jpg",
  };
  const texture = textureMap[map] ?? "2k_earth_daymap.jpg";

  const colorMap = useLoader(THREE.TextureLoader, `/${texture}`);
  const nightMap = useLoader(
    THREE.TextureLoader,
    isEarth ? "/2k_earth_nightmap.jpg" : `/${texture}`
  );
  const cloudMap = useLoader(
    THREE.TextureLoader,
    isEarth ? "/2k_earth_clouds.jpg" : `/${texture}`
  );

  const moons = planetObj.children.map((moon) => {
    let moonPosition: [number, number, number];

    if (positions && positions[moon.horizonsId] && positions[planetObj.horizonsId]) {
      const moonPos = positions[moon.horizonsId];
      const planetPos = positions[planetObj.horizonsId];
      moonPosition = [
        (moonPos.x - planetPos.x) / KM_PER_UNIT / scaleDistance,
        (moonPos.y - planetPos.y) / KM_PER_UNIT / scaleDistance,
        (moonPos.z - planetPos.z) / KM_PER_UNIT / scaleDistance,
      ];
    } else {
      const offset =
        moon.distanceFromParent / KM_PER_UNIT / scaleDistance +
        ScaleEarthUnitSize({ size: planetObj.radius }) +
        ScaleEarthUnitSize({ size: moon.radius });
      moonPosition = [offset, offset, 0];
    }

    return (
      <Moon
        position={moonPosition}
        size={ScaleEarthUnitSize({ size: moon.radius })}
        key={`${starObj.id}-${planetObj.id}-${moon.id}`}
      />
    );
  });

  const orbitPoints = useMemo(() => {
    if (!trajectories || !trajectories[planetObj.horizonsId]) return null;
    return trajectories[planetObj.horizonsId].map(
      (p) =>
        new THREE.Vector3(
          p.x / KM_PER_UNIT / scaleDistance,
          p.y / KM_PER_UNIT / scaleDistance,
          p.z / KM_PER_UNIT / scaleDistance
        )
    );
  }, [trajectories, planetObj.horizonsId, scaleDistance]);

  const negPosition: [number, number, number] = [
    -(position as [number, number, number])[0],
    -(position as [number, number, number])[1],
    -(position as [number, number, number])[2],
  ];

  const [visible, setVisible] = useState(false);
  const { camera } = useThree();
  const planetPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    planetPosRef.current.set(
      ...(position as [number, number, number])
    );
    const distance = camera.position.distanceTo(planetPosRef.current);
    const shouldBeVisible = distance > 100;
    if (shouldBeVisible !== visible) {
      setVisible(shouldBeVisible);
    }
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
      {isEarth ? (
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

      {showOrbits && orbitPoints && orbitPoints.length > 1 && (
        <group position={negPosition}>
          <Line
            points={orbitPoints}
            color="white"
            lineWidth={0.5}
            transparent
            opacity={0.1}
          />
        </group>
      )}

      {moons}
    </group>
  );
}
