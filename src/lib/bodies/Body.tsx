import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CelestialBody } from "../../data";
import { useSceneClock } from "../../hooks/useSceneClock";
import { useProgressiveTexture } from "../../hooks/useProgressiveTexture";
import { blendRadius, poleToQuaternion, poleToEcliptic, getSpinAngle, getEarthSpinAngle } from "../../helper/units";
import { scenePosition, hasRenderedRings, SATURN_RING_INNER, SATURN_RING_OUTER } from "../../helper/bodyPosition";
import { getParent } from "../../helper/bodies";
import { useBodyPointer } from "../../hooks/useBodyPointer";

// One unit sphere shared by every body, scaled per mesh
const SPHERE = new THREE.SphereGeometry(1, 64, 64);

const _parentPos = new THREE.Vector3();

function EarthLayers({ sphereRef, cloudRef }: {
  sphereRef: React.RefObject<THREE.Mesh | null>;
  cloudRef: React.RefObject<THREE.Mesh | null>;
}) {
  const day = useProgressiveTexture("2k_earth_daymap.jpg");
  const night = useProgressiveTexture("2k_earth_nightmap.jpg");
  const clouds = useProgressiveTexture("2k_earth_clouds.jpg");
  return (
    <>
      <mesh ref={sphereRef} geometry={SPHERE}>
        <meshStandardMaterial map={day} emissiveMap={night} emissiveIntensity={1.2} emissive="#ffffff" />
      </mesh>
      <mesh ref={cloudRef} geometry={SPHERE} raycast={() => null}>
        <meshStandardMaterial map={clouds} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  );
}

function SaturnRings({ ringRef }: { ringRef: React.RefObject<THREE.Mesh | null> }) {
  const texture = useProgressiveTexture("2k_saturn_ring_alpha.png");
  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(SATURN_RING_INNER, SATURN_RING_OUTER, 128);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - SATURN_RING_INNER) / (SATURN_RING_OUTER - SATURN_RING_INNER), 0.5);
    }
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} raycast={() => null}>
      <meshStandardMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function PlainSurface({ file, sphereRef }: { file: string; sphereRef: React.RefObject<THREE.Mesh | null> }) {
  const map = useProgressiveTexture(file);
  return (
    <mesh ref={sphereRef} geometry={SPHERE}>
      <meshStandardMaterial map={map} />
    </mesh>
  );
}

/**
 * A planet, dwarf planet or moon: positioned every frame from the ephemeris at
 * the simulated time. Bodies with IAU rotation data spin; moons without it are
 * tidally locked to their planet.
 */
export default function Body({ body }: { body: CelestialBody }) {
  const { blendRef, getTime, ephemeris } = useSceneClock();
  const pointer = useBodyPointer(body);
  const parent = getParent(body);
  const isEarth = body.map === "earth";
  const spins = body.info.spinW0 != null && body.info.spinRate != null;
  const tidallyLocked = !spins && body.type === "moon";

  const groupRef = useRef<THREE.Group>(null);
  const lockRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const { poleRA, poleDec } = body.info;
  const poleQuat = useMemo(
    () => (poleRA != null && poleDec != null ? poleToQuaternion(poleRA, poleDec) : new THREE.Quaternion()),
    [poleRA, poleDec]
  );
  const poleDir = useMemo(
    () => (poleRA != null && poleDec != null ? poleToEcliptic(poleRA, poleDec) : new THREE.Vector3(0, 0, 1)),
    [poleRA, poleDec]
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const t = getTime();
    const blend = blendRef.current;

    const pos = scenePosition(body, ephemeris, t, blend);
    group.visible = pos !== null;
    if (!pos) return;
    group.position.set(pos[0], pos[1], pos[2]);

    const size = blendRadius(body.radius, blend);
    sphereRef.current?.scale.setScalar(size);
    cloudRef.current?.scale.setScalar(size + 0.002);
    ringRef.current?.scale.setScalar(size);

    if (spins && spinRef.current) {
      const date = new Date(t);
      spinRef.current.rotation.y = isEarth
        ? getEarthSpinAngle(date)
        : getSpinAngle(body.info.spinW0!, body.info.spinRate!, date);
    }

    // Tidally locked: always face the planet. lookAt uses world coordinates
    if (tidallyLocked && lockRef.current && parent) {
      const p = scenePosition(parent, ephemeris, t, blend);
      if (p) {
        _parentPos.set(p[0], p[1], p[2]);
        lockRef.current.up.copy(poleDir);
        lockRef.current.lookAt(_parentPos);
      }
    }
  });

  const surface = isEarth ? (
    <EarthLayers sphereRef={sphereRef} cloudRef={cloudRef} />
  ) : (
    <PlainSurface file={body.texture} sphereRef={sphereRef} />
  );

  return (
    <group ref={groupRef} {...pointer}>
      {tidallyLocked ? (
        <group ref={lockRef}>
          <group rotation={[0, -Math.PI / 2, 0]}>{surface}</group>
        </group>
      ) : (
        <group quaternion={poleQuat}>
          {hasRenderedRings(body) && <SaturnRings ringRef={ringRef} />}
          <group ref={spinRef}>{surface}</group>
        </group>
      )}
    </group>
  );
}
