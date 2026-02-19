import { ArrowLeft, Plus, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import { DETAIL_MIN, DETAIL_MID, DETAIL_MAX, clamp, detailToSlider, sliderToDetail } from "../utils/sliderUtils";
import "../styles/07-modals-menus.css";

export default function SettingsModal({
  isOpen,
  onClose,
  onOpenAppSettings,
  isCovered = false,
  timelineData,
  onUpdateTimeline,
  themeKey,
  defaultThemeKey,
  themes,
  fonts,
  onThemeChange,
  layoutOptions = [],
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [detailLevel, setDetailLevel] = useState(1);
  const [detailSlider, setDetailSlider] = useState(50);
  const [showDetailTooltip, setShowDetailTooltip] = useState(false);
  const [detailTooltipLeft, setDetailTooltipLeft] = useState(0);
  const [layout, setLayout] = useState("Horizontal");
  const [theme, setTheme] = useState(defaultThemeKey || "");
  const [fontFamily, setFontFamily] = useState("default");
  const [useMonths, setUseMonths] = useState(false);
  const [scaleSections, setScaleSections] = useState([]);
  const [negID, setNegID] = useState("");
  const [posID, setPosID] = useState("");
  const [branchOrdering, setBranchOrdering] = useState("later-first");
  const [fixedEventHeight, setFixedEventHeight] = useState(false);
  const [hideDecimals, setHideDecimals] = useState(false);
  const [settingsSection, setSettingsSection] = useState("general");
  const [isInitialized, setIsInitialized] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [scaleSectionErrors, setScaleSectionErrors] = useState([]);
  const saveTimeoutRef = useRef(null);
  const detailSliderRef = useRef(null);
  const lastFilePathRef = useRef(null);
  const backdropPointerDownRef = useRef(false);

  const sanitizeTitle = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Convert stored scale sections (numeric) to editable (strings for inputs)
  const loadScaleSections = (stored = [], legacyBreaks = []) => {
    const source = Array.isArray(stored) && stored.length > 0
      ? stored
      : Array.isArray(legacyBreaks) && legacyBreaks.length > 0
        ? legacyBreaks.map((b) => ({ ...b, scale: 0 }))
        : [];
    if (source.length === 0) return [];
    return source.map((item) => ({
      start: String(item?.start ?? ""),
      end: String(item?.end ?? ""),
      scale: String(item?.scale ?? "0"),
    }));
  };

  // Validate a single scale section entry
  const validateScaleSection = (item) => {
    const startRaw = item?.start?.trim() || "";
    const endRaw = item?.end?.trim() || "";
    const scaleRaw = item?.scale?.trim() || "";
    if (!startRaw && !endRaw && !scaleRaw) return null;
    if (!startRaw || !endRaw) return "Both start and end required";

    const parsedStart = parseTimelineInput(startRaw);
    const parsedEnd = parseTimelineInput(endRaw);
    if (!Number.isFinite(parsedStart.value)) return "Invalid start date";
    if (!Number.isFinite(parsedEnd.value)) return "Invalid end date";
    if (parsedStart.value === parsedEnd.value) return "Start and end must differ";

    const scaleNum = Number(scaleRaw);
    if (!Number.isFinite(scaleNum) || scaleNum < 0 || scaleNum > 2) return "Scale must be 0–2";
    return null;
  };

  // Convert editable scale sections (strings) to numeric for saving
  const saveScaleSections = (editable = []) => {
    const out = [];
    const errors = [];
    editable.forEach((item, index) => {
      const error = validateScaleSection(item);
      errors[index] = error;

      if (error) return;
      const startRaw = item?.start?.trim() || "";
      const endRaw = item?.end?.trim() || "";
      if (!startRaw || !endRaw) return;

      const parsedStart = parseTimelineInput(startRaw);
      const parsedEnd = parseTimelineInput(endRaw);

      const startVal = parsedStart.value;
      const endVal = parsedEnd.value;
      const scale = Math.max(0, Math.min(2, Number(item?.scale) || 0));

      const ordered = startVal < endVal
        ? { start: startVal, end: endVal, scale }
        : { start: endVal, end: startVal, scale };
      out.push(ordered);
    });
    setScaleSectionErrors(errors);
    return out;
  };

  const addScaleSection = () => {
    setScaleSections([...scaleSections, { start: "", end: "", scale: "0" }]);
    setScaleSectionErrors((prev) => [...prev, null]);
  };

  const removeScaleSection = (index) => {
    setScaleSections(scaleSections.filter((_, i) => i !== index));
    setScaleSectionErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const updateScaleSection = (index, field, value) => {
    const next = scaleSections.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    setScaleSections(next);
    setScaleSectionErrors((prev) => {
      const nextErrors = [...prev];
      nextErrors[index] = validateScaleSection(next[index]);
      return nextErrors;
    });
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
        setFontFamily(timelineData.file.font || "default");
        setLayout(timelineData.file.layout || "Horizontal");
        setUseMonths(Boolean(timelineData.file.useMonths));
        setScaleSections(loadScaleSections(timelineData.file.scaleSections, timelineData.file.breaks));
        setNegID(timelineData.file.negID || "");
        setPosID(timelineData.file.posID || "");
        setBranchOrdering(timelineData.file.branchOrdering || "later-first");
        setFixedEventHeight(Boolean(timelineData.file.fixedEventHeight));
        setHideDecimals(Boolean(timelineData.file.hideDecimals));
        setValidationErrors([]);
        setScaleSectionErrors([]);
        lastFilePathRef.current = currentPath;
        setIsInitialized(true);
      }
    }
  }, [timelineData]);

  useEffect(() => {
    if (!layoutOptions.some((option) => option.value === layout)) {
      setLayout("Horizontal");
    }
  }, [layoutOptions, layout]);

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
      const errors = [];

      if (!title.trim()) {
        errors.push("Timeline name is required.");
      } else if (!sanitizeTitle(title)) {
        errors.push("Timeline name must include at least one letter or number.");
      }

      if (!Number.isFinite(parsedStart.value)) {
        errors.push("Start point must be a number or MM/DD/YYYY.");
      }
      if (!Number.isFinite(parsedEnd.value)) {
        errors.push("End point must be a number or MM/DD/YYYY.");
      }
      if (
        Number.isFinite(parsedStart.value) &&
        Number.isFinite(parsedEnd.value) &&
        parsedStart.value >= parsedEnd.value
      ) {
        errors.push("Start point must be less than end point.");
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      setValidationErrors([]);

      const startValue =
        useMonths && parsedStart.precision !== "day"
          ? snapToMonthGrid(parsedStart.value)
          : parsedStart.value;
      const endValue =
        useMonths && parsedEnd.precision !== "day"
          ? snapToMonthGrid(parsedEnd.value)
          : parsedEnd.value;
      const parsedScaleSections = saveScaleSections(scaleSections);
      if (onUpdateTimeline) {
        onUpdateTimeline({
          title,
          start: startValue,
          end: endValue,
          detailLevel: Number(detailLevel),
          negID,
          posID,
          theme,
          font: fontFamily,
          startLabel: parsedStart.label,
          endLabel: parsedEnd.label,
          useMonths,
          scaleSections: parsedScaleSections,
          layout,
          branchOrdering,
          fixedEventHeight,
          hideDecimals,
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
    fontFamily,
    useMonths,
    layout,
    scaleSections,
    branchOrdering,
    fixedEventHeight,
    hideDecimals,
  ]);

  if (!isOpen) return null;

  const fontNames = Array.from(
    new Set(
      (fonts || [])
        .map((font) => font?.name?.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const fontOptions = [
    { value: "default", label: "Default (App Font)" },
    { value: "Inter", label: "Inter" },
    ...fontNames.map((name) => ({ value: name, label: name })),
  ];

  if (fontFamily && !fontOptions.some((option) => option.value === fontFamily)) {
    fontOptions.unshift({
      value: fontFamily,
      label: `${fontFamily} (Missing)`,
    });
  }

  const handleBackdropMouseDown = (e) => {
    backdropPointerDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e) => {
    if (backdropPointerDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    backdropPointerDownRef.current = false;
  };

  return (
    <div
      className={`settings-backdrop${isCovered ? " is-covered" : ""}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
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

        {validationErrors.length > 0 && (
          <div className="settings-errors">
            {validationErrors.map((error, index) => (
              <div key={index} className="settings-error">
                {error}
              </div>
            ))}
          </div>
        )}

        <div className="settings-layout">
          <div className="settings-sidebar">
            <button
              type="button"
              className={`settings-sidebar-item${settingsSection === "general" ? " is-active" : ""}`}
              onClick={() => setSettingsSection("general")}
            >
              General
            </button>
            <button
              type="button"
              className={`settings-sidebar-item${settingsSection === "appearance" ? " is-active" : ""}`}
              onClick={() => setSettingsSection("appearance")}
            >
              Appearance
            </button>
            <button
              type="button"
              className={`settings-sidebar-item${settingsSection === "advanced" ? " is-active" : ""}`}
              onClick={() => setSettingsSection("advanced")}
            >
              Advanced
            </button>
          </div>

          <div className="settings-content">
          {settingsSection === "general" && (
            <>
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">App Settings</div>
                <div className="settings-row-description">
                  Open global settings for themes, files, and plugins.
                </div>
              </div>
              <div className="settings-row-right">
                <button
                  type="button"
                  className="settings-folder-button"
                  onClick={onOpenAppSettings}
                >
                  Open App Settings
                </button>
              </div>
            </div>
            {/* Timeline Name */}
            <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Name</div>
              <div className="settings-row-description">Your file will be saved as: {sanitizeTitle(title) || "untitled"}.timeline</div>
            </div>
            <div className="settings-row-right">
              <input
                type="text"
                className="settings-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationErrors.length) setValidationErrors([]);
                }}
                placeholder="Enter timeline name"
                maxLength={100}
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
                onChange={(e) => {
                  setStart(e.target.value);
                  if (validationErrors.length) setValidationErrors([]);
                }}
                maxLength={20}
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
                onChange={(e) => {
                  setEnd(e.target.value);
                  if (validationErrors.length) setValidationErrors([]);
                }}
                maxLength={20}
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

          {/* Scale Sections */}
          <div className="settings-row settings-row-scale-sections">
            <div className="settings-row-left">
              <div className="settings-row-label">Scale Sections</div>
              <div className="settings-row-description">
                Squish or stretch spans of time.
              </div>
            </div>
            <div className="settings-row-right settings-scale-sections-container">
              {scaleSections.map((section, index) => (
                <div key={index} className="settings-scale-section-row-wrap">
                  <div className="settings-scale-section-row">
                    <input
                      type="text"
                      className={`settings-input settings-scale-section-input ${scaleSectionErrors[index] ? 'settings-input-error' : ''}`}
                      value={section.start}
                      onChange={(e) => updateScaleSection(index, "start", e.target.value)}
                      placeholder="Start"
                      maxLength={20}
                    />
                    <span className="settings-scale-section-separator">–</span>
                    <input
                      type="text"
                      className={`settings-input settings-scale-section-input ${scaleSectionErrors[index] ? 'settings-input-error' : ''}`}
                      value={section.end}
                      onChange={(e) => updateScaleSection(index, "end", e.target.value)}
                      placeholder="End"
                      maxLength={20}
                    />
                    <input
                      type="number"
                      className={`settings-input settings-scale-section-scale ${scaleSectionErrors[index] ? 'settings-input-error' : ''}`}
                      value={section.scale}
                      onChange={(e) => updateScaleSection(index, "scale", e.target.value)}
                      placeholder="Scale"
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <button
                      type="button"
                      className="settings-scale-section-remove"
                      onClick={() => removeScaleSection(index)}
                      aria-label="Remove scale section"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {scaleSectionErrors[index] && (
                    <div className="settings-scale-section-error">{scaleSectionErrors[index]}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="settings-scale-section-add"
                onClick={addScaleSection}
              >
                <Plus size={14} />
                <span>Add Section</span>
              </button>
            </div>
          </div>
          

            </>
          )}

          {settingsSection === "appearance" && (
            <>
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

              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-row-label">Font</div>
                  <div className="settings-row-description">Choose a font for this timeline.</div>
                </div>
                <div className="settings-row-right">
                  <select
                    className="settings-select"
                    value={fontFamily || "default"}
                    onChange={(e) => setFontFamily(e.target.value)}
                  >
                    {fontOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {settingsSection === "advanced" && (
            <>
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

              {/* Fixed Event Height */}
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-row-label">Fixed Event Height</div>
                  <div className="settings-row-description">Lock all events to a single-line height, truncating long titles with ellipsis.</div>
                </div>
                <div className="settings-row-right">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={fixedEventHeight}
                      onChange={(e) => setFixedEventHeight(e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </div>
              </div>

              {/* Hide Decimals */}
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-row-label">Hide Decimals</div>
                  <div className="settings-row-description">Round displayed years to whole numbers (e.g., -323.5 shows as 323 BC).</div>
                </div>
                <div className="settings-row-right">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={hideDecimals}
                      onChange={(e) => setHideDecimals(e.target.checked)}
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
                    maxLength={10}
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
                    maxLength={10}
                  />
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
