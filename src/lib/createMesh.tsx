import * as THREE from "three";
import Earth from "./planets/Earth";
import Mars from "./planets/Mars";
import Sun from "./stars/Sun";
import Mercury from "./planets/Mercury";

interface CreateMeshProps {
  type: string;
  name: string;
  position: THREE.Vector3 | [x: number, y: number, z: number];
  size: number;
}

export default function CreateMesh({
  type,
  name,
  position,
  size,
}: CreateMeshProps) {
  if (type === "star") {
    if (name === "sun") {
      return <Sun size={size} position={position} />;
    } else {
      return (
        <group position={position}>
          <mesh>
            <sphereGeometry args={[size, 64, 64]} />
            <meshBasicMaterial color={new THREE.Color().setRGB(1, 1, 1)} />
          </mesh>
          <pointLight intensity={100} distance={100} decay={1} />
        </group>
      );
    }
  } else if (type === "planet") {
    if (name === "earth") {
      return <Earth size={size} position={position} />;
    } else if (name === "mars") {
      return <Mars size={size} position={position} />;
    } else if (name === "mercury") {
      return <Mercury size={size} position={position} />;
    }
  }
}
