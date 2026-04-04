import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { TrackballControls } from '@react-three/drei';
import { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { CameraNavigationContext } from './context/cameraNavigation';
import { TrackballControls as TrackballControlsImpl } from 'three-stdlib';
import CameraFly from './lib/camera/CameraFly';
import { CELESTIAL_BODIES, MILKY_WAY } from './data';
import MilkyWay from './lib/galaxy/MilkyWay';
import Star from './lib/stars/Star';
import CelestialCard from './lib/cards/CelestialCard';
import MobileSheet from './lib/cards/MobileSheet';
import { useEphemeris } from './hooks/useEphemeris';
import { EphemerisContext } from './context/ephemeris';
import LoadingScreen from './lib/LoadingScreen';
import NormalHUD from './lib/hud/NormalHUD';
import { blendPosition } from './helper/units';
import { ArtemisModeProvider, ArtemisModeContext } from './context/artemisMode';
import { ScaleContext } from './context/contexts';
import ArtemisButton from './lib/artemis/ArtemisButton';
import ArtemisHUD from './lib/artemis/ArtemisHUD';
import OrionSpacecraft from './lib/artemis/OrionSpacecraft';

const BACKGROUND_COLOR = new THREE.Color(0, 0, 0);

const NEPTUNE_DIST_KM = 4495000000;
const [nx] = blendPosition(NEPTUNE_DIST_KM, 0, 0, 0);
const viewDist = Math.abs(nx) * 1.4;
const MID_ANGLE = Math.PI / 4;
const INITIAL_CAMERA: [number, number, number] = [
  0,
  viewDist * Math.sin(MID_ANGLE),
  viewDist * Math.cos(MID_ANGLE),
];

function ArtemisAwareUI({
  showOrbits,
  setShowOrbits,
  visible,
}: {
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  visible: boolean;
}) {
  const { active, position } = useContext(ArtemisModeContext);
  const scaleCtx = useContext(ScaleContext);
  const cameraNav = useContext(CameraNavigationContext);
  const prevActive = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      // Entering Artemis — show overlay, instant blend
      setTransitioning(true);
      setFadeOut(false);
      scaleCtx?.setBlendInstant(1);
      scaleCtx?.setRealisticMode(true);
      setShowOrbits(false);
    } else if (!active && prevActive.current) {
      // Exiting Artemis — show overlay, instant blend back
      setTransitioning(true);
      setFadeOut(false);
      setTimeout(() => {
        scaleCtx?.setBlendInstant(0);
        scaleCtx?.setRealisticMode(false);
        setShowOrbits(true);
        cameraNav?.setViewSnap("home");
        setFadeOut(true);
      }, 300);
      setTimeout(() => setTransitioning(false), 800);
    }
    prevActive.current = active;
  }, [active]);

  // Fade out overlay once Artemis data arrives + camera fly-to completes
  useEffect(() => {
    if (transitioning && active && position) {
      // Data arrived — wait for camera fly-to to finish (~3s), then fade out
      setTimeout(() => setFadeOut(true), 3000);
      setTimeout(() => setTransitioning(false), 3500);
    }
  }, [transitioning, active, position]);

  return (
    <>
      {/* Transition overlay */}
      {transitioning && (
        <div
          className={`fixed inset-0 z-[99999999999] bg-black flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {active && (
            <div className="text-center font-mono">
              <div className="text-[9px] tracking-[4px] text-[#ff9500] uppercase mb-2">
                Entering Mission
              </div>
              <div className="text-xl font-bold tracking-[4px] text-white loading-pulse">
                ARTEMIS II
              </div>
            </div>
          )}
        </div>
      )}

      {!active && (
        <NormalHUD
          showOrbits={showOrbits}
          setShowOrbits={setShowOrbits}
          onToggleExplore={() => setExploreOpen((prev) => !prev)}
          exploreOpen={exploreOpen}
        />
      )}
      {!active && (
        <CelestialCard
          root={MILKY_WAY}
          visible={visible}
          externalOpen={exploreOpen}
          onExternalToggle={() => setExploreOpen((prev) => !prev)}
        />
      )}
      {!active && <MobileSheet root={MILKY_WAY} visible={visible} />}
      <ArtemisButton />
      <ArtemisHUD />
    </>
  );
}

/** Merges live Artemis Earth/Moon positions into ephemeris when Artemis mode is active */
function useArtemisEphemeris(ephemeris: ReturnType<typeof useEphemeris>) {
  const { active, earthOverride, moonOverride } = useContext(ArtemisModeContext);

  return useMemo(() => {
    if (!active || !earthOverride || !moonOverride || !ephemeris.positions) {
      return ephemeris;
    }
    return {
      ...ephemeris,
      positions: {
        ...ephemeris.positions,
        "399": earthOverride,
        "301": moonOverride,
      },
    };
  }, [active, earthOverride, moonOverride, ephemeris]);
}

function AppInner() {
  const [visible, setVisible] = useState(true);
  const controlsRef = useRef<TrackballControlsImpl>(null);
  const ephemeris = useEphemeris();
  const mergedEphemeris = useArtemisEphemeris(ephemeris);
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
    <EphemerisContext.Provider value={mergedEphemeris}>
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
                near: 0.0000001,
                far: 500000000000,
              }}
              scene={{ background: BACKGROUND_COLOR }}
            >
              {stars}
              <MilkyWay />
              <OrionSpacecraft />
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
                maxDistance={300000000000}
              />
              <CameraFly controlsRef={controlsRef} />
            </Canvas>
          )}
        </div>
        <ArtemisAwareUI showOrbits={showOrbits} setShowOrbits={setShowOrbits} visible={visible} />
      </div>
    </EphemerisContext.Provider>
  );
}

function App() {
  return (
    <ArtemisModeProvider>
      <AppInner />
    </ArtemisModeProvider>
  );
}

export default App;
