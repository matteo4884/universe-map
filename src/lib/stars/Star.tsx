import { useRef, useContext, useMemo, useEffect } from "react";
import { ScaleContext } from "../../context/contexts";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { blendPosition, blendRadius, KM_PER_UNIT, poleToQuaternion, getSpinAngle } from "../../helper/units";
import { EphemerisContext } from "../../context/ephemeris";
import Planet from "../planets/Planet";
import * as THREE from "three";
import { BodySelectionContext } from "../../context/bodySelection";

interface StarProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  starObj: CelestialBody;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
  showOrbits?: boolean;
}

/** Orbit lines with mutable geometry — avoids recreating thousands of Vector3 objects per frame */
function OrbitLines({ trajectories, planets, blend }: { trajectories: Record<string, { x: number; y: number; z: number }[]>; planets: CelestialBody[]; blend: number }) {
  const geos = useMemo(() => {
    const map = new Map<string, { geo: THREE.BufferGeometry; trajLen: number }>();
    for (const planet of planets) {
      const traj = trajectories[planet.horizonsId];
      if (!traj || traj.length < 2) continue;
      const count = traj.length + 1;
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      map.set(String(planet.id), { geo, trajLen: traj.length });
    }
    return map;
  }, [trajectories, planets]);

  useEffect(() => {
    for (const planet of planets) {
      const entry = geos.get(String(planet.id));
      if (!entry) continue;
      const traj = trajectories[planet.horizonsId];
      const attr = entry.geo.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < traj.length; i++) {
        const pos = blendPosition(traj[i].x, traj[i].y, traj[i].z, blend);
        arr[i * 3] = pos[0];
        arr[i * 3 + 1] = pos[1];
        arr[i * 3 + 2] = pos[2];
      }
      arr[traj.length * 3] = arr[0];
      arr[traj.length * 3 + 1] = arr[1];
      arr[traj.length * 3 + 2] = arr[2];
      attr.needsUpdate = true;
    }
  }, [blend, geos, planets, trajectories]);

  useEffect(() => {
    return () => {
      for (const { geo } of geos.values()) geo.dispose();
    };
  }, [geos]);

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: "white", transparent: true, opacity: 0.015, depthWrite: false }), []);

  return (
    <>
      {planets.map((planet) => {
        const entry = geos.get(String(planet.id));
        if (!entry) return null;
        const lineObj = new THREE.Line(entry.geo, lineMaterial);
        return <primitive key={`orbit-${planet.id}`} object={lineObj} />;
      })}
    </>
  );
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
  const { selectBody } = useContext(BodySelectionContext);

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

  // Sun radius blended — use scale on mesh, not geometry rebuild
  const sunSize = blendRadius(starObj.radius, blend);

  const sunGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  const glowGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  useEffect(() => () => { sunGeo.dispose(); glowGeo.dispose(); }, [sunGeo, glowGeo]);

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
        solarSystemVisible={visible}
      />
    );
  });

  return (
    <group position={position} visible={visible}>
      <mesh
        ref={meshRef}
        quaternion={sunPoleQuat}
        geometry={sunGeo}
        scale={[sunSize, sunSize, sunSize]}
        onClick={() => selectBody(starObj.id)}
      >
        <meshStandardMaterial
          map={sunTexture}
          emissiveMap={sunTexture}
          emissiveIntensity={2}
          emissive={emissive}
        />
      </mesh>
      <mesh ref={glowRef} geometry={glowGeo} scale={[sunSize + 0.5, sunSize + 0.5, sunSize + 0.5]}>
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
      {showOrbits && trajectories && <OrbitLines trajectories={trajectories} planets={starObj.children} blend={blend} />}

      <pointLight intensity={2} distance={5000000} decay={0} color={light} />
    </group>
  );
}
