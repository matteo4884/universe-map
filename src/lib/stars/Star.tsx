import { useRef, useContext, useMemo } from "react";
import { ScaleContext } from "../../context/contexts";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { blendPosition, blendRadius, KM_PER_UNIT, poleToQuaternion, getSpinAngle } from "../../helper/units";
import { EphemerisContext } from "../../context/ephemeris";
import Planet from "../planets/Planet";
import * as THREE from "three";
import { Line } from "@react-three/drei";

interface StarProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  starObj: CelestialBody;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
  showOrbits?: boolean;
}

export default function Star({
  map,
  position,
  starObj,
  visible,
  setVisible,
  showOrbits = true,
}: StarProps) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blend } = scaleCtx;
  const { positions, trajectories } = useContext(EphemerisContext);

  const glowRef = useRef<THREE.Mesh>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  let texture = "2k_sun.jpg";
  let color = "orange";
  let emissive = new THREE.Color(1, 1, 0.6);
  let light = "#fffde3";
  switch (map) {
    case "g":
      texture = "2k_sun.jpg";
      color = "orange";
      emissive = new THREE.Color(1, 1, 0.6);
      light = "#fffde3";
      break;
  }

  useFrame(() => {
    if (starObj.info.spinW0 != null && starObj.info.spinRate != null) {
      const angle = getSpinAngle(starObj.info.spinW0, starObj.info.spinRate, new Date());
      if (meshRef.current) meshRef.current.rotation.y = angle;
      if (glowRef.current) glowRef.current.rotation.y = angle;
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
    const shouldBeVisible = distance < 10000000;
    if (shouldBeVisible !== visible) {
      setVisible(shouldBeVisible);
    }
  });

  const sunTexture = useLoader(THREE.TextureLoader, `/${texture}`);

  // Sun radius blended
  const sunSize = blendRadius(starObj.radius, blend);

  const sunPoleQuat = useMemo(() => {
    const { poleRA, poleDec } = starObj.info;
    if (poleRA != null && poleDec != null) {
      return poleToQuaternion(poleRA, poleDec);
    }
    return new THREE.Quaternion();
  }, [starObj.info.poleRA, starObj.info.poleDec]);

  const planets = starObj.children.map((planet) => {
    let planetPosition: [number, number, number];

    if (positions && positions[planet.horizonsId]) {
      const pos = positions[planet.horizonsId];
      planetPosition = blendPosition(pos.x, pos.y, pos.z, blend);
    } else {
      const fallbackZ = planet.distanceFromParent / KM_PER_UNIT + sunSize;
      planetPosition = [0, 0, fallbackZ];
    }

    const planetSize = blendRadius(planet.radius, blend);

    return (
      <Planet
        map={planet.map}
        position={planetPosition}
        size={planetSize}
        key={`${starObj.id}-${planet.id}`}
        planetObj={planet}
        starObj={starObj}
        showOrbits={showOrbits}
      />
    );
  });

  return visible ? (
    <group position={position}>
      <mesh
        ref={meshRef}
        quaternion={sunPoleQuat}
        onClick={() => {
          console.log("clicked");
        }}
      >
        <sphereGeometry args={[sunSize, 64, 64]} />
        <meshStandardMaterial
          map={sunTexture}
          emissiveMap={sunTexture}
          emissiveIntensity={2}
          emissive={emissive}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[sunSize + 0.5, 64, 64]} />
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

      {/* Orbit trajectory lines */}
      {showOrbits &&
        trajectories &&
        starObj.children.map((planet) => {
          const traj = trajectories[planet.horizonsId];
          if (!traj || traj.length < 2) return null;
          const points = traj.map((p) => {
            const pos = blendPosition(p.x, p.y, p.z, blend);
            return new THREE.Vector3(pos[0], pos[1], pos[2]);
          });
          points.push(points[0].clone());
          return (
            <Line
              key={`orbit-${planet.id}`}
              points={points}
              color="white"
              lineWidth={0.3}
              transparent
              opacity={0.03}
            />
          );
        })}

      <pointLight intensity={2} distance={5000000} decay={0} color={light} />
    </group>
  ) : null;
}
