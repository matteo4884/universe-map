import { useContext, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import { CelestialBody } from "../data";
import { SelectionContext } from "../context/contexts";
import { hoverStore } from "../lib/overlay/overlayStore";

/** Click selects, double-click flies there, hover shows the pointer cursor */
export function useBodyPointer(body: CelestialBody) {
  const { select } = useContext(SelectionContext);
  return useMemo(
    () => ({
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(body);
      },
      onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        select(body, { fly: true });
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverStore.set(body.id);
      },
      onPointerOut: () => {
        if (hoverStore.get() === body.id) hoverStore.set(null);
      },
    }),
    [body, select]
  );
}
