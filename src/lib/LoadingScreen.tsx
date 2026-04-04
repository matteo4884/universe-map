import { useState, useEffect } from "react";
import { useProgress } from "@react-three/drei";

interface LoadingScreenProps {
  loading: boolean;
  error: boolean;
}

export default function LoadingScreen({ loading, error }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const { progress, active: assetsLoading } = useProgress();
  const [assetsStarted, setAssetsStarted] = useState(false);

  // Track that Three.js has started loading at least once
  useEffect(() => {
    if (assetsLoading) setAssetsStarted(true);
  }, [assetsLoading]);

  // Ready when: ephemeris loaded AND (assets finished loading OR never started after a grace period)
  const allReady = !loading && assetsStarted && !assetsLoading && progress === 100;

  useEffect(() => {
    if (allReady) {
      if (error) {
        setShowOffline(true);
        setTimeout(() => setShowOffline(false), 3000);
      }
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [allReady, error]);

  if (!visible && !showOffline) return null;

  return (
    <>
      {visible && (
        <div
          className={`fixed inset-0 z-[9999999999] bg-black flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="text-center text-white font-mono">
            {/* Orbit animation */}
            <div className="relative w-20 h-20 mx-auto mb-8">
              {/* Outer ring */}
              <div
                className="absolute inset-0 rounded-full border border-[rgba(255,255,255,0.08)]"
              />
              {/* Orbiting dot */}
              <div
                className="absolute inset-0"
                style={{ animation: "orbit-spin 3s linear infinite" }}
              >
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                />
              </div>
              {/* Inner ring */}
              <div
                className="absolute inset-4 rounded-full border border-[rgba(255,255,255,0.05)]"
              />
              {/* Second orbiting dot */}
              <div
                className="absolute inset-4"
                style={{ animation: "orbit-spin 2s linear infinite reverse" }}
              >
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#4a90d9] shadow-[0_0_6px_rgba(74,144,217,0.6)]"
                />
              </div>
              {/* Center dot (sun) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#ff9500] shadow-[0_0_10px_rgba(255,150,0,0.5)]" />
              </div>
            </div>

            <div className="text-[11px] tracking-[6px] uppercase font-light opacity-80 mb-3">
              Universe Map
            </div>
            <div className="text-[9px] tracking-[3px] uppercase text-[rgba(255,255,255,0.3)] loading-pulse">
              Loading Solar System
            </div>
          </div>

          <style>{`
            @keyframes orbit-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {showOffline && !visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999999999] bg-[#000000b3] bg-blur-custom text-[#888] text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider font-mono">
          Using offline data
        </div>
      )}
    </>
  );
}
