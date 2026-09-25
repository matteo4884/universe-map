import { Component, ReactNode } from "react";

interface BoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/**
 * Catches errors thrown by the 3D scene (e.g. a texture that fails to load),
 * which would otherwise unmount the whole app and leave a black page.
 */
export class SceneErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[Scene] Failed to render the 3D scene", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneErrorScreen({ webgl }: { webgl: boolean }) {
  return (
    <div className="fixed inset-0 z-[9999999999] bg-black flex items-center justify-center p-6 font-mono text-center">
      <div className="max-w-sm">
        <div className="text-[11px] tracking-[6px] uppercase text-white font-light opacity-80 mb-4">
          Universe Map
        </div>
        <div className="text-[12px] text-[rgba(255,255,255,0.6)] leading-relaxed">
          {webgl
            ? "Something went wrong while loading the 3D scene. Please reload the page."
            : "Your browser or device doesn't support WebGL, which is needed to render the 3D scene."}
        </div>
        {webgl && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 text-[10px] tracking-[2px] uppercase py-2 px-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.6)] hover:text-white transition-colors cursor-pointer"
          >
            Reload
          </button>
        )}
      </div>
    </div>
  );
}
