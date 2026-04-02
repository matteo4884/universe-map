import { useState, useEffect } from "react";

interface LoadingScreenProps {
  loading: boolean;
  error: boolean;
}

export default function LoadingScreen({ loading, error }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (error) {
        setShowOffline(true);
        setTimeout(() => setShowOffline(false), 3000);
      }
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, error]);

  if (!visible && !showOffline) return null;

  return (
    <>
      {visible && (
        <div
          className={`fixed inset-0 z-[9999999999] bg-black flex items-center justify-center transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="text-center text-white">
            <div className="text-lg font-light tracking-[4px] uppercase loading-pulse">
              Loading Solar System
            </div>
            <div className="text-[10px] text-[#666] mt-3 tracking-[2px] uppercase">
              Fetching data from NASA JPL
            </div>
          </div>
        </div>
      )}
      {showOffline && !visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999999999] bg-[#000000b3] bg-blur-custom text-[#888] text-[11px] px-4 py-2 rounded-lg uppercase tracking-wider">
          Using offline data
        </div>
      )}
    </>
  );
}
