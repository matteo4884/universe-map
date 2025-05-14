import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ScaleDistanceScaleProvider } from "./context/providers.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScaleDistanceScaleProvider>
      <App />
    </ScaleDistanceScaleProvider>
  </StrictMode>
);
