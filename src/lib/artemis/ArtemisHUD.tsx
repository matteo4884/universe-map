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
  const { mission, active, deactivate, telemetry, fetchedAt, dataOnline, setCameraTarget, orionEnhanced, setOrionEnhanced } = useContext(ArtemisModeContext);
  const [videoOpen, setVideoOpen] = useState(true);
  const [mobileVideoOpen, setMobileVideoOpen] = useState(false);
  const [showScaleConfirm, setShowScaleConfirm] = useState(false);

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
        <div className="text-[8px] text-[rgba(255,255,255,0.25)] mt-1.5 tracking-[3px] uppercase">
          Realistic Scale
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
      <div className="absolute bottom-6 left-6 pointer-events-auto">
        {/* Desktop */}
        <div className="hidden sm:block">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[9px] tracking-[3px] text-[rgba(255,255,255,0.4)] uppercase">Telemetry</span>
            <span className={`inline-flex items-center gap-1 text-[8px] ${dataOnline ? "text-[#00ff88]" : "text-[#ff6b35]"}`}>
              <span className={`inline-block w-[5px] h-[5px] rounded-full ${dataOnline ? "bg-[#00ff88] shadow-[0_0_4px_#00ff88]" : "bg-[#ff6b35]"}`} />
              {dataOnline ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11px]">
            <span className="text-[rgba(255,255,255,0.5)]">DIST EARTH</span>
            <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.distEarth) : "--"}</span>
            <span className="text-[rgba(255,255,255,0.5)]">DIST MOON</span>
            <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.distMoon) : "--"}</span>
            <span className="text-[rgba(255,255,255,0.5)]">VELOCITY</span>
            <span className="text-[#4a90d9] font-bold">{telemetry ? telemetry.velocity.toFixed(2) + " km/s" : "--"}</span>
            <span className="text-[rgba(255,255,255,0.5)]">ALTITUDE</span>
            <span className="text-[#4a90d9] font-bold">{telemetry ? formatKm(telemetry.altitude) : "--"}</span>
          </div>
          {fetchedAt && (
            <div className="text-[10px] text-[rgba(255,255,255,0.35)] mt-3 tracking-[1px]">
              Last update {new Date(fetchedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        {/* Mobile */}
        <div className="flex sm:hidden items-center gap-4 text-[9px]">
          <span className={`inline-flex items-center gap-1 ${dataOnline ? "text-[#00ff88]" : "text-[#ff6b35]"}`}>
            <span className={`inline-block w-[4px] h-[4px] rounded-full ${dataOnline ? "bg-[#00ff88]" : "bg-[#ff6b35]"}`} />
            {dataOnline ? "LIVE" : "OFF"}
          </span>
          <div>
            <span className="text-[rgba(255,255,255,0.4)]">ALT </span>
            <span className="text-[#4a90d9]">{telemetry ? formatKm(telemetry.altitude) : "--"}</span>
          </div>
          <div>
            <span className="text-[rgba(255,255,255,0.4)]">VEL </span>
            <span className="text-[#4a90d9]">{telemetry ? telemetry.velocity.toFixed(1) + " km/s" : "--"}</span>
          </div>
        </div>
      </div>

      {/* BOTTOM RIGHT: Video + Exit */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
        {videoOpen && (
          <div className="hidden sm:block relative">
            <iframe
              width="360"
              height="203"
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
          className="text-[11px] tracking-[2px] text-white uppercase cursor-pointer py-2 px-4 border border-[rgba(255,255,255,0.3)] rounded bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.18)] transition-colors"
        >
          ✕ Exit Mission
        </button>
      </div>

      {/* CENTER BOTTOM: Body navigation + Timeline (desktop) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-3 pointer-events-auto">
        {/* Body buttons */}
        <div className="flex items-center gap-2">
          {(["earth", "orion", "moon"] as const).map((body) => (
            <button
              key={body}
              onClick={() => setCameraTarget(body)}
              className="text-[10px] tracking-[2px] uppercase py-1.5 px-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.15)] transition-colors cursor-pointer text-[rgba(255,255,255,0.6)] hover:text-white"
            >
              {body === "orion" ? "🚀 Orion" : body === "earth" ? "🌍 Earth" : "🌙 Moon"}
            </button>
          ))}
        </div>

        {/* Scale mode toggle */}
        <button
          onClick={() => {
            if (orionEnhanced) {
              setShowScaleConfirm(true);
            } else {
              setOrionEnhanced(true);
            }
          }}
          className={`text-[11px] tracking-[1px] py-1.5 px-4 rounded border transition-colors cursor-pointer ${
            orionEnhanced
              ? "border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.5)] hover:text-white"
              : "border-[#00ff88] bg-[rgba(0,255,136,0.1)] text-[#00ff88]"
          }`}
        >
          {orionEnhanced ? "Switch to Real Scale Orion →" : "✓ Real Scale Orion — Switch to Enhanced"}
        </button>

        {/* Timeline */}
      {telemetry && (
        <div className="flex items-center gap-2 pointer-events-none">
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

      {/* Real Scale confirmation modal */}
      {showScaleConfirm && (
        <div className="fixed inset-0 z-[999999999] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.7)]" onClick={() => setShowScaleConfirm(false)} />
          <div className="relative bg-[#0a0a0a] border border-[rgba(255,255,255,0.15)] rounded-lg p-6 max-w-sm mx-4 font-mono">
            <div className="text-[11px] tracking-[3px] text-[#ff9500] uppercase mb-3">Real Scale Mode</div>
            <div className="text-[13px] text-white leading-relaxed mb-4">
              You are about to switch to real scale.
            </div>
            <div className="text-[11px] text-[rgba(255,255,255,0.5)] leading-relaxed mb-4 space-y-2">
              <p>The Orion spacecraft is <span className="text-white">~5 meters</span> wide and <span className="text-white">~10 meters</span> tall.</p>
              <p>The current enhanced model is displayed at <span className="text-white">~130 km</span> for visibility.</p>
              <p className="text-[#ff6b35]">Due to the astronomical difference in scale, the real-size model will have visual artifacts (z-fighting) caused by hardware precision limits of WebGL.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOrionEnhanced(false);
                  setShowScaleConfirm(false);
                }}
                className="flex-1 text-[10px] tracking-[2px] uppercase py-2 rounded border border-[#00ff88] bg-[rgba(0,255,136,0.1)] text-[#00ff88] cursor-pointer hover:bg-[rgba(0,255,136,0.2)] transition-colors"
              >
                Switch to Real Scale
              </button>
              <button
                onClick={() => setShowScaleConfirm(false)}
                className="flex-1 text-[10px] tracking-[2px] uppercase py-2 rounded border border-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.5)] cursor-pointer hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
