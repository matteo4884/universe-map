import { useContext, useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ArtemisModeContext } from "../../context/artemisMode";
import { blendPosition } from "../../helper/units";

const MODEL_SCALE = 0.002; // ~16 km — exaggerated for visibility

function OrionModel() {
  const { scene } = useGLTF("/models/orion.glb");
  return <primitive object={scene} scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]} />;
}

function OrionPlaceholder() {
  return (
    <mesh>
      <octahedronGeometry args={[0.02, 0]} />
      <meshStandardMaterial color="#ffffff" emissive="#4a90d9" emissiveIntensity={2} />
    </mesh>
  );
}

export default function OrionSpacecraft() {
  const { active, position } = useContext(ArtemisModeContext);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current || !position) return;
    const pos = blendPosition(position.x, position.y, position.z, 1);
    groupRef.current.position.set(pos[0], pos[1], pos[2]);

    if (position.vx !== undefined && position.vy !== undefined && position.vz !== undefined) {
      if (position.vx !== 0 || position.vy !== 0 || position.vz !== 0) {
        const forward = new THREE.Vector3(position.vx, position.vy, position.vz).normalize();
        const target = groupRef.current.position.clone().add(forward);
        groupRef.current.lookAt(target);
      }
    }
  });

  if (!active || !position) return null;

  return (
    <group ref={groupRef}>
      <Suspense fallback={<OrionPlaceholder />}>
        <OrionModel />
      </Suspense>

      <Html center className="pointer-events-none noselect" position={[0, 0, 0.06]}>
        <div className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap">
          ORION
        </div>
      </Html>
    </group>
  );
}
