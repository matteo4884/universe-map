import { useContext, useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ArtemisModeContext } from "../../context/contexts";
import { blendPosition } from "../../helper/units";

const REAL_SCALE = 1 / 6371000; // ~8m
const ENHANCED_SCALE = 0.002; // ~130km — visible without z-fighting

const _forward = new THREE.Vector3();
const _worldPos = new THREE.Vector3();

function SpacecraftModel({ path, scale }: { path: string; scale: number }) {
  const { scene } = useGLTF(path);
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} scale={[scale, scale, scale]} />;
}

function OrionPlaceholder() {
  return (
    <mesh>
      <octahedronGeometry args={[0.0000005, 0]} />
      <meshStandardMaterial color="#ffffff" emissive="#4a90d9" emissiveIntensity={2} />
    </mesh>
  );
}

/** The mission's crewed spacecraft, at its live position (realistic scale) */
export default function OrionSpacecraft() {
  const { mission, active, hasPosition, getSpacecraftPosition, orionEnhanced } = useContext(ArtemisModeContext);
  const posRef = useRef<THREE.Group>(null);
  const rotRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const position = getSpacecraftPosition();
    if (!posRef.current || !rotRef.current || !position) return;
    const pos = blendPosition(position.x, position.y, position.z, 1);
    posRef.current.position.set(pos[0], pos[1], pos[2]);

    if (position.vx !== undefined && position.vy !== undefined && position.vz !== undefined) {
      if (position.vx !== 0 || position.vy !== 0 || position.vz !== 0) {
        _forward.set(-position.vx, -position.vy, -position.vz).normalize();
        posRef.current.getWorldPosition(_worldPos);
        rotRef.current.up.set(0, 0, 1);
        rotRef.current.lookAt(_worldPos.add(_forward));
      }
    }
  });

  if (!active || !hasPosition || !mission) return null;

  return (
    <group ref={posRef}>
      <group ref={rotRef}>
        <group rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
          <Suspense fallback={<OrionPlaceholder />}>
            {orionEnhanced ? (
              <SpacecraftModel path={mission.models.enhanced} scale={ENHANCED_SCALE} />
            ) : (
              <SpacecraftModel path={mission.models.real} scale={REAL_SCALE} />
            )}
          </Suspense>
        </group>
      </group>

      <Html center className="pointer-events-none noselect" position={[0, 0, orionEnhanced ? 0.02 : 0.000002]}>
        <div className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap">
          {mission.spacecraftName}
        </div>
      </Html>
    </group>
  );
}
