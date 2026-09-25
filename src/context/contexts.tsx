import { createContext } from "react";
import { CelestialBody } from "../data";
import { MissionConfig } from "../config/missions";
import { ArtemisPoint } from "../services/artemisLive";
import { Ephemeris } from "../helper/ephemeris";

export type ScaleContextType = {
  realisticMode: boolean;
  setRealisticMode: (value: boolean) => void;
  /** 0 = log (easy), 1 = realistic — animated. Read it in useFrame, it never triggers a render */
  blendRef: React.RefObject<number>;
  setBlendInstant: (value: number) => void; // skip animation, set blend directly
};

export const ScaleContext = createContext<ScaleContextType | undefined>(
  undefined
);

export type TimeContextType = {
  /** Simulated time (ms since Unix epoch), the same for everything drawn in a frame */
  getTime: () => number;
  /** Freeze the time for the frame about to be drawn (called by <SimClock> first thing each frame) */
  tick: () => void;
  /** Simulated seconds per real second (1 = real time, negative = backwards) */
  rate: number;
  paused: boolean;
  /** Following the real clock (rate 1 from "now") */
  live: boolean;
  setRate: (rate: number) => void;
  setPaused: (paused: boolean) => void;
  setTime: (ms: number) => void;
  goLive: () => void;
};

export const TimeContext = createContext<TimeContextType | undefined>(undefined);

export type EphemerisContextType = {
  ephemeris: Ephemeris | null;
  loading: boolean;
  error: boolean;
};

export const EphemerisContext = createContext<EphemerisContextType>({
  ephemeris: null,
  loading: true,
  error: false,
});

export type Layer = "orbits" | "spacecraft" | "belt" | "labels";

export type LayersContextType = {
  /** What's drawn in the scene, toggled from the "Show" filters */
  layers: Record<Layer, boolean>;
  setLayer: (layer: Layer, visible: boolean) => void;
};

export const LayersContext = createContext<LayersContextType>({
  layers: { orbits: true, spacecraft: true, belt: true, labels: true },
  setLayer: () => {},
});

export type ViewDirection = "top" | "front" | "home" | "milkyway" | null;

export type CameraNavigationContextType = {
  flyTo: CelestialBody | null;
  setFlyTo: (body: CelestialBody | null) => void;
  viewSnap: ViewDirection;
  setViewSnap: (dir: ViewDirection) => void;
};

export const CameraNavigationContext = createContext<
  CameraNavigationContextType | undefined
>(undefined);

export type SelectOptions = {
  /** Also fly the camera to the body */
  fly?: boolean;
  /** Open the explore panel (default true) */
  openPanel?: boolean;
};

export type SelectionContextType = {
  /** Selected body, reflected in the URL (?body=…); null = nothing selected */
  selected: CelestialBody | null;
  select: (body: CelestialBody | null, options?: SelectOptions) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

export const SelectionContext = createContext<SelectionContextType>({
  selected: null,
  select: () => {},
  panelOpen: false,
  setPanelOpen: () => {},
});

export interface Telemetry {
  distEarth: number;
  distMoon: number;
  velocity: number;
  altitude: number;
  met: number;
  phase: string;
}

export type ArtemisCameraTarget = "orion" | "earth" | "moon" | null;

export interface ArtemisModeContextType {
  mission: MissionConfig | null;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
  /** True once the first live data has arrived */
  hasPosition: boolean;
  /** Spacecraft position interpolated for the current instant — call it in useFrame */
  getSpacecraftPosition: () => ArtemisPoint | null;
  telemetry: Telemetry | null;
  fetchedAt: string | null;
  dataOnline: boolean;
  cameraTarget: ArtemisCameraTarget;
  setCameraTarget: (target: ArtemisCameraTarget) => void;
  orionEnhanced: boolean;
  setOrionEnhanced: (v: boolean) => void;
  cameraLocked: ArtemisCameraTarget;
  setCameraLocked: (body: ArtemisCameraTarget) => void;
}

export const ArtemisModeContext = createContext<ArtemisModeContextType>({
  mission: null,
  active: false,
  activate: () => {},
  deactivate: () => {},
  hasPosition: false,
  getSpacecraftPosition: () => null,
  telemetry: null,
  fetchedAt: null,
  dataOnline: false,
  cameraTarget: null,
  setCameraTarget: () => {},
  orionEnhanced: false,
  setOrionEnhanced: () => {},
  cameraLocked: null,
  setCameraLocked: () => {},
});
