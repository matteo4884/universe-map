import { useState, useRef, useEffect } from "react";
import { MdArrowForwardIos } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";

interface CelestialCardProps {
  root: CelestialBody;
  visible: boolean;
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

export default function CelestialCard({ root, visible }: CelestialCardProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<number[]>([]);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPath, setDisplayPath] = useState<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

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
  }, [path]);

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
          visible && open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full w-[380px] bg-[#0a0a0fdd] bg-blur-custom p-6 overflow-y-auto text-white">
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
              />
            </div>
          </div>
        </div>

        {/* Toggle button */}
        {visible && (
          <div className="absolute h-full flex items-center left-0 top-0 -translate-x-full text-white">
            <div
              className={`p-2 bg-[#ffffff33] mr-2 duration-150 rounded-full cursor-pointer hover:bg-[#ffffff67] ${
                open ? "rotate-0" : "rotate-180"
              }`}
              onClick={() => setOpen((prev) => !prev)}
            >
              <MdArrowForwardIos />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
