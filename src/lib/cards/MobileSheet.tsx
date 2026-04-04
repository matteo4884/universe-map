import { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";
import { findPathToBody } from "../../context/bodySelection";

interface MobileSheetProps {
  root: CelestialBody;
  visible: boolean;
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

export default function MobileSheet({ root, visible: _visible, navigateToId }: MobileSheetProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<number[]>([]);

  // Navigate to a specific body when navigateToId is set
  useEffect(() => {
    if (navigateToId == null) return;
    const targetPath = findPathToBody(root, navigateToId);
    if (targetPath) {
      setPath(targetPath);
      setOpen(true);
    }
  }, [navigateToId, root]);

  const body = getBodyAtPath(root, path);
  const breadcrumb = getBreadcrumb(root, path);

  return (
    <>
      {/* Explore tab — same animated style as desktop */}
      {!open && (
        <div
          className="fixed z-[999999999] sm:hidden top-1/2 -translate-y-1/2 right-0 cursor-pointer"
          onClick={() => setOpen(true)}
        >
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

            {/* Button content */}
            <div className="relative bg-gradient-to-b from-[rgba(74,144,217,0.12)] to-[rgba(40,80,150,0.04)] text-white text-[10px] uppercase tracking-[2px] py-3 px-2 rounded-l-lg writing-vertical">
              <span className="relative z-10">☰ Explore</span>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[999999999] sm:hidden bg-[#00000080]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed z-[9999999999] sm:hidden bottom-0 left-0 right-0 bg-[#000000b3] bg-blur-custom rounded-t-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "70vh" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-[#ffffff30] rounded-full" />
        </div>

        {/* Close button */}
        <button
          className="absolute top-3 right-4 text-white opacity-60 hover:opacity-100"
          onClick={() => setOpen(false)}
        >
          <MdClose size={20} />
        </button>

        {/* Content */}
        <div className="px-5 pb-6 overflow-y-auto custom-scrollbar text-white" style={{ height: "calc(70vh - 48px)" }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 text-xs text-[#666] flex-wrap">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#444]">›</span>}
                <span
                  className={`cursor-pointer ${
                    i === breadcrumb.length - 1
                      ? "text-white font-semibold"
                      : ""
                  }`}
                  onClick={() => setPath(crumb.path)}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>

          <CelestialDetail
            body={body}
            onSelectChild={(index) => setPath([...path, index])}
            onGoBack={
              path.length > 0
                ? () => setPath(path.slice(0, -1))
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
