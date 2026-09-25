import { createContext } from "react";
import { CelestialBody } from "../data";
import { MissionConfig } from "../config/missions";
import { ArtemisPoint } from "../services/artemisLive";
import { EphemerisPoint } from "../services/horizons";

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
  earthOverride: EphemerisPoint | null;
  moonOverride: EphemerisPoint | null;
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
  earthOverride: null,
  moonOverride: null,
  cameraTarget: null,
  setCameraTarget: () => {},
  orionEnhanced: false,
  setOrionEnhanced: () => {},
  cameraLocked: null,
  setCameraLocked: () => {},
});
