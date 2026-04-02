import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ScaleDistanceScaleProvider } from "./context/providers.tsx";
import { CameraNavigationProvider } from "./context/cameraNavigation.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleDistanceScaleProvider>
      <CameraNavigationProvider>
        <App />
      </CameraNavigationProvider>
    </ScaleDistanceScaleProvider>
  </StrictMode>
);
