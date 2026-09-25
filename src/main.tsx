import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ScaleProvider, CameraNavigationProvider } from "./context/providers.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleProvider>
      <CameraNavigationProvider>
        <App />
      </CameraNavigationProvider>
    </ScaleProvider>
  </StrictMode>
);
