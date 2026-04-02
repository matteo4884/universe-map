import { useRef, useMemo } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import * as THREE from "three";

interface MoonProps {
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  moonObj?: CelestialBody;
}

const _earthWorldPos = new THREE.Vector3();

function poleDirection(poleRADeg: number, poleDecDeg: number): THREE.Vector3 {
  const OBLIQUITY = 23.4393 * (Math.PI / 180);
  const ra = poleRADeg * (Math.PI / 180);
  const dec = poleDecDeg * (Math.PI / 180);
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);
  return new THREE.Vector3(
    xEq,
    yEq * Math.cos(OBLIQUITY) + zEq * Math.sin(OBLIQUITY),
    -yEq * Math.sin(OBLIQUITY) + zEq * Math.cos(OBLIQUITY)
  ).normalize();
}

export default function Moon({ position, size, moonObj }: MoonProps) {
  const moonMap = useLoader(THREE.TextureLoader, "/2k_moon.jpg");
  const groupRef = useRef<THREE.Group>(null);

  const poleDir = useMemo(() => {
    if (moonObj?.info.poleRA != null && moonObj?.info.poleDec != null) {
      return poleDirection(moonObj.info.poleRA, moonObj.info.poleDec);
    }
    return new THREE.Vector3(0, 0, 1);
  }, [moonObj?.info.poleRA, moonObj?.info.poleDec]);

  useFrame(() => {
    if (groupRef.current?.parent) {
      // lookAt uses world coordinates — get Earth's world position from parent group
      groupRef.current.parent.getWorldPosition(_earthWorldPos);
      groupRef.current.up.copy(poleDir);
      groupRef.current.lookAt(_earthWorldPos);
    }
  });

  return (
    <group position={position} ref={groupRef}>
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial map={moonMap} />
      </mesh>
    </group>
  );
}
