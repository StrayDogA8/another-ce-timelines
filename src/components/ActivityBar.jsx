import * as LucideIcons from "lucide-react";

const { LayoutDashboard, Puzzle, Settings } = LucideIcons;

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
  onOpenSettings,
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
              <IconComponent size={17} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
      <div className="activity-bar-bottom">
        <button
          className="activity-bar-icon"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          type="button"
        >
          <Settings size={17} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
