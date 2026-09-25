const STARS = [
  { left: "30%", delay: "0s", duration: "2.0s" },
  { left: "60%", delay: "0.8s", duration: "1.7s" },
  { left: "45%", delay: "1.5s", duration: "2.3s" },
  { left: "20%", delay: "2.2s", duration: "1.9s" },
  { left: "70%", delay: "0.4s", duration: "2.5s" },
];

interface ExploreTabProps {
  onClick: () => void;
  /** Smaller text and no side glow, for mobile */
  compact?: boolean;
}

/** Animated vertical "Explore" tab that opens the celestial panel */
export default function ExploreTab({ onClick, compact = false }: ExploreTabProps) {
  return (
    <button
      type="button"
      aria-label="Open explore panel"
      className="relative block cursor-pointer"
      onClick={onClick}
    >
      {/* Animated border glow */}
      <div className="absolute -inset-[1px] rounded-l-lg overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ animation: "spin-360 5s linear infinite" }}
        >
          <div
            className="w-[300%] h-[300%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, #4a90d9 12%, #7bb8f5 20%, transparent 35%, transparent 50%, #4a90d9 62%, #6aacf0 70%, transparent 85%)",
            }}
          />
        </div>
        <div className="absolute inset-[1.5px] bg-[#060610] rounded-l-sm" />
      </div>

      {/* Falling star particles */}
      <div className="absolute inset-0 rounded-l-lg overflow-hidden pointer-events-none">
        {STARS.map((star) => (
          <div
            key={star.left}
            className="explore-star"
            style={{ left: star.left, animationDelay: star.delay, animationDuration: star.duration }}
          />
        ))}
      </div>

      {/* Ambient side glow */}
      {!compact && (
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            right: "-40px",
            width: "120px",
            height: "200px",
            background: "radial-gradient(ellipse at 100% 50%, rgba(74,144,217,0.15) 0%, rgba(74,144,217,0.05) 40%, transparent 70%)",
          }}
        />
      )}

      {/* Button content */}
      <div
        className={`relative bg-gradient-to-b from-[rgba(74,144,217,0.12)] to-[rgba(40,80,150,0.04)] text-white ${
          compact ? "text-[10px]" : "text-[11px]"
        } uppercase tracking-[2px] py-3 px-2 rounded-l-lg writing-vertical`}
      >
        <span className="relative z-10">☰ Explore</span>
      </div>
    </button>
  );
}
