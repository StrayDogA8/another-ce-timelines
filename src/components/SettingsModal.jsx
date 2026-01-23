import { ArrowLeft } from "lucide-react";
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
  const [eventLineStyle, setEventLineStyle] = useState("solid");
  const [negID, setNegID] = useState("");
  const [posID, setPosID] = useState("");
  const [showCenterTimeline, setShowCenterTimeline] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef(null);
  const detailSliderRef = useRef(null);

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

  useEffect(() => {
    const updateTooltip = () => {
      const sliderEl = detailSliderRef.current;
      if (!sliderEl) return;
      const sliderWidth = sliderEl.getBoundingClientRect().width;
      const thumbSize = 20;
      const left = (detailSlider / 100) * (sliderWidth - thumbSize) + thumbSize / 2;
      setDetailTooltipLeft(left);
    };

    updateTooltip();
    window.addEventListener("resize", updateTooltip);
    return () => window.removeEventListener("resize", updateTooltip);
  }, [detailSlider]);

  useEffect(() => {
    if (timelineData?.file) {
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
      setEventLineStyle(timelineData.file.eventLineStyle || "solid");
      setNegID(timelineData.file.negID || "");
      setPosID(timelineData.file.posID || "");
      setIsInitialized(true);
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
      const startValue = useMonths ? snapToMonthGrid(parsedStart.value) : parsedStart.value;
      const endValue = useMonths ? snapToMonthGrid(parsedEnd.value) : parsedEnd.value;
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
          eventLineStyle,
          layout,
        });
      }
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, start, end, detailLevel, negID, posID, theme, useMonths, eventLineStyle, layout]);

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

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Theme</div>
              <div className="settings-row-description">Choose a color theme for the app.</div>
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
                  onMouseEnter={() => setShowDetailTooltip(true)}
                  onMouseLeave={() => setShowDetailTooltip(false)}
                  onMouseDown={() => setShowDetailTooltip(true)}
                  onMouseUp={() => setShowDetailTooltip(false)}
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

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Event Line Style</div>
              <div className="settings-row-description">Style for event connectors to the timeline.</div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={eventLineStyle}
                onChange={(e) => setEventLineStyle(e.target.value)}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

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

          <div className="settings-row no-border-bottom">
            <div className="settings-row-left">
              <div className="settings-row-label">Negative Era</div>
              <div className="settings-row-description">Optional label for negative years.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input settings-input-small"
                value={negID}
                onChange={(e) => setNegID(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Positive Era</div>
              <div className="settings-row-description">Optional label for positive years.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input settings-input-small"
                value={posID}
                onChange={(e) => setPosID(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Show Center Timeline</div>
            </div>
            <div className="settings-row-right">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={showCenterTimeline}
                  onChange={(e) => setShowCenterTimeline(e.target.checked)}
                />
                <span className="settings-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
