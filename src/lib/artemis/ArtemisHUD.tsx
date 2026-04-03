import { useContext, useState } from "react";
import { ArtemisModeContext } from "../../context/artemisMode";
import { MdClose } from "react-icons/md";

function formatMET(seconds: number): string {
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = Math.floor(abs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  const str = `${days > 0 ? days + "d " : ""}${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
  return seconds < 0 ? `T- ${str}` : str;
}

function formatKm(km: number): string {
  if (km >= 1_000_000) return (km / 1_000_000).toFixed(2) + " M km";
  return Math.round(km).toLocaleString() + " km";
}

export default function ArtemisHUD() {
  const { mission, active, deactivate, telemetry, signalLost } = useContext(ArtemisModeContext);
  const [videoOpen, setVideoOpen] = useState(true);
  const [mobileVideoOpen, setMobileVideoOpen] = useState(false);

  if (!active || !mission) return null;

  return (
    <div className="fixed inset-0 z-[999999999] pointer-events-none font-mono">
      {/* TOP LEFT: Mission info */}
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="text-[9px] tracking-[4px] text-[#ff9500] uppercase">Mission Active</div>
        <div className="text-lg font-bold tracking-[3px] text-white mt-0.5">{mission.name}</div>
        <div className="text-[10px] text-[rgba(255,255,255,0.4)] mt-1.5 tracking-[2px]">
          PHASE: {telemetry?.phase ?? "ACQUIRING SIGNAL"}
        </div>
        <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5 tracking-[1px]">
          MET {telemetry ? formatMET(telemetry.met) : "--"}
        </div>
      </div>

      {/* TOP RIGHT: Crew (desktop) */}
      <div className="absolute top-4 right-4 text-right hidden sm:block pointer-events-auto">
        <div className="text-[9px] tracking-[3px] text-[rgba(255,255,255,0.4)] uppercase mb-1.5">Crew</div>
        {mission.crew.map((c) => (
          <div key={c.name} className="text-[10px] text-[rgba(255,255,255,0.7)] leading-relaxed">
            {c.role} {c.name} {c.flag ?? ""}
          </div>
        ))}
      </div>

      {/* BOTTOM LEFT: Telemetry */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="text-[9px] tracking-[3px] text-[rgba(255,255,255,0.4)] uppercase mb-2 hidden sm:block">
          Telemetry {signalLost && <span className="text-red-500 ml-2">SIGNAL LOST</span>}
        </div>
        <div className="hidden sm:grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
          <span className="text-[rgba(255,255,255,0.5)]">DIST EARTH</span>
          <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.distEarth) : "--"}</span>
          <span className="text-[rgba(255,255,255,0.5)]">DIST MOON</span>
          <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.distMoon) : "--"}</span>
          <span className="text-[rgba(255,255,255,0.5)]">VELOCITY</span>
          <span className="text-[#4a90d9] font-bold">{telemetry ? telemetry.velocity.toFixed(2) + " km/s" : "--"}</span>
          <span className="text-[rgba(255,255,255,0.5)]">ALTITUDE</span>
          <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.altitude) : "--"}</span>
        </div>
        <div className="flex sm:hidden gap-4 text-[9px]">
          <div>
            <span className="text-[rgba(255,255,255,0.4)]">ALT </span>
            <span className="text-[#4a90d9]">{telemetry ? formatKm(telemetry.altitude) : "--"}</span>
          </div>
          <div>
            <span className="text-[rgba(255,255,255,0.4)]">VEL </span>
            <span className="text-[#4a90d9]">{telemetry ? telemetry.velocity.toFixed(1) + " km/s" : "--"}</span>
          </div>
          {signalLost && <span className="text-red-500">NO SIGNAL</span>}
        </div>
      </div>

      {/* BOTTOM RIGHT: Video + Exit */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
        {videoOpen && (
          <div className="hidden sm:block relative">
            <iframe
              width="240"
              height="135"
              src={`https://www.youtube.com/embed/${mission.youtubeVideoId}?autoplay=1&mute=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="rounded border border-[rgba(255,255,255,0.1)]"
            />
            <button
              onClick={() => setVideoOpen(false)}
              className="absolute top-1 right-1.5 text-[rgba(255,255,255,0.5)] hover:text-white text-xs cursor-pointer"
            >
              <MdClose size={14} />
            </button>
          </div>
        )}
        {!videoOpen && (
          <button
            onClick={() => setVideoOpen(true)}
            className="hidden sm:block text-[9px] tracking-[2px] text-[rgba(255,255,255,0.4)] uppercase cursor-pointer py-1 px-2 border border-[rgba(255,255,255,0.1)] rounded hover:border-[rgba(255,255,255,0.3)] transition-colors"
          >
            NASA Live ▸
          </button>
        )}
        <button
          onClick={() => setMobileVideoOpen(!mobileVideoOpen)}
          className="sm:hidden text-[9px] tracking-[2px] text-[rgba(255,255,255,0.4)] uppercase cursor-pointer py-1 px-2 border border-[rgba(255,255,255,0.1)] rounded"
        >
          {mobileVideoOpen ? "Hide" : "NASA Live ▸"}
        </button>
        {mobileVideoOpen && (
          <div className="sm:hidden">
            <iframe
              width="200"
              height="113"
              src={`https://www.youtube.com/embed/${mission.youtubeVideoId}?autoplay=1&mute=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="rounded border border-[rgba(255,255,255,0.1)]"
            />
          </div>
        )}
        <button
          onClick={deactivate}
          className="text-[9px] tracking-[2px] text-[rgba(255,255,255,0.4)] uppercase cursor-pointer py-1 px-2 border border-[rgba(255,255,255,0.1)] rounded hover:text-white hover:border-[rgba(255,255,255,0.3)] transition-colors"
        >
          Exit Mission ✕
        </button>
      </div>

      {/* CENTER BOTTOM: Timeline (desktop) */}
      {telemetry && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 pointer-events-none">
          <span className="text-[8px] text-[rgba(255,255,255,0.3)] tracking-[1px]">DAY 1</span>
          <div className="relative w-40 h-[2px] bg-[rgba(255,255,255,0.1)] rounded">
            <div
              className="absolute top-0 left-0 h-full bg-[rgba(255,140,0,0.5)] rounded"
              style={{
                width: `${Math.min(100, Math.max(0, (telemetry.met / ((mission.endDate.getTime() - mission.startDate.getTime()) / 1000)) * 100))}%`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-[#ff9500] shadow-[0_0_6px_rgba(255,140,0,0.5)]"
              style={{
                left: `${Math.min(100, Math.max(0, (telemetry.met / ((mission.endDate.getTime() - mission.startDate.getTime()) / 1000)) * 100))}%`,
              }}
            />
          </div>
          <span className="text-[8px] text-[rgba(255,255,255,0.3)] tracking-[1px]">DAY 10</span>
        </div>
      )}
    </div>
  );
}
