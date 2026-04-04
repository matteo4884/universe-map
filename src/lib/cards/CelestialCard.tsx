import { useState, useRef, useEffect } from "react";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";
import { findPathToBody } from "../../context/bodySelection";

interface CelestialCardProps {
  root: CelestialBody;
  visible: boolean;
  externalOpen?: boolean;
  onExternalToggle?: () => void;
  navigateToId?: number | null;
}

function getBodyAtPath(root: CelestialBody, path: number[]): CelestialBody {
  let current = root;
  for (const index of path) {
    current = current.children[index];
  }
  return current;
}

function getBreadcrumb(
  root: CelestialBody,
  path: number[]
): { name: string; path: number[] }[] {
  const crumbs: { name: string; path: number[] }[] = [
    { name: root.name, path: [] },
  ];
  let current = root;
  for (let i = 0; i < path.length; i++) {
    current = current.children[path[i]];
    crumbs.push({ name: current.name, path: path.slice(0, i + 1) });
  }
  return crumbs;
}

export default function CelestialCard({ root, visible: _visible, externalOpen, onExternalToggle, navigateToId }: CelestialCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const toggleOpen = () => {
    if (onExternalToggle) onExternalToggle();
    else setInternalOpen((prev) => !prev);
  };
  const [path, setPath] = useState<number[]>([]);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPath, setDisplayPath] = useState<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

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
    <>
      {/* Desktop card */}
      <div
        className={`fixed z-[999999999] sm:block hidden duration-500 top-0 right-0 h-screen ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full w-[380px] bg-[#000000b3] bg-blur-custom p-6 overflow-y-auto custom-scrollbar text-white">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 text-xs text-[#666] flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#444]">›</span>}
                <span
                  className={`cursor-pointer hover:text-white transition-colors ${
                    i === breadcrumb.length - 1
                      ? "text-white font-semibold"
                      : ""
                  }`}
                  onClick={() => navigateTo(crumb.path)}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>

          {/* Content with transitions */}
          <div className="overflow-hidden">
            <div
              ref={contentRef}
              className={`transition-all duration-300 ease-in-out ${slideClass}`}
            >
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
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full cursor-pointer"
          onClick={toggleOpen}
        >
          {open ? (
            <div className="bg-[#000000b3] bg-blur-custom text-white text-[11px] uppercase tracking-[2px] py-3 px-2 rounded-l-lg writing-vertical hover:bg-[#ffffff25] transition-colors border border-r-0 border-[#ffffff15]">
              ✕
            </div>
          ) : (
            <div className="relative">
              {/* Animated border glow */}
              <div className="absolute -inset-[1px] rounded-l-lg overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{ animation: "explore-border-spin 5s linear infinite" }}
                >
                  <div
                    className="w-[300%] h-[300%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      background: "conic-gradient(from 0deg, transparent 0%, #4a90d9 12%, #7bb8f5 20%, transparent 35%, transparent 50%, #4a90d9 62%, #6aacf0 70%, transparent 85%)",
                    }}
                  />
                </div>
                <div className="absolute inset-[1.5px] bg-[#060610] rounded-l-sm" />
              </div>

              {/* Falling star particles */}
              <div className="absolute inset-0 rounded-l-lg overflow-hidden pointer-events-none">
                <div className="explore-star" style={{ left: "30%", animationDelay: "0s", animationDuration: "2.0s" }} />
                <div className="explore-star" style={{ left: "60%", animationDelay: "0.8s", animationDuration: "1.7s" }} />
                <div className="explore-star" style={{ left: "45%", animationDelay: "1.5s", animationDuration: "2.3s" }} />
                <div className="explore-star" style={{ left: "20%", animationDelay: "2.2s", animationDuration: "1.9s" }} />
                <div className="explore-star" style={{ left: "70%", animationDelay: "0.4s", animationDuration: "2.5s" }} />
              </div>

              {/* Ambient side glow */}
              <div
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  right: "-40px",
                  width: "120px",
                  height: "200px",
                  background: "radial-gradient(ellipse at 100% 50%, rgba(74,144,217,0.15) 0%, rgba(74,144,217,0.05) 40%, transparent 70%)",
                }}
              />

              {/* Button content */}
              <div className="relative bg-gradient-to-b from-[rgba(74,144,217,0.12)] to-[rgba(40,80,150,0.04)] text-white text-[11px] uppercase tracking-[2px] py-3 px-2 rounded-l-lg writing-vertical">
                <span className="relative z-10">☰ Explore</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
