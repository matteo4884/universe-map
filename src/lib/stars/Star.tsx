import { useRef, useContext, useMemo, useEffect } from "react";
import { ScaleContext } from "../../context/contexts";
import { useLoader, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { blendPosition, blendRadius, poleToQuaternion, getSpinAngle } from "../../helper/units";
import { EphemerisContext } from "../../context/ephemeris";
import Planet from "../planets/Planet";
import * as THREE from "three";
import { BodySelectionContext } from "../../context/bodySelection";

const SUN_EMISSIVE = new THREE.Color(1, 1, 0.6);
const SUN_GLOW_COLOR = "orange";
const SUN_LIGHT_COLOR = "#fffde3";

interface StarProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  starObj: CelestialBody;
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
  showOrbits?: boolean;
}

/** Orbit lines with mutable geometry — rewritten in place when the scale blend changes */
function OrbitLines({ trajectories, planets }: { trajectories: Record<string, { x: number; y: number; z: number }[]>; planets: CelestialBody[] }) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blendRef } = scaleCtx;

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: "white", transparent: true, opacity: 0.015, depthWrite: false }), []);
  useEffect(() => () => lineMaterial.dispose(), [lineMaterial]);

  const orbits = useMemo(() => {
    const list: { id: number; traj: { x: number; y: number; z: number }[]; line: THREE.Line }[] = [];
    for (const planet of planets) {
      const traj = trajectories[planet.horizonsId];
      if (!traj || traj.length < 2) continue;
      const geo = new THREE.BufferGeometry();
      // One extra point closes the loop
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((traj.length + 1) * 3), 3));
      list.push({ id: planet.id, traj, line: new THREE.Line(geo, lineMaterial) });
    }
    return list;
  }, [trajectories, planets, lineMaterial]);

  useEffect(() => {
    return () => {
      for (const { line } of orbits) line.geometry.dispose();
    };
  }, [orbits]);

  const drawnBlend = useRef<number | null>(null);
  const drawnOrbits = useRef<typeof orbits | null>(null);

  useFrame(() => {
    const blend = blendRef.current;
    if (blend === drawnBlend.current && orbits === drawnOrbits.current) return;
    drawnBlend.current = blend;
    drawnOrbits.current = orbits;

    for (const { traj, line } of orbits) {
      const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
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
      line.geometry.computeBoundingSphere();
    }
  });

  return (
    <>
      {orbits.map(({ id, line }) => (
        <primitive key={`orbit-${id}`} object={line} />
      ))}
    </>
  );
}

export default function Star({
  position,
  starObj,
  visible,
  setVisible,
  showOrbits = true,
}: StarProps) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blendRef } = scaleCtx;
  const { trajectories } = useContext(EphemerisContext);
  const { selectBody } = useContext(BodySelectionContext);

  const glowRef = useRef<THREE.Mesh>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, camera }) => {
    // Sun radius blended — use scale on mesh, not geometry rebuild
    const sunSize = blendRadius(starObj.radius, blendRef.current);
    meshRef.current?.scale.setScalar(sunSize);
    glowRef.current?.scale.setScalar(sunSize + 0.5);

    if (starObj.info.spinW0 != null && starObj.info.spinRate != null) {
      const angle = getSpinAngle(starObj.info.spinW0, starObj.info.spinRate, new Date());
      if (meshRef.current) meshRef.current.rotation.y = angle;
      if (glowRef.current) glowRef.current.rotation.y = angle;
    }

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

  const sunTexture = useLoader(THREE.TextureLoader, "/2k_sun.jpg");

  const sunGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  const glowGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  useEffect(() => () => { sunGeo.dispose(); glowGeo.dispose(); }, [sunGeo, glowGeo]);

  const { poleRA, poleDec } = starObj.info;
  const sunPoleQuat = useMemo(() => {
    if (poleRA != null && poleDec != null) {
      return poleToQuaternion(poleRA, poleDec);
    }
    return new THREE.Quaternion();
  }, [poleRA, poleDec]);

  return (
    <group position={position} visible={visible}>
      <mesh
        ref={meshRef}
        quaternion={sunPoleQuat}
        geometry={sunGeo}
        onClick={() => selectBody(starObj.id)}
      >
        <meshStandardMaterial
          map={sunTexture}
          emissiveMap={sunTexture}
          emissiveIntensity={2}
          emissive={SUN_EMISSIVE}
        />
      </mesh>
      <mesh ref={glowRef} geometry={glowGeo}>
        <meshStandardMaterial
          color={SUN_GLOW_COLOR}
          transparent
          opacity={0.2}
          depthWrite={false}
          emissiveIntensity={2}
          emissive={SUN_GLOW_COLOR}
        />
      </mesh>

      {starObj.children.map((planet) => (
        <Planet
          key={`${starObj.id}-${planet.id}`}
          planetObj={planet}
          starObj={starObj}
          solarSystemVisible={visible}
        />
      ))}

      {/* Orbit trajectory lines */}
      {showOrbits && trajectories && <OrbitLines trajectories={trajectories} planets={starObj.children} />}

      <pointLight intensity={2} distance={5000000} decay={0} color={SUN_LIGHT_COLOR} />
    </group>
  );
}
