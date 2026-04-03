import { useState } from "react";
import { MdClose } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";

interface MobileSheetProps {
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

export default function MobileSheet({ root, visible }: MobileSheetProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<number[]>([]);

  const body = getBodyAtPath(root, path);
  const breadcrumb = getBreadcrumb(root, path);

  return (
    <>
      {/* Bottom tab */}
      {!open && (
        <div
          className="fixed z-[999999999] sm:hidden bottom-0 right-4 cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <div className="bg-[#000000b3] bg-blur-custom text-white text-[10px] uppercase tracking-[2px] px-4 py-2 rounded-t-lg border border-b-0 border-[#ffffff15] hover:bg-[#ffffff25] transition-colors">
            ☰ Milky Way
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
