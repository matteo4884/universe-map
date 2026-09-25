import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CelestialBody } from "../../data";
import { useSceneClock } from "../../hooks/useSceneClock";
import { useProgressiveTexture } from "../../hooks/useProgressiveTexture";
import { blendRadius, poleToQuaternion, getSpinAngle } from "../../helper/units";
import { useBodyPointer } from "../../hooks/useBodyPointer";

const SPHERE = new THREE.SphereGeometry(1, 64, 64);
const EMISSIVE = new THREE.Color(1, 1, 0.6);
const GLOW_COLOR = "orange";
const LIGHT_COLOR = "#fffde3";

/** The Sun: emissive, gently pulsing, and the only light of the scene */
export default function Sun({ body }: { body: CelestialBody }) {
  const { blendRef, getTime } = useSceneClock();
  const pointer = useBodyPointer(body);
  const texture = useProgressiveTexture(body.texture);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const { poleRA, poleDec } = body.info;
  const poleQuat = useMemo(
    () => (poleRA != null && poleDec != null ? poleToQuaternion(poleRA, poleDec) : new THREE.Quaternion()),
    [poleRA, poleDec]
  );

  useFrame(({ clock }) => {
    const size = blendRadius(body.radius, blendRef.current);
    meshRef.current?.scale.setScalar(size);
    glowRef.current?.scale.setScalar(size + 0.5);

    if (body.info.spinW0 != null && body.info.spinRate != null) {
      const angle = getSpinAngle(body.info.spinW0, body.info.spinRate, new Date(getTime()));
      if (meshRef.current) meshRef.current.rotation.y = angle;
    }

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 2 + Math.sin(clock.getElapsedTime() * 2) * 0.3;
    }
  });

  return (
    <group {...pointer}>
      <group quaternion={poleQuat}>
        <mesh ref={meshRef} geometry={SPHERE}>
          <meshStandardMaterial map={texture} emissiveMap={texture} emissiveIntensity={2} emissive={EMISSIVE} />
        </mesh>
      </group>
      <mesh ref={glowRef} geometry={SPHERE} raycast={() => null}>
        <meshStandardMaterial
          color={GLOW_COLOR}
          transparent
          opacity={0.2}
          depthWrite={false}
          emissiveIntensity={2}
          emissive={GLOW_COLOR}
        />
      </mesh>
      <pointLight intensity={2} distance={5000000} decay={0} color={LIGHT_COLOR} />
    </group>
  );
}
