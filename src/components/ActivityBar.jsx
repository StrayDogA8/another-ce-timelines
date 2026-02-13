import * as LucideIcons from "lucide-react";

const { LayoutDashboard, Puzzle, PanelLeft, PanelRight } = LucideIcons;

function resolveIcon(icon, fallback) {
  if (!icon) return fallback;
  if (typeof icon === "string") {
    return LucideIcons[icon] || fallback;
  }
  return fallback;
}

export default function ActivityBar({
  layouts,
  activeLayout,
  onLayoutChange,
  isCollapsed,
  onToggle,
}) {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {layouts.map((layout) => {
          const isActive = layout.value === activeLayout;
          const defaultIcon = layout.value === "Horizontal" ? LayoutDashboard : Puzzle;
          const IconComponent = resolveIcon(layout.icon, defaultIcon);
          return (
            <button
              key={layout.value}
              className={`activity-bar-icon${isActive ? " active" : ""}`}
              onClick={() => onLayoutChange(layout.value)}
              title={layout.label}
              aria-label={layout.label}
              type="button"
            >
              <IconComponent size={20} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
      <div className="activity-bar-bottom">
        <button
          className="activity-bar-icon"
          onClick={onToggle}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {isCollapsed ? (
            <PanelRight size={20} strokeWidth={1.8} />
          ) : (
            <PanelLeft size={20} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}
