import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {
  ScaleProvider,
  CameraNavigationProvider,
  TimeProvider,
  SelectionProvider,
  LayersProvider,
} from "./context/providers.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleProvider>
      <CameraNavigationProvider>
        <TimeProvider>
          <SelectionProvider>
            <LayersProvider>
              <App />
            </LayersProvider>
          </SelectionProvider>
        </TimeProvider>
      </CameraNavigationProvider>
    </ScaleProvider>
  </StrictMode>
);
