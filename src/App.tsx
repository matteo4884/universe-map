import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitControls } from "@react-three/drei";
import { useState, useContext, useRef } from "react";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import CameraFly from "./lib/camera/CameraFly";
import { CELESTIAL_BODIES } from "./data";
import { ScaleEarthUnitSize } from "./helper/units";
import StarField from "./lib/starfield/Starfield";
import Star from "./lib/stars/Star";
import { StarParam } from "./data";
import Card from "./lib/cards/Card";
import { ScaleDistanceScaleContext } from "./context/contexts";

const BACKGROUND_COLOR = new THREE.Color(0, 0, 0);

function App() {
  const contextScaleDistance = useContext(ScaleDistanceScaleContext);
  if (!contextScaleDistance)
    throw new Error(
      "MyComponent must be used within ScaleDistanceScaleProvider"
    );
  const { scaleDistance, setScaleDistance } = contextScaleDistance;

  const [visible, setVisible] = useState(true);
  const [info] = useState<StarParam | null>(CELESTIAL_BODIES[0] ?? null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const stars = CELESTIAL_BODIES.map((star) => (
    <Star
      map="g"
      position={[0, 0, 0]}
      size={ScaleEarthUnitSize({ size: star.radius })}
      key={star.id}
      starObj={star}
      visible={visible}
      setVisible={setVisible}
    />
  ));

  return (
    <div className="noselect">
      <div id="canvas-container" className="w-screen h-screen">
        <Canvas
          gl={{ logarithmicDepthBuffer: true }}
          fallback={<div>Sorry no WebGL supported!</div>}
          // camera={{ fov: 75, position: [-378, 103, -153], far: 5000000000 }}
          camera={{
            fov: 50,
            position: [
              -ScaleEarthUnitSize({ size: 696340 }) * 2,
              0,
              -ScaleEarthUnitSize({ size: 696340 }),
            ],
            far: 5000000000,
          }}
          scene={{ background: BACKGROUND_COLOR }}
          // events={eventManagerFactory}
          onCreated={() => {
            console.log("Canvas created!");
            // puoi usare scene, gl, camera qui
          }}
        >
          {stars}

          <StarField />
          <ambientLight intensity={0} />
          <EffectComposer>
            <Bloom
              intensity={2.5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
          <OrbitControls
            ref={controlsRef}
            target={[-100, 0, 550]}
            rotateSpeed={0.6}
            panSpeed={0.6}
            zoomSpeed={1.5}
            maxDistance={3000000000}
          />
          <CameraFly controlsRef={controlsRef} />
          {/* <gridHelper args={[500, 250]} ref={gridRef} /> */}
          {/* <axesHelper args={[5]} /> */}
        </Canvas>
      </div>
      <div className="fixed lg:top-4 top-2 pr-2 lg:pr-0 left-0 text-[#fff] w-screen text-right lg:text-center z-[999999999]">
        <div>Universe Map</div>
        <div className="text-[10px] opacity-50 mt-1">(Work in progress)</div>
      </div>
      <div className="fixed z-[999999999] p-1 px-2 rounded-br-md bg-[#00000065] top-0 left-0 text-[#fff] text-[11px] bg-blur-custom">
        <div>
          Scale distance:{" "}
          {scaleDistance === 1 ? "Real" : `1 : ${scaleDistance}`}{" "}
        </div>
        <div>
          <input
            onChange={(e) => {
              setScaleDistance(Number(e.target.value));
            }}
            type="range"
            id="scale-distance"
            name="scale-distance"
            min="1"
            max="1000"
            value={scaleDistance}
            className="custom-range mb-2 mt-2 bg-[#fff]"
          />
        </div>
        {/* <div>Scale size: 1 : {SCALE_SIZE}</div> */}
      </div>
      <Card visible={visible} info={info} />
      <div className="fixed z-[999999999] p-1 px-2 rounded-tr-md bg-[#00000065] bottom-0 left-0 text-[#fff] text-[11px] bg-blur-custom">
        Developed with ❤︎ by{" "}
        <a href="https://matteobeu.com" target="_blank" className="underline">
          Matteo Beu
        </a>
      </div>
    </div>
  );
}

export default App;
