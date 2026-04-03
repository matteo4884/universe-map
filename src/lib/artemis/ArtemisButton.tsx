import { useContext } from "react";
import { ArtemisModeContext } from "../../context/artemisMode";

export default function ArtemisButton() {
  const { mission, active, activate } = useContext(ArtemisModeContext);

  if (!mission || active) return null;

  return (
    <div className="fixed z-[999999999] bottom-6 left-1/2 -translate-x-1/2">
      <button
        onClick={activate}
        className="flex items-center gap-3 px-6 py-3 cursor-pointer border border-[rgba(255,140,0,0.5)] rounded bg-gradient-to-b from-[rgba(255,100,0,0.2)] to-[rgba(255,60,0,0.05)] hover:from-[rgba(255,100,0,0.35)] hover:to-[rgba(255,60,0,0.1)] transition-all"
        style={{
          clipPath:
            "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          animation: "artemis-pulse 3s ease-in-out infinite",
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

      <style>{`
        @keyframes artemis-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,140,0,0.1); }
          50% { box-shadow: 0 0 30px rgba(255,140,0,0.25); }
        }
      `}</style>
    </div>
  );
}
