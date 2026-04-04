import { createContext } from "react";
import { CelestialBody } from "../data";

export interface BodySelectionContextType {
  selectBody: (bodyId: number) => void;
}

export const BodySelectionContext = createContext<BodySelectionContextType>({
  selectBody: () => {},
});

/** Find the path (array of child indices) from root to a body with the given id */
export function findPathToBody(root: CelestialBody, targetId: number): number[] | null {
  if (root.id === targetId) return [];
  for (let i = 0; i < root.children.length; i++) {
    const result = findPathToBody(root.children[i], targetId);
    if (result !== null) return [i, ...result];
  }
  return null;
}
