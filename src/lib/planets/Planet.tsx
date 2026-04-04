import { useState, useContext, useRef, useMemo, useEffect } from "react";
import { ScaleContext } from "../../context/contexts";
import { EphemerisContext } from "../../context/ephemeris";
import { ArtemisModeContext } from "../../context/artemisMode";
import { useLoader, useThree, useFrame } from "@react-three/fiber";
import { CelestialBody } from "../../data";
import { blendMoonPosition, blendRadius, KM_PER_UNIT, poleToQuaternion, getSpinAngle, getEarthSpinAngle } from "../../helper/units";
import Moon from "../moons/Moon";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { BodySelectionContext } from "../../context/bodySelection";

interface PlanetProps {
  map: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
  planetObj: CelestialBody;
  starObj: CelestialBody;
  solarSystemVisible: boolean;
}

export default function Planet({
  map,
  position,
  size,
  planetObj,
  starObj,
  solarSystemVisible,
}: PlanetProps) {
  const scaleCtx = useContext(ScaleContext);
  if (!scaleCtx) throw new Error("Must be within ScaleProvider");
  const { blend } = scaleCtx;
  const { positions } = useContext(EphemerisContext);
  const { active: artemisActive } = useContext(ArtemisModeContext);
  const { selectBody } = useContext(BodySelectionContext);
  const isEarth = map === "earth";
  const isSaturn = map === "saturn";

  const textureMap: Record<string, string> = {
    mercury: "2k_mercury.jpg",
    venus: "2k_venus_surface.jpg",
    earth: "2k_earth_daymap.jpg",
    mars: "2k_mars.jpg",
    jupiter: "2k_jupiter.jpg",
    saturn: "2k_saturn.jpg",
    uranus: "2k_uranus.jpg",
    neptune: "2k_neptune.jpg",
  };
  const texture = textureMap[map] ?? "2k_earth_daymap.jpg";

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

  const poleQuat = useMemo(() => {
    const { poleRA, poleDec } = planetObj.info;
    if (poleRA != null && poleDec != null) {
      return poleToQuaternion(poleRA, poleDec);
    }
    return new THREE.Quaternion();
  }, [planetObj.info.poleRA, planetObj.info.poleDec]);

  const ringGeo = useMemo(() => {
    if (!isSaturn) return null;
    const innerR = 1.28;
    const outerR = 2.41;
    const geo = new THREE.RingGeometry(innerR, outerR, 64);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      uv.setXY(i, (r - innerR) / (outerR - innerR), 0.5);
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

  const spinRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!spinRef.current) return;
    if (isEarth) {
      spinRef.current.rotation.y = getEarthSpinAngle(new Date());
    } else if (planetObj.info.spinW0 != null && planetObj.info.spinRate != null) {
      spinRef.current.rotation.y = getSpinAngle(
        planetObj.info.spinW0,
        planetObj.info.spinRate,
        new Date()
      );
    }
  });

  const moons = planetObj.children.map((moon) => {
    let moonPosition: [number, number, number];

    if (
      positions &&
      positions[moon.horizonsId] &&
      positions[planetObj.horizonsId]
    ) {
      const moonPos = positions[moon.horizonsId];
      const planetPos = positions[planetObj.horizonsId];
      // Relative position in km
      const relX = moonPos.x - planetPos.x;
      const relY = moonPos.y - planetPos.y;
      const relZ = moonPos.z - planetPos.z;
      moonPosition = blendMoonPosition(relX, relY, relZ, blend);
    } else {
      const offset =
        moon.distanceFromParent / KM_PER_UNIT +
        blendRadius(planetObj.radius, blend);
      moonPosition = [offset, offset, 0];
    }

    const moonSize = blendRadius(moon.radius, blend);

    return (
      <Moon
        position={moonPosition}
        size={moonSize}
        moonObj={moon}
        key={`${starObj.id}-${planetObj.id}-${moon.id}`}
      />
    );
  });

  const [visible, setVisible] = useState(false);
  const { camera } = useThree();
  const planetPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    planetPosRef.current.set(
      ...(position as [number, number, number])
    );
    const distance = camera.position.distanceTo(planetPosRef.current);
    const shouldBeVisible = distance > 100;
    if (shouldBeVisible !== visible) {
      setVisible(shouldBeVisible);
    }
  });

  return (
    <group position={position}>
      <group quaternion={poleQuat}>
        {ringGeo && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeo} scale={[size, size, size]}>
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
              <mesh geometry={sphereGeo} scale={[size, size, size]} onClick={() => selectBody(planetObj.id)}>
                <meshStandardMaterial
                  map={colorMap}
                  emissiveMap={nightMap}
                  emissiveIntensity={1.2}
                  emissive="#ffffff"
                />
              </mesh>
              <mesh geometry={cloudGeo} scale={[size + 0.002, size + 0.002, size + 0.002]}>
                <meshStandardMaterial
                  map={cloudMap}
                  transparent={true}
                  opacity={0.5}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ) : (
            <mesh geometry={sphereGeo} scale={[size, size, size]} onClick={() => selectBody(planetObj.id)}>
              <meshStandardMaterial map={colorMap} />
            </mesh>
          )}
        </group>
      </group>

      {solarSystemVisible && ((visible && !artemisActive) || (artemisActive && isEarth)) ? (
        <Html center className="noselect" position={[0, 0, size * 2.5]}>
          <div
            className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.6)] uppercase font-mono whitespace-nowrap cursor-pointer hover:text-white transition-colors pointer-events-auto"
            onClick={() => selectBody(planetObj.id)}
          >
            {planetObj.name}
          </div>
        </Html>
      ) : null}

      {/* Moons outside rotation group — orbit is not affected by axial tilt */}
      {moons}
    </group>
  );
}
