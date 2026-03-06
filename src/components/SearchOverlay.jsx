import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Minus, AlignLeft, LayoutTemplate } from "lucide-react";

function formatElementDate(el, fileSettings) {
  const negID = fileSettings?.negativeYearIdentifier || "BCE";
  const posID = fileSettings?.positiveYearIdentifier || "";
  const useMonths = fileSettings?.useMonths === true;

  const fmtYear = (year, label) => {
    if (label && typeof label === "string") return label;
    if (!Number.isFinite(year)) return "";
    if (useMonths) {
      const wholeYear = Math.floor(Math.abs(year));
      const month = Math.round((Math.abs(year) - Math.floor(Math.abs(year))) * 12) + 1;
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthName = monthNames[Math.min(month - 1, 11)];
      const suffix = year < 0 ? ` ${negID}` : (posID ? ` ${posID}` : "");
      return `${monthName} ${wholeYear}${suffix}`;
    }
    const absYear = Math.abs(Math.round(year));
    if (year < 0) return `${absYear} ${negID}`;
    return posID ? `${absYear} ${posID}` : String(absYear);
  };

  if (el.type === "event") {
    return fmtYear(el.date, el.dateLabel);
  }
  const start = fmtYear(el.start, el.startLabel);
  const end = fmtYear(el.end, el.endLabel);
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

const TYPE_ICONS = {
  event: <Minus size={13} strokeWidth={2.5} />,
  span: <AlignLeft size={13} strokeWidth={2.5} />,
  era: <LayoutTemplate size={13} strokeWidth={2.5} />,
};

const TYPE_LABELS = { event: "Event", span: "Span", era: "Era" };

export default function SearchOverlay({ isOpen, onClose, elements, onSelect, fileSettings }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const activeItemRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements.slice(0, 50);
    return elements.filter((el) => el.title?.toLowerCase().includes(q));
  }, [query, elements]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const el = results[activeIndex];
        if (el) {
          onSelect(el.id);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [isOpen, results, activeIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="search-overlay-backdrop" onMouseDown={onClose}>
      <div
        className="search-overlay-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="search-overlay-input-row">
          <Search size={15} className="search-overlay-icon" />
          <input
            ref={inputRef}
            className="search-overlay-input"
            placeholder="Search spans, events, eras…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="search-overlay-esc">esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="search-overlay-results" ref={listRef}>
            {results.map((el, i) => (
              <button
                key={el.id}
                ref={i === activeIndex ? activeItemRef : null}
                className={`search-result-item${i === activeIndex ? " search-result-item--active" : ""}`}
                onMouseDown={() => {
                  onSelect(el.id);
                  onClose();
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span
                  className="search-result-type-badge"
                  data-type={el.type}
                >
                  {TYPE_ICONS[el.type]}
                  <span className="search-result-type-label">{TYPE_LABELS[el.type]}</span>
                </span>
                <span className="search-result-title">{el.title || "(untitled)"}</span>
                <span className="search-result-date">
                  {formatElementDate(el, fileSettings)}
                </span>
              </button>
            ))}
          </div>
        )}

        {results.length === 0 && (
          <div className="search-overlay-empty">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
