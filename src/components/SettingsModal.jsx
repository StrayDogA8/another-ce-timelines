import { ArrowLeft, Plus, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import "../styles/07-modals-menus.css";

export default function SettingsModal({
  isOpen,
  onClose,
  timelineData,
  onUpdateTimeline,
  themeKey,
  defaultThemeKey,
  themes,
  onThemeChange,
}) {
  const DETAIL_MIN = 0.2;
  const DETAIL_MID = 1;
  const DETAIL_MAX = 5;
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [detailLevel, setDetailLevel] = useState(1);
  const [detailSlider, setDetailSlider] = useState(50);
  const [showDetailTooltip, setShowDetailTooltip] = useState(false);
  const [detailTooltipLeft, setDetailTooltipLeft] = useState(0);
  const [layout, setLayout] = useState("Horizontal");
  const [theme, setTheme] = useState(defaultThemeKey || "");
  const [useMonths, setUseMonths] = useState(false);
  const [breaks, setBreaks] = useState([]);
  const [negID, setNegID] = useState("");
  const [posID, setPosID] = useState("");
  const [branchOrdering, setBranchOrdering] = useState("later-first");
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef(null);
  const detailSliderRef = useRef(null);
  const lastFilePathRef = useRef(null);

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const detailToSlider = (value) => {
    const clamped = clamp(value, DETAIL_MIN, DETAIL_MAX);
    if (clamped <= DETAIL_MID) {
      const ratio = (clamped - DETAIL_MIN) / (DETAIL_MID - DETAIL_MIN);
      return ratio * 50;
    }
    const ratio = (clamped - DETAIL_MID) / (DETAIL_MAX - DETAIL_MID);
    return 50 + ratio * 50;
  };

  const sliderToDetail = (position) => {
    const pos = clamp(position, 0, 100);
    if (pos <= 50) {
      const ratio = pos / 50;
      return DETAIL_MIN + ratio * (DETAIL_MID - DETAIL_MIN);
    }
    const ratio = (pos - 50) / 50;
    return DETAIL_MID + ratio * (DETAIL_MAX - DETAIL_MID);
  };

  // Convert stored breaks (numeric) to editable breaks (strings for inputs)
  const loadBreaks = (storedBreaks = []) => {
    if (!Array.isArray(storedBreaks) || storedBreaks.length === 0) return [];
    return storedBreaks.map((item) => ({
      start: String(item?.start ?? ""),
      end: String(item?.end ?? ""),
    }));
  };

  // Convert editable breaks (strings) to numeric breaks for saving
  const saveBreaks = (editableBreaks = []) => {
    const out = [];
    editableBreaks.forEach((item) => {
      const startRaw = item?.start?.trim() || "";
      const endRaw = item?.end?.trim() || "";
      if (!startRaw || !endRaw) return;

      const parsedStart = parseTimelineInput(startRaw);
      const parsedEnd = parseTimelineInput(endRaw);
      if (!Number.isFinite(parsedStart.value) || !Number.isFinite(parsedEnd.value)) return;

      const startVal = parsedStart.value;
      const endVal = parsedEnd.value;
      if (startVal === endVal) return;

      const ordered = startVal < endVal
        ? { start: startVal, end: endVal }
        : { start: endVal, end: startVal };
      out.push(ordered);
    });
    return out;
  };

  const addBreak = () => {
    setBreaks([...breaks, { start: "", end: "" }]);
  };

  const removeBreak = (index) => {
    setBreaks(breaks.filter((_, i) => i !== index));
  };

  const updateBreak = (index, field, value) => {
    setBreaks(breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const updateDetailTooltipPosition = () => {
    const sliderEl = detailSliderRef.current;
    if (!sliderEl) return;
    const sliderWidth = sliderEl.getBoundingClientRect().width;
    const thumbSize = 20;
    const left = (detailSlider / 100) * (sliderWidth - thumbSize) + thumbSize / 2;
    setDetailTooltipLeft(left);
  };

  useEffect(() => {
    updateDetailTooltipPosition();
    window.addEventListener("resize", updateDetailTooltipPosition);
    return () => window.removeEventListener("resize", updateDetailTooltipPosition);
  }, [detailSlider]);

  useEffect(() => {
    if (timelineData?.file) {
      const currentPath = timelineData.path || timelineData.file.id || timelineData.file.title;
      const isNewFile = lastFilePathRef.current !== currentPath;

      // Only fully reset state when loading a different file
      if (isNewFile) {
        setTitle(timelineData.file.title || "");
        setStart(String(timelineData.file.startLabel ?? timelineData.file.start ?? ""));
        setEnd(String(timelineData.file.endLabel ?? timelineData.file.end ?? ""));
        const nextDetailLevel = Number(timelineData.file.detailLevel || 1);
        const clampedDetail = clamp(nextDetailLevel, DETAIL_MIN, DETAIL_MAX);
        setDetailLevel(clampedDetail);
        setDetailSlider(detailToSlider(clampedDetail));
        setTheme(timelineData.file.theme || defaultThemeKey || "");
        setLayout(timelineData.file.layout || "Horizontal");
        setUseMonths(Boolean(timelineData.file.useMonths));
        setBreaks(loadBreaks(timelineData.file.breaks));
        setNegID(timelineData.file.negID || "");
        setPosID(timelineData.file.posID || "");
        setBranchOrdering(timelineData.file.branchOrdering || "later-first");
        lastFilePathRef.current = currentPath;
        setIsInitialized(true);
      }
    }
  }, [timelineData]);

  // Debounced auto-save whenever values change (but not on initial load)
  useEffect(() => {
    if (!isInitialized) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout to save after 300ms of no changes
    saveTimeoutRef.current = setTimeout(() => {
      const parsedStart = parseTimelineInput(start);
      const parsedEnd = parseTimelineInput(end);
      const startValue =
        useMonths && parsedStart.precision !== "day"
          ? snapToMonthGrid(parsedStart.value)
          : parsedStart.value;
      const endValue =
        useMonths && parsedEnd.precision !== "day"
          ? snapToMonthGrid(parsedEnd.value)
          : parsedEnd.value;
      const parsedBreaks = saveBreaks(breaks);
      if (onUpdateTimeline) {
        onUpdateTimeline({
          title,
          start: startValue,
          end: endValue,
          detailLevel: Number(detailLevel),
          negID,
          posID,
          theme,
          startLabel: parsedStart.label,
          endLabel: parsedEnd.label,
          useMonths,
          breaks: parsedBreaks,
          layout,
          branchOrdering,
        });
      }
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    title,
    start,
    end,
    detailLevel,
    negID,
    posID,
    theme,
    useMonths,
    layout,
    breaks,
    branchOrdering,
  ]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <button
            className="settings-back-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className="settings-title">SETTINGS</h2>
        </div>

        <div className="settings-content">
          {/* Timeline Name */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Name</div>
              <div className="settings-row-description">Your file will be saved as: {title.toLowerCase().replace(/\s+/g, '-')}.timeline</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter timeline name"
              />
            </div>
          </div>

          {/* Start Point */}
          <div className="settings-row no-border-bottom">
            <div className="settings-row-left">
              <div className="settings-row-label">Start Point</div>
              <div className="settings-row-description">The first year/date shown on the timeline.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                inputMode="numeric"
                className="settings-input settings-input-small"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>

          {/* End Point */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">End Point</div>
              <div className="settings-row-description">The last year/date shown on the timeline.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                inputMode="numeric"
                className="settings-input settings-input-small"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Timeline Length */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Length</div>
              <div className="settings-row-description">Higher values can fit more events with less overlap.</div>
            </div>
            <div className="settings-row-right">
              <div className="settings-slider-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="settings-slider"
                  value={detailSlider}
                  ref={detailSliderRef}
                  onChange={(e) => {
                    const nextPosition = Number(e.target.value);
                    const rawDetail = sliderToDetail(nextPosition);
                    const snappedDetail = Number((Math.round(rawDetail * 10) / 10).toFixed(1));
                    setDetailLevel(snappedDetail);
                    setDetailSlider(detailToSlider(snappedDetail));
                  }}
                  onMouseEnter={() => {
                    updateDetailTooltipPosition();
                    setShowDetailTooltip(true);
                  }}
                  onMouseLeave={() => setShowDetailTooltip(false)}
                  onMouseDown={() => {
                    updateDetailTooltipPosition();
                    setShowDetailTooltip(true);
                  }}
                  onMouseUp={() => setShowDetailTooltip(false)}
                  onFocus={() => {
                    updateDetailTooltipPosition();
                    setShowDetailTooltip(true);
                  }}
                />
                {showDetailTooltip && (
                  <div
                    className="settings-slider-tooltip"
                    style={{ left: detailTooltipLeft }}
                  >
                    {detailLevel}x
                  </div>
                )}
                <div className="settings-slider-labels">
                  <span className="settings-slider-label settings-slider-label-min">{DETAIL_MIN}</span>
                  <span className="settings-slider-label settings-slider-label-mid">{DETAIL_MID}</span>
                  <span className="settings-slider-label settings-slider-label-max">{DETAIL_MAX}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Breaks */}
          <div className="settings-row settings-row-breaks">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Breaks</div>
              <div className="settings-row-description">
                Skip empty spans of time.
              </div>
            </div>
            <div className="settings-row-right settings-breaks-container">
              {breaks.map((breakItem, index) => (
                <div key={index} className="settings-break-row">
                  <input
                    type="text"
                    className="settings-input settings-break-input"
                    value={breakItem.start}
                    onChange={(e) => updateBreak(index, "start", e.target.value)}
                    placeholder="Start"
                  />
                  <span className="settings-break-separator">–</span>
                  <input
                    type="text"
                    className="settings-input settings-break-input"
                    value={breakItem.end}
                    onChange={(e) => updateBreak(index, "end", e.target.value)}
                    placeholder="End"
                  />
                  <button
                    type="button"
                    className="settings-break-remove"
                    onClick={() => removeBreak(index)}
                    aria-label="Remove break"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="settings-break-add"
                onClick={addBreak}
              >
                <Plus size={14} />
                <span>Add Break</span>
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Theme</div>
              <div className="settings-row-description">Choose a color theme for the timeline.</div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={theme || themeKey || ""}
                onChange={(e) => {
                  setTheme(e.target.value);
                  onThemeChange?.(e.target.value);
                }}
              >
                <option value="default">Default (App Theme)</option>
                {Object.entries(themes || {}).map(([key, theme]) => (
                  <option key={key} value={key}>
                    {theme?.name || key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline Layout */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Layout</div>
              <div className="settings-row-description">More layouts will be available soon!</div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={layout}
                onChange={(e) => setLayout(e.target.value)}
              >
                <option value="Horizontal">Horizontal</option>
              </select>
            </div>
          </div>

          {/* Branch Ordering */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Branch Ordering</div>
              <div className="settings-row-description">
                Choose whether later-starting branches stay closer to the parent.
              </div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={branchOrdering}
                onChange={(e) => setBranchOrdering(e.target.value)}
              >
                <option value="later-first">Later starts closer</option>
                <option value="original">Follow branch list order</option>
              </select>
            </div>
          </div>

          {/* Show Months on Ticks */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Show Months on Ticks</div>
              <div className="settings-row-description">Display month labels when tick spacing is less than one year.</div>
            </div>
            <div className="settings-row-right">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={useMonths}
                  onChange={(e) => setUseMonths(e.target.checked)}
                />
                <span className="settings-toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Negative Era */}
          <div className="settings-row no-border-bottom">
            <div className="settings-row-left">
              <div className="settings-row-label">Negative Era</div>
              <div className="settings-row-description">Optional label for negative years (e.g., BCE).</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input settings-input-small"
                value={negID}
                onChange={(e) => setNegID(e.target.value)}
                placeholder="e.g., BCE"
              />
            </div>
          </div>

          {/* Positive Era */}
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Positive Era</div>
              <div className="settings-row-description">Optional label for positive years (e.g., CE).</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input settings-input-small"
                value={posID}
                onChange={(e) => setPosID(e.target.value)}
                placeholder="e.g., CE"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
