import { useContext } from "react";
import { ArtemisModeContext } from "../../context/artemisMode";

export default function ArtemisButton() {
  const { mission, active, activate } = useContext(ArtemisModeContext);

  if (!mission || active) return null;

  return (
    <div className="fixed z-[999999999] bottom-6 left-1/2 -translate-x-1/2">
      {/* Soft ambient glow from below screen edge */}
      <div
        className="fixed left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "-100px",
          width: "700px",
          height: "300px",
          background: "radial-gradient(ellipse at center 85%, rgba(255,140,0,0.3) 0%, rgba(255,100,0,0.15) 30%, rgba(255,80,0,0.05) 60%, transparent 80%)",
        }}
      />
      <div className="relative">
        {/* Animated border glow container */}
        <div
          className="absolute -inset-[1px] rounded overflow-hidden"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          {/* Rotating conic gradient border */}
          <div
            className="absolute inset-0"
            style={{ animation: "artemis-border-spin 4s linear infinite" }}
          >
            <div
              className="w-[200%] h-[200%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, #ff8c00 15%, #ffb347 25%, transparent 40%, transparent 50%, #ff6b00 65%, #ff9500 75%, transparent 90%)",
              }}
            />
          </div>
          {/* Inner cutout — reveals only the border */}
          <div
            className="absolute inset-[1.5px] bg-black rounded-sm"
            style={{
              clipPath:
                "polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px))",
            }}
          />
        </div>

        {/* Falling stars overlay */}
        <div
          className="absolute inset-0 rounded overflow-hidden pointer-events-none"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          <div className="artemis-star" style={{ left: "15%", animationDelay: "0s", animationDuration: "2.2s" }} />
          <div className="artemis-star" style={{ left: "35%", animationDelay: "0.7s", animationDuration: "1.8s" }} />
          <div className="artemis-star" style={{ left: "55%", animationDelay: "1.3s", animationDuration: "2.5s" }} />
          <div className="artemis-star" style={{ left: "75%", animationDelay: "0.4s", animationDuration: "2.0s" }} />
          <div className="artemis-star" style={{ left: "90%", animationDelay: "1.8s", animationDuration: "1.6s" }} />
          <div className="artemis-star" style={{ left: "25%", animationDelay: "2.1s", animationDuration: "2.3s" }} />
          <div className="artemis-star" style={{ left: "65%", animationDelay: "0.9s", animationDuration: "1.9s" }} />
          <div className="artemis-star" style={{ left: "45%", animationDelay: "1.6s", animationDuration: "2.1s" }} />
        </div>

        {/* Button content */}
        <button
          onClick={activate}
          className="relative flex items-center gap-3 px-6 py-3 cursor-pointer rounded bg-gradient-to-b from-[rgba(255,100,0,0.15)] to-[rgba(255,60,0,0.03)] hover:from-[rgba(255,100,0,0.3)] hover:to-[rgba(255,60,0,0.08)] transition-all"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          <span className="text-base">🚀</span>
          <div className="flex flex-col items-start">
            <span className="text-[9px] tracking-[4px] text-[#ff9500] uppercase font-mono">
              Mission Active
            </span>
            <span className="text-[13px] tracking-[2px] text-white uppercase font-bold font-mono">
              {mission.name}
            </span>
          </div>
          <div className="w-[6px] h-[6px] rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88] ml-1" />
        </button>
      </div>

      <style>{`
        @keyframes artemis-border-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes artemis-star-fall {
          0% {
            transform: translateY(-4px);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(60px);
            opacity: 0;
          }
        }
        .artemis-star {
          position: absolute;
          top: -2px;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: #ff9500;
          box-shadow: 0 0 4px #ff8c00, 0 0 8px rgba(255,140,0,0.4);
          animation: artemis-star-fall linear infinite;
        }
      `}</style>
    </div>
  );
}
