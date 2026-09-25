import { useState, useEffect } from "react";
import { MdClose } from "react-icons/md";
import { CelestialBody } from "../../data";
import CelestialDetail from "./CelestialDetail";
import Breadcrumb from "./Breadcrumb";
import ExploreTab from "./ExploreTab";
import { findPathToBody, getBodyAtPath, getBreadcrumb } from "./bodyTree";

interface MobileSheetProps {
  root: CelestialBody;
  navigateToId?: number | null;
}

export default function MobileSheet({ root, navigateToId }: MobileSheetProps) {
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
        <div className="fixed z-[999999999] sm:hidden top-1/2 -translate-y-1/2 right-0">
          <ExploreTab onClick={() => setOpen(true)} compact />
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
        inert={!open}
      >
        {/* Handle bar */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-[#ffffff30] rounded-full" />
        </div>

        {/* Close button */}
        <button
          aria-label="Close explore panel"
          className="absolute top-3 right-4 text-white opacity-60 hover:opacity-100"
          onClick={() => setOpen(false)}
        >
          <MdClose size={20} />
        </button>

        {/* Content */}
        <div className="px-5 pb-6 overflow-y-auto custom-scrollbar text-white" style={{ height: "calc(70vh - 48px)" }}>
          <Breadcrumb crumbs={breadcrumb} onNavigate={setPath} />

          <CelestialDetail
            body={body}
            onSelectChild={(index) => setPath([...path, index])}
            onGoBack={
              path.length > 0
                ? () => setPath(path.slice(0, -1))
                : undefined
            }
            // The sheet covers most of the screen: close it so the camera flight is visible
            onFly={() => setOpen(false)}
          />
        </div>
      </div>
    </>
  );
}
