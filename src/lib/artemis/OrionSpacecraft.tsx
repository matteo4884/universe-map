import { useContext, useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ArtemisModeContext } from "../../context/artemisMode";
import { blendPosition } from "../../helper/units";
import { EphemerisPoint } from "../../services/horizons";

function OrionModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} scale={[0.5, 0.5, 0.5]} />;
}

function OrionPlaceholder() {
  return (
    <mesh>
      <octahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color="#ffffff" emissive="#4a90d9" emissiveIntensity={2} />
    </mesh>
  );
}

export default function OrionSpacecraft() {
  const { active, position, trajectory, mission } = useContext(ArtemisModeContext);
  const groupRef = useRef<THREE.Group>(null);

  const trailPoints = useMemo(() => {
    if (trajectory.length < 2) return null;
    return trajectory.map((p: EphemerisPoint) => {
      const pos = blendPosition(p.x, p.y, p.z, 1);
      return new THREE.Vector3(pos[0], pos[1], pos[2]);
    });
  }, [trajectory]);

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
    <>
      <group ref={groupRef}>
        <Suspense fallback={<OrionPlaceholder />}>
          {mission?.modelPath ? (
            <OrionModel url={mission.modelPath} />
          ) : (
            <OrionPlaceholder />
          )}
        </Suspense>

        <Html center className="pointer-events-none noselect" position={[0, 1, 0]}>
          <div className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap">
            ORION
          </div>
        </Html>
      </group>

      {trailPoints && trailPoints.length >= 2 && (
        <Line
          points={trailPoints}
          color="#00ccff"
          lineWidth={1}
          transparent
          opacity={0.4}
          dashed
          dashSize={2}
          gapSize={1}
        />
      )}
    </>
  );
}
