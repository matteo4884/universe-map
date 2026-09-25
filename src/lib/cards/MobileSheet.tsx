import { useContext, useRef, useState } from "react";
import { MdClose } from "react-icons/md";
import { SelectionContext } from "../../context/contexts";
import { breadcrumb, SUN } from "../../helper/bodies";
import CelestialDetail from "./CelestialDetail";
import Breadcrumb from "./Breadcrumb";
import ExploreTab from "./ExploreTab";

const CLOSE_DRAG_PX = 90;

/** Mobile bottom sheet with the selected body; drag the handle down to close */
export default function MobileSheet() {
  const { selected, select, panelOpen, setPanelOpen } = useContext(SelectionContext);
  const body = selected ?? SUN;
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onPointerUp = () => {
    if (dragStart.current === null) return;
    if (dragY > CLOSE_DRAG_PX) setPanelOpen(false);
    dragStart.current = null;
    setDragging(false);
    setDragY(0);
  };

  return (
    <>
      {!panelOpen && (
        <div className="fixed z-[999999999] sm:hidden top-1/2 -translate-y-1/2 right-0">
          <ExploreTab onClick={() => setPanelOpen(true)} compact />
        </div>
      )}

      {panelOpen && (
        <div
          className="fixed inset-0 z-[999999999] sm:hidden bg-black/50"
          onClick={() => setPanelOpen(false)}
        />
      )}

      <div
        role="dialog"
        aria-label={`${body.name} details`}
        className={`fixed z-[9999999999] sm:hidden bottom-0 left-0 right-0 bg-black/80 bg-blur-custom rounded-t-2xl ${
          dragging ? "" : "transition-transform duration-300 ease-in-out"
        }`}
        style={{
          height: "75vh",
          transform: panelOpen ? `translateY(${dragY}px)` : "translateY(100%)",
        }}
        inert={!panelOpen}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 touch-none cursor-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="w-12 h-1.5 bg-white/30 rounded-full" />
        </div>

        <button
          aria-label="Close explore panel"
          className="absolute top-1.5 right-2 w-11 h-11 flex items-center justify-center text-white/70 hover:text-white"
          onClick={() => setPanelOpen(false)}
        >
          <MdClose size={22} />
        </button>

        <div ref={scrollRef} className="px-5 pb-24 overflow-y-auto custom-scrollbar text-white" style={{ height: "calc(75vh - 48px)" }}>
          <Breadcrumb crumbs={breadcrumb(body)} onNavigate={(b) => select(b)} />
          <CelestialDetail
            body={body}
            // The sheet covers most of the screen: close it so the camera flight is visible
            onFly={() => setPanelOpen(false)}
          />
        </div>
      </div>
    </>
  );
}
