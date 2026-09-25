import { useContext, useEffect, useRef, useState } from "react";
import { TimeContext } from "../../context/contexts";
import { FaPause, FaPlay, FaBackward, FaForward } from "react-icons/fa";
import { MdSwapHoriz } from "react-icons/md";
import { SPEEDS, speedIndex, stepSpeed } from "../../helper/timeSpeeds";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Value for <input type="datetime-local"> in local time */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const buttonClass =
  "h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer";

export default function TimeBar() {
  const time = useContext(TimeContext);
  const [now, setNow] = useState(() => time?.getTime() ?? Date.now());
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The clock display refreshes a few times per second, independently of the 3D frame rate
  useEffect(() => {
    if (!time) return;
    const id = window.setInterval(() => setNow(time.getTime()), 200);
    return () => clearInterval(id);
  }, [time]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!time) return null;
  const { rate, paused, live, setRate, setPaused, setTime, goLive } = time;
  const speed = SPEEDS[speedIndex(rate)];
  const reversed = rate < 0;

  const date = new Date(now);
  const dateText = date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const timeText = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      role="group"
      aria-label="Time controls"
      className="fixed z-[999999999] bottom-0 left-0 right-0 sm:bottom-5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-black/70 bg-blur-custom border-t sm:border border-white/10 sm:rounded-xl px-2 py-1.5 sm:px-3 flex items-center justify-between sm:justify-start gap-1 sm:gap-2 font-mono text-white"
    >
      <div className="flex items-center">
        <button className={buttonClass} aria-label="Slower" title="Slower  [" onClick={() => setRate(stepSpeed(rate, -1))}>
          <FaBackward size={11} />
        </button>
        <button
          className={buttonClass}
          aria-label={paused ? "Play" : "Pause"}
          title={paused ? "Play  (Space)" : "Pause  (Space)"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <FaPlay size={11} /> : <FaPause size={11} />}
        </button>
        <button className={buttonClass} aria-label="Faster" title="Faster  ]" onClick={() => setRate(stepSpeed(rate, 1))}>
          <FaForward size={11} />
        </button>
        <button
          className={`${buttonClass} ${reversed ? "text-[#4a90d9]" : ""}`}
          aria-label="Reverse time"
          aria-pressed={reversed}
          title="Reverse direction"
          onClick={() => setRate(-rate)}
        >
          <MdSwapHoriz size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center min-w-[7.5rem] sm:min-w-[9.5rem] px-1">
        {editing ? (
          <input
            ref={inputRef}
            type="datetime-local"
            aria-label="Go to date"
            defaultValue={toLocalInput(now)}
            min="1800-01-01T00:00"
            max="2200-12-31T23:59"
            className="bg-white/10 rounded px-1 text-[12px] text-white [color-scheme:dark]"
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onChange={(e) => {
              const ms = new Date(e.target.value).getTime();
              if (!Number.isNaN(ms)) setTime(ms);
            }}
          />
        ) : (
          <button
            className="text-[13px] leading-5 hover:text-[#4a90d9] transition-colors cursor-pointer"
            title="Pick a date"
            onClick={() => setEditing(true)}
          >
            {dateText}
          </button>
        )}
        <div className="text-[11px] leading-4 text-white/60 whitespace-nowrap">
          <span className="hidden sm:inline">{timeText} · </span>
          {paused ? "Paused" : `${reversed ? "−" : ""}${speed.label}`}
        </div>
      </div>

      {live ? (
        <span className="flex items-center gap-1.5 px-2 text-[11px] tracking-[2px] text-[#00ff88]" title="Showing the Solar System right now">
          <span className="w-[6px] h-[6px] rounded-full bg-[#00ff88] shadow-[0_0_4px_#00ff88]" />
          LIVE
        </span>
      ) : (
        <button
          className="px-3 h-9 sm:h-8 rounded-md border border-white/20 text-[11px] tracking-[2px] uppercase text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Back to now  N"
          onClick={goLive}
        >
          Now
        </button>
      )}
    </div>
  );
}
