import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useState, useRef, useContext, useEffect, useMemo, useCallback } from 'react';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import CameraRig, { DEFAULT_MAX_DISTANCE } from './lib/camera/CameraRig';
import MilkyWay from './lib/galaxy/MilkyWay';
import Sun from './lib/bodies/Sun';
import Body from './lib/bodies/Body';
import Orbits from './lib/bodies/Orbits';
import AsteroidBelt from './lib/bodies/AsteroidBelt';
import CelestialCard from './lib/cards/CelestialCard';
import MobileSheet from './lib/cards/MobileSheet';
import { useEphemeris } from './hooks/useEphemeris';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import LoadingScreen from './lib/LoadingScreen';
import NormalHUD from './lib/hud/NormalHUD';
import TimeBar from './lib/hud/TimeBar';
import OnboardingHint from './lib/hud/OnboardingHint';
import LabelProjector from './lib/overlay/LabelProjector';
import SceneOverlay from './lib/overlay/SceneOverlay';
import { homeOffset } from './helper/views';
import { isWebGLAvailable } from './helper/webgl';
import { SCENE_BODIES, SUN } from './helper/bodies';
import { ArtemisModeProvider } from './context/artemisMode';
import {
  ScaleContext,
  CameraNavigationContext,
  ArtemisModeContext,
  EphemerisContext,
  TimeContext,
  LayersContext,
} from './context/contexts';
import ArtemisButton from './lib/artemis/ArtemisButton';
import ArtemisHUD from './lib/artemis/ArtemisHUD';
import OrionSpacecraft from './lib/artemis/OrionSpacecraft';
import { SceneErrorBoundary, SceneErrorScreen } from './lib/SceneError';

const BACKGROUND_COLOR = new THREE.Color(0, 0, 0);

const INITIAL_CAMERA = homeOffset(0, window.innerWidth / window.innerHeight);

// Beyond this distance the camera is in the galaxy view: hide the Solar System
const SOLAR_SYSTEM_MAX_VIEW = 10000000;

// Spheres rendered by <Body>: planets, dwarf planets and moons (spacecraft are markers, the belt is points)
const SPHERE_BODIES = SCENE_BODIES.filter((b) => b.type === "planet" || b.type === "moon");

/** Freezes the simulated time at the start of every frame */
function SimClock() {
  const time = useContext(TimeContext);
  useFrame(() => time?.tick(), -10);
  return null;
}

function SolarSystemVisibility({ onChange }: { onChange: (visible: boolean) => void }) {
  const visible = useRef(true);
  useFrame(({ camera }) => {
    const next = camera.position.length() < SOLAR_SYSTEM_MAX_VIEW;
    if (next !== visible.current) {
      visible.current = next;
      onChange(next);
    }
  });
  return null;
}

function ArtemisAwareUI({
  infoOpen,
  setInfoOpen,
}: {
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
}) {
  const { active, hasPosition, mission } = useContext(ArtemisModeContext);
  const scaleCtx = useContext(ScaleContext);
  const cameraNav = useContext(CameraNavigationContext);
  const time = useContext(TimeContext);
  const prevActive = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      // Entering the mission — live time, realistic scale, overlay while the camera flies
      setTransitioning(true);
      setFadeOut(false);
      time?.goLive();
      scaleCtx?.setBlendInstant(1);
      scaleCtx?.setRealisticMode(true);
    } else if (!active && prevActive.current) {
      // Exiting — overlay, instant blend back
      setTransitioning(true);
      setFadeOut(false);
      const switchTimer = window.setTimeout(() => {
        scaleCtx?.setBlendInstant(0);
        scaleCtx?.setRealisticMode(false);
        cameraNav?.setViewSnap("home");
        setFadeOut(true);
      }, 300);
      const hideTimer = window.setTimeout(() => setTransitioning(false), 800);
      prevActive.current = active;
      return () => {
        clearTimeout(switchTimer);
        clearTimeout(hideTimer);
      };
    }
    prevActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to mode switches only
  }, [active]);

  // Fade out overlay once mission data arrives + camera fly-to completes
  useEffect(() => {
    if (!transitioning || !active || !hasPosition) return;
    const fadeTimer = window.setTimeout(() => setFadeOut(true), 3000);
    const hideTimer = window.setTimeout(() => setTransitioning(false), 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [transitioning, active, hasPosition]);

  return (
    <>
      {transitioning && (
        <div
          className={`fixed inset-0 z-[99999999999] bg-black flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {active && mission && (
            <div className="text-center font-mono">
              <div className="text-[10px] tracking-[4px] text-[#ff9500] uppercase mb-2">Entering Mission</div>
              <div className="text-xl font-bold tracking-[4px] text-white loading-pulse">{mission.name}</div>
            </div>
          )}
        </div>
      )}

      {!active && <NormalHUD infoOpen={infoOpen} setInfoOpen={setInfoOpen} />}
      {!active && <CelestialCard />}
      {!active && <MobileSheet />}
      {!active && <TimeBar />}
      <ArtemisButton />
      <ArtemisHUD />
    </>
  );
}

function AppInner() {
  const [solarSystemVisible, setSolarSystemVisible] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const ephemeris = useEphemeris();
  const { active: artemisActive } = useContext(ArtemisModeContext);
  const { layers } = useContext(LayersContext);
  const [infoOpen, setInfoOpen] = useState(false);
  const webglAvailable = useMemo(isWebGLAvailable, []);
  const [sceneFailed, setSceneFailed] = useState(false);
  const handleSceneError = useCallback(() => setSceneFailed(true), []);

  useKeyboardShortcuts({ enabled: !artemisActive, modalOpen: infoOpen });

  if (!webglAvailable || sceneFailed) {
    return <SceneErrorScreen webgl={webglAvailable} />;
  }

  return (
    <EphemerisContext.Provider value={ephemeris}>
      <LoadingScreen loading={ephemeris.loading} error={ephemeris.error} />
      <div className="noselect">
        <div id="canvas-container" className="w-screen h-screen">
          {!ephemeris.loading && (
            <SceneErrorBoundary onError={handleSceneError}>
              <Canvas
                gl={{ logarithmicDepthBuffer: true }}
                camera={{
                  fov: 50,
                  position: INITIAL_CAMERA,
                  up: [0, 0, 1],
                  near: 0.0000001,
                  far: 500000000000,
                }}
                scene={{ background: BACKGROUND_COLOR }}
              >
                <SimClock />
                <group visible={solarSystemVisible}>
                  <Sun body={SUN} />
                  {SPHERE_BODIES.map((body) => (
                    <Body key={body.id} body={body} />
                  ))}
                  <Orbits />
                  {layers.belt && !artemisActive && <AsteroidBelt />}
                </group>
                <MilkyWay />
                <OrionSpacecraft />
                <ambientLight intensity={0} />
                <EffectComposer>
                  <Bloom intensity={2.5} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
                </EffectComposer>
                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  enableDamping
                  dampingFactor={0.08}
                  rotateSpeed={0.6}
                  zoomSpeed={1.2}
                  panSpeed={0.8}
                  screenSpacePanning
                  maxDistance={DEFAULT_MAX_DISTANCE}
                />
                <CameraRig controlsRef={controlsRef} />
                <LabelProjector solarSystemVisible={solarSystemVisible} />
                <SolarSystemVisibility onChange={setSolarSystemVisible} />
              </Canvas>
            </SceneErrorBoundary>
          )}
        </div>
        <SceneOverlay />
        <OnboardingHint ready={!ephemeris.loading && !artemisActive} />
        <ArtemisAwareUI infoOpen={infoOpen} setInfoOpen={setInfoOpen} />
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
