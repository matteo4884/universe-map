import { CelestialBody } from "../../data";

interface BreadcrumbProps {
  crumbs: CelestialBody[];
  onNavigate: (body: CelestialBody) => void;
}

export default function Breadcrumb({ crumbs, onNavigate }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-4 text-xs text-white/50 flex-wrap">
      {crumbs.map((crumb, i) => {
        const isCurrent = i === crumbs.length - 1;
        return (
          <span key={crumb.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/30" aria-hidden="true">›</span>}
            <button
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              className={`cursor-pointer hover:text-white focus-visible:text-white transition-colors ${
                isCurrent ? "text-white font-semibold" : ""
              }`}
              onClick={() => onNavigate(crumb)}
            >
              {crumb.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
