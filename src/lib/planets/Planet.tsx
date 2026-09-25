import { useState, useContext, useRef, useMemo, useEffect } from "react";
import { ScaleContext, ArtemisModeContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { useLoader, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { blendRadius, poleToQuaternion, getSpinAngle, getEarthSpinAngle } from "../../helper/units";
import { planetPosition, hasRenderedRings, SATURN_RING_INNER, SATURN_RING_OUTER } from "../../helper/bodyPosition";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { BodySelectionContext } from "../../context/bodySelection";

const TEXTURES: Record<string, string> = {
  mercury: "2k_mercury.jpg",
  venus: "2k_venus_surface.jpg",
  earth: "2k_earth_daymap.jpg",
  mars: "2k_mars.jpg",
  jupiter: "2k_jupiter.jpg",
  saturn: "2k_saturn.jpg",
  uranus: "2k_uranus.jpg",
  neptune: "2k_neptune.jpg",
};

interface PlanetProps {
  planetObj: CelestialBody;
  starObj: CelestialBody;
  solarSystemVisible: boolean;
}

export default function Planet({
  planetObj,
  starObj,
  solarSystemVisible,
}: PlanetProps) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blendRef } = scaleCtx;
  const { positions } = useContext(EphemerisContext);
  const { active: artemisActive } = useContext(ArtemisModeContext);
  const { selectBody } = useContext(BodySelectionContext);
  const isEarth = planetObj.map === "earth";
  const isSaturn = hasRenderedRings(planetObj);

  const texture = TEXTURES[planetObj.map] ?? "2k_earth_daymap.jpg";

  // Hooks can't be conditional: non-Earth/non-Saturn planets reuse their
  // own (already cached) texture for the unused slots
  const colorMap = useLoader(THREE.TextureLoader, `/${texture}`);
  const nightMap = useLoader(
    THREE.TextureLoader,
    isEarth ? "/2k_earth_nightmap.jpg" : `/${texture}`
  );
  const cloudMap = useLoader(
    THREE.TextureLoader,
    isEarth ? "/2k_earth_clouds.jpg" : `/${texture}`
  );
  const ringTexture = useLoader(
    THREE.TextureLoader,
    isSaturn ? "/2k_saturn_ring_alpha.png" : `/${texture}`
  );

  const { poleRA, poleDec } = planetObj.info;
  const poleQuat = useMemo(() => {
    if (poleRA != null && poleDec != null) {
      return poleToQuaternion(poleRA, poleDec);
    }
    return new THREE.Quaternion();
  }, [poleRA, poleDec]);

  const ringGeo = useMemo(() => {
    if (!isSaturn) return null;
    const geo = new THREE.RingGeometry(SATURN_RING_INNER, SATURN_RING_OUTER, 64);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      uv.setXY(i, (r - SATURN_RING_INNER) / (SATURN_RING_OUTER - SATURN_RING_INNER), 0.5);
    }
    return geo;
  }, [isSaturn]);

  useEffect(() => {
    return () => {
      ringGeo?.dispose();
    };
  }, [ringGeo]);

  // Sphere geometry created once, scaled by mesh
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  const cloudGeo = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  useEffect(() => () => { sphereGeo.dispose(); cloudGeo.dispose(); }, [sphereGeo, cloudGeo]);

  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  const [labelVisible, setLabelVisible] = useState(false);

  useFrame(({ camera }) => {
    const blend = blendRef.current;

    // Position and size follow the scale blend without re-rendering
    if (groupRef.current) {
      groupRef.current.position.set(...planetPosition(planetObj, starObj, positions, blend));
    }
    const size = blendRadius(planetObj.radius, blend);
    sphereRef.current?.scale.setScalar(size);
    cloudRef.current?.scale.setScalar(size + 0.002);
    ringRef.current?.scale.setScalar(size);
    labelRef.current?.position.set(0, 0, size * 2.5);

    if (spinRef.current) {
      if (isEarth) {
        spinRef.current.rotation.y = getEarthSpinAngle(new Date());
      } else if (planetObj.info.spinW0 != null && planetObj.info.spinRate != null) {
        spinRef.current.rotation.y = getSpinAngle(
          planetObj.info.spinW0,
          planetObj.info.spinRate,
          new Date()
        );
      }
    }

    if (groupRef.current) {
      const shouldShowLabel = camera.position.distanceTo(groupRef.current.position) > 100;
      if (shouldShowLabel !== labelVisible) {
        setLabelVisible(shouldShowLabel);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group quaternion={poleQuat}>
        {ringGeo && (
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo}>
            <meshStandardMaterial
              map={ringTexture}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        <group ref={spinRef}>
          {isEarth ? (
            <group>
              <mesh ref={sphereRef} geometry={sphereGeo} onClick={() => selectBody(planetObj.id)}>
                <meshStandardMaterial
                  map={colorMap}
                  emissiveMap={nightMap}
                  emissiveIntensity={1.2}
                  emissive="#ffffff"
                />
              </mesh>
              <mesh ref={cloudRef} geometry={cloudGeo}>
                <meshStandardMaterial
                  map={cloudMap}
                  transparent={true}
                  opacity={0.5}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ) : (
            <mesh ref={sphereRef} geometry={sphereGeo} onClick={() => selectBody(planetObj.id)}>
              <meshStandardMaterial map={colorMap} />
            </mesh>
          )}
        </group>
      </group>

      <group ref={labelRef}>
        {solarSystemVisible && ((labelVisible && !artemisActive) || (artemisActive && isEarth)) ? (
          <Html center className="noselect">
            <button
              type="button"
              className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap cursor-pointer hover:text-white focus-visible:text-white transition-colors pointer-events-auto"
              onClick={() => selectBody(planetObj.id)}
            >
              {planetObj.name}
            </button>
          </Html>
        ) : null}
      </group>

      {/* Moons outside rotation group — orbit is not affected by axial tilt */}
      {planetObj.children.map((moon) => (
        <Moon
          key={`${starObj.id}-${planetObj.id}-${moon.id}`}
          moonObj={moon}
          planetObj={planetObj}
        />
      ))}
    </group>
  );
}
