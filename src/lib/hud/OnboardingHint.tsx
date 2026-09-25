import { useEffect, useState } from "react";

const STORAGE_KEY = "universe-map:hint-seen";
const AUTO_HIDE_MS = 12000;

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private mode or blocked storage: the hint just shows again next time
  }
}

/** How to move around — shown on the first visit, gone at the first interaction */
export default function OnboardingHint({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(() => !alreadySeen());

  useEffect(() => {
    if (!visible || !ready) return;
    const hide = () => {
      setVisible(false);
      markSeen();
    };
    const timer = window.setTimeout(hide, AUTO_HIDE_MS);
    // Ignore the click that may still be in flight from the loading screen
    const armTimer = window.setTimeout(() => window.addEventListener("pointerdown", hide, { once: true }), 800);
    return () => {
      clearTimeout(timer);
      clearTimeout(armTimer);
      window.removeEventListener("pointerdown", hide);
    };
  }, [visible, ready]);

  if (!visible || !ready) return null;

  return (
    <div
      role="status"
      className="fixed z-[999999999] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-24 px-4 py-2.5 rounded-lg bg-black/70 bg-blur-custom border border-white/10 text-[12px] leading-5 text-white/85 font-mono text-center max-w-[min(92vw,440px)] pointer-events-none onboarding-fade"
    >
      <span className="hidden sm:inline">Drag to rotate · Scroll to zoom · Click a planet · Double-click to fly there</span>
      <span className="sm:hidden">Drag to rotate · Pinch to zoom · Tap a planet</span>
    </div>
  );
}
