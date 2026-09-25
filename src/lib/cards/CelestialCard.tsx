import { useState, useEffect } from "react";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";
import Breadcrumb from "./Breadcrumb";
import ExploreTab from "./ExploreTab";
import { findPathToBody, getBodyAtPath, getBreadcrumb } from "./bodyTree";

interface CelestialCardProps {
  root: CelestialBody;
  open: boolean;
  onToggle: () => void;
  navigateToId?: number | null;
}

export default function CelestialCard({ root, open, onToggle, navigateToId }: CelestialCardProps) {
  const [path, setPath] = useState<number[]>([]);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPath, setDisplayPath] = useState<number[]>([]);

  // Navigate to a specific body when navigateToId is set
  useEffect(() => {
    if (navigateToId == null) return;
    const targetPath = findPathToBody(root, navigateToId);
    if (targetPath) {
      setPath(targetPath);
      setDisplayPath(targetPath);
    }
  }, [navigateToId, root]);

  const body = getBodyAtPath(root, displayPath);
  const breadcrumb = getBreadcrumb(root, displayPath);

  useEffect(() => {
    if (JSON.stringify(path) === JSON.stringify(displayPath)) return;
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayPath(path);
      setIsTransitioning(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [path, displayPath]);

  const navigateTo = (newPath: number[]) => {
    if (newPath.length > displayPath.length) {
      setDirection("left");
    } else {
      setDirection("right");
    }
    setPath(newPath);
  };

  const handleSelectChild = (index: number) => {
    navigateTo([...displayPath, index]);
  };

  const slideClass = isTransitioning
    ? direction === "left"
      ? "-translate-x-full opacity-0"
      : "translate-x-full opacity-0"
    : "translate-x-0 opacity-100";

  return (
    <div
      className={`fixed z-[999999999] sm:block hidden duration-500 top-0 right-0 h-screen ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div
        className="h-full w-[380px] bg-[#000000b3] bg-blur-custom p-6 overflow-y-auto custom-scrollbar text-white"
        inert={!open}
      >
        <Breadcrumb crumbs={breadcrumb} onNavigate={navigateTo} />

        {/* Content with transitions */}
        <div className="overflow-hidden">
          <div className={`transition-all duration-300 ease-in-out ${slideClass}`}>
            <CelestialDetail
              body={body}
              onSelectChild={handleSelectChild}
              onGoBack={
                displayPath.length > 0
                  ? () => navigateTo(displayPath.slice(0, -1))
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Toggle tab */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full">
        {open ? (
          <button
            type="button"
            aria-label="Close explore panel"
            className="bg-[#000000b3] bg-blur-custom text-white text-[11px] uppercase tracking-[2px] py-3 px-2 rounded-l-lg writing-vertical hover:bg-[#ffffff25] transition-colors border border-r-0 border-[#ffffff15] cursor-pointer"
            onClick={onToggle}
          >
            ✕
          </button>
        ) : (
          <ExploreTab onClick={onToggle} />
        )}
      </div>
    </div>
  );
}
