import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { ICON_CATEGORIES, ALL_ICONS } from "../config/elementIcons";

export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const popoverRef = useRef(null);

  const CurrentIcon = value
    ? ALL_ICONS.find((i) => i.name === value)?.component
    : null;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!popoverRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = query.trim()
    ? ALL_ICONS.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : null;

  const handleSelect = (name) => {
    onChange(name === value ? null : name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="icon-picker-wrap">
      <>
        <button
          type="button"
          className={`icon-picker-trigger${value ? " has-icon" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title={value ? `Icon: ${value}` : "Add icon"}
        >
          {CurrentIcon ? <CurrentIcon size={14} /> : <span className="icon-picker-placeholder">No icon</span>}
        </button>
        {value && (
          <button
            type="button"
            className="icon-picker-clear"
            onClick={() => onChange(null)}
            title="Remove icon"
          >
            <X size={10} />
          </button>
        )}
      </>
      {open && (
        <div className="icon-picker-popover" ref={popoverRef}>
          <div className="icon-picker-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="icon-picker-search"
              placeholder="Search icons..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="icon-picker-grid-wrap">
            {filtered ? (
              filtered.length > 0 ? (
                <div className="icon-picker-grid">
                  {filtered.map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      className={`icon-picker-cell${value === entry.name ? " is-selected" : ""}`}
                      title={entry.name}
                      onClick={() => handleSelect(entry.name)}
                    >
                      <entry.component size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="icon-picker-empty">No icons match</div>
              )
            ) : (
              ICON_CATEGORIES.map((cat) => (
                <div key={cat.label} className="icon-picker-category">
                  <div className="icon-picker-category-label">{cat.label}</div>
                  <div className="icon-picker-grid">
                    {cat.icons.map((entry) => (
                      <button
                        key={entry.name}
                        type="button"
                        className={`icon-picker-cell${value === entry.name ? " is-selected" : ""}`}
                        title={entry.name}
                        onClick={() => handleSelect(entry.name)}
                      >
                        <entry.component size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
