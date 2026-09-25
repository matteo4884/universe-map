import { createContext } from "react";

export interface BodySelectionContextType {
  selectBody: (bodyId: number) => void;
}

export const BodySelectionContext = createContext<BodySelectionContextType>({
  selectBody: () => {},
});
