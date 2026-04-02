import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { TrackballControls } from '@react-three/drei';
import { useState, useRef } from 'react';
import { TrackballControls as TrackballControlsImpl } from 'three-stdlib';
import CameraFly from './lib/camera/CameraFly';
import { CELESTIAL_BODIES, SOLAR_SYSTEM } from './data';
import StarField from './lib/starfield/Starfield';
import Star from './lib/stars/Star';
import CelestialCard from './lib/cards/CelestialCard';
import MobileSheet from './lib/cards/MobileSheet';
import { useEphemeris } from './hooks/useEphemeris';
import { EphemerisContext } from './context/ephemeris';
import LoadingScreen from './lib/LoadingScreen';
import SettingsPanel from './lib/settings/SettingsPanel';
import { blendPosition } from './helper/units';

const BACKGROUND_COLOR = new THREE.Color(0, 0, 0);

// Initial camera: midway between Top (0,0,Z+) and Front (0,Y+,0)
const NEPTUNE_DIST_KM = 4495000000;
const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, 0);
const viewDist = Math.abs(nx) * 1.4;
const MID_ANGLE = Math.PI / 4;
const INITIAL_CAMERA: [number, number, number] = [
  0,
  viewDist * Math.sin(MID_ANGLE),
  viewDist * Math.cos(MID_ANGLE),
];

function App() {
  const [visible, setVisible] = useState(true);
  const controlsRef = useRef<TrackballControlsImpl>(null);
  const ephemeris = useEphemeris();
  const [showOrbits, setShowOrbits] = useState(true);

  const stars = CELESTIAL_BODIES.map((star) => (
    <Star
      map="g"
      position={[0, 0, 0]}
      starObj={star}
      visible={visible}
      setVisible={setVisible}
      showOrbits={showOrbits}
      key={star.id}
    />
  ));

  return (
    <EphemerisContext.Provider value={ephemeris}>
      <LoadingScreen loading={ephemeris.loading} error={ephemeris.error} />
      <div className="noselect">
        <div id="canvas-container" className="w-screen h-screen">
          {!ephemeris.loading && (
            <Canvas
              gl={{ logarithmicDepthBuffer: true }}
              fallback={<div>Sorry no WebGL supported!</div>}
              camera={{
                fov: 50,
                position: INITIAL_CAMERA,
                up: [0, 0, 1],
                far: 5000000000,
              }}
              scene={{ background: BACKGROUND_COLOR }}
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
              <TrackballControls
                ref={controlsRef}
                rotateSpeed={2}
                panSpeed={0.6}
                zoomSpeed={1.5}
                maxDistance={3000000000}
              />
              <CameraFly controlsRef={controlsRef} />
            </Canvas>
          )}
        </div>
        <div className="fixed lg:top-4 top-2 pr-2 lg:pr-0 left-0 text-[#fff] w-screen text-right lg:text-center z-[999999999]">
          <div>Universe Map</div>
          <div className="text-[10px] opacity-50 mt-1">(Work in progress)</div>
        </div>
        <SettingsPanel showOrbits={showOrbits} setShowOrbits={setShowOrbits} />
        <CelestialCard root={SOLAR_SYSTEM} visible={visible} />
        <MobileSheet root={SOLAR_SYSTEM} visible={visible} />
        <div className="fixed z-[999999999] p-1 px-2 rounded-tr-md bg-[#00000065] bottom-0 left-0 text-[#fff] text-[11px] bg-blur-custom">
          Developed with ❤︎ by{' '}
          <a href="https://matteobeu.com" target="_blank" className="underline">
            Matteo Beu
          </a>
        </div>
      </div>
    </EphemerisContext.Provider>
  );
}

export default App;
