import { useRef, useMemo, useEffect, useContext } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CelestialBody } from "../../data";
import { ScaleContext, ArtemisModeContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { BodySelectionContext } from "../../context/bodySelection";
import { blendRadius, poleToEcliptic } from "../../helper/units";
import { moonOffset } from "../../helper/bodyPosition";
import * as THREE from "three";

const TEXTURES: Record<string, string> = {
  moon: "2k_moon.jpg",
  phobos: "2k_fictional_2.jpg",
  deimos: "2k_fictional_2.jpg",
  io: "2k_io.jpg",
  europa: "2k_europa.jpg",
  ganymede: "2k_ganymede.jpg",
  callisto: "2k_callisto.jpg",
  titan: "2k_titan.jpg",
  enceladus: "2k_fictional_3.jpg",
  rhea: "2k_fictional_4.jpg",
  mimas: "2k_fictional_2.jpg",
  iapetus: "2k_fictional_1.jpg",
  titania: "2k_fictional_3.jpg",
  oberon: "2k_fictional_4.jpg",
  ariel: "2k_fictional_1.jpg",
  umbriel: "2k_fictional_2.jpg",
  miranda: "2k_fictional_3.jpg",
  triton: "2k_triton.jpg",
};

interface MoonProps {
  moonObj: CelestialBody;
  planetObj: CelestialBody;
}

const _planetWorldPos = new THREE.Vector3();

export default function Moon({ moonObj, planetObj }: MoonProps) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blendRef } = scaleCtx;
  const { positions } = useContext(EphemerisContext);
  const { active: artemisActive } = useContext(ArtemisModeContext);
  const { selectBody } = useContext(BodySelectionContext);
  const isEarthMoon = moonObj.name === "Moon";

  const texture = TEXTURES[moonObj.map] ?? "2k_moon.jpg";
  const moonMap = useLoader(THREE.TextureLoader, `/${texture}`);

  const positionRef = useRef<THREE.Group>(null);
  const lookRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  useEffect(() => () => { sphereGeo.dispose(); }, [sphereGeo]);

  const { poleRA, poleDec } = moonObj.info;
  const poleDir = useMemo(() => {
    if (poleRA != null && poleDec != null) {
      return poleToEcliptic(poleRA, poleDec);
    }
    return new THREE.Vector3(0, 0, 1);
  }, [poleRA, poleDec]);

  useFrame(() => {
    const blend = blendRef.current;
    positionRef.current?.position.set(...moonOffset(moonObj, planetObj, positions, blend));
    const size = blendRadius(moonObj.radius, blend);
    meshRef.current?.scale.setScalar(size);
    labelRef.current?.position.set(0, 0, size * 2.5);

    // Tidally locked: always face the planet (the position group's parent).
    // lookAt uses world coordinates
    const planetGroup = positionRef.current?.parent;
    if (lookRef.current && planetGroup) {
      planetGroup.getWorldPosition(_planetWorldPos);
      lookRef.current.up.copy(poleDir);
      lookRef.current.lookAt(_planetWorldPos);
    }
  });

  return (
    <group ref={positionRef}>
      <group ref={lookRef}>
        <mesh ref={meshRef} rotation={[0, -Math.PI / 2, 0]} onClick={() => selectBody(moonObj.id)} geometry={sphereGeo}>
          <meshStandardMaterial map={moonMap} />
        </mesh>
      </group>
      {/* Label outside lookAt group so Z-up stays world-space */}
      <group ref={labelRef}>
        {artemisActive && isEarthMoon && (
          <Html center className="pointer-events-none noselect">
            <div className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap">
              Moon
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}
