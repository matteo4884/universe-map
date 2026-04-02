import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ScaleProvider } from "./context/providers.tsx";
import { CameraNavigationProvider } from "./context/cameraNavigation.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleProvider>
      <CameraNavigationProvider>
        <App />
      </CameraNavigationProvider>
    </ScaleProvider>
  </StrictMode>
);
