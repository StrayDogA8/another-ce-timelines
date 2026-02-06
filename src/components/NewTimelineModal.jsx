import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { parseTimelineInput } from "../utils/dateUtils";
import { DETAIL_MIN, DETAIL_MID, DETAIL_MAX, detailToSlider, sliderToDetail } from "../utils/sliderUtils";
import "../styles/07-modals-menus.css";

export default function NewTimelineModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("2024");
  const [detailLevel, setDetailLevel] = useState(1);
  const [detailSlider, setDetailSlider] = useState(50);
  const [showDetailTooltip, setShowDetailTooltip] = useState(false);
  const [detailTooltipLeft, setDetailTooltipLeft] = useState(0);
  const [validationErrors, setValidationErrors] = useState([]);
  const detailSliderRef = useRef(null);

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

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const sanitizeFilename = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreate = () => {
    const errors = [];
    if (!title.trim()) {
      errors.push("Please enter a timeline name.");
    }

    const sanitized = sanitizeFilename(title);
    if (!sanitized) {
      errors.push("Timeline name must contain at least one letter or number.");
    }

    const parsedStart = parseTimelineInput(start);
    const parsedEnd = parseTimelineInput(end);
    const startValue = parsedStart.value;
    const endValue = parsedEnd.value;

    if (!Number.isFinite(startValue)) {
      errors.push("Start point must be a number or MM/DD/YYYY.");
    }

    if (!Number.isFinite(endValue)) {
      errors.push("End point must be a number or MM/DD/YYYY.");
    }

    if (Number.isFinite(startValue) && Number.isFinite(endValue) && startValue >= endValue) {
      errors.push("Start point must be less than end point.");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    onCreate({
      title: title.trim(),
      start: startValue,
      end: endValue,
      detailLevel: Number(detailLevel),
      startLabel: parsedStart.label,
      endLabel: parsedEnd.label,
    });
  };

  const handleCancel = () => {
    // Reset form
    setTitle("");
    setStart("0");
    setEnd("2024");
    setDetailLevel(1);
    setDetailSlider(50);
    setValidationErrors([]);
    onClose();
  };

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal">
        <div className="settings-header">
          <button
            className="settings-back-button"
            onClick={handleCancel}
            aria-label="Close"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className="settings-title">NEW TIMELINE</h2>
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

        <div className="settings-content">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Name</div>
              <div className="settings-row-description">Your file will be saved as: {title ? title.toLowerCase().replace(/\s+/g, '-') : 'untitled'}.timeline</div>
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
                autoFocus
                maxLength={100}
              />
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
                onChange={(e) => {
                  setStart(e.target.value);
                  if (validationErrors.length) setValidationErrors([]);
                }}
                maxLength={20}
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
                onChange={(e) => {
                  setEnd(e.target.value);
                  if (validationErrors.length) setValidationErrors([]);
                }}
                maxLength={20}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Timeline Length</div>
              <div className="settings-row-description">Higher values let you add more events between years.</div>
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

        </div>

        <div className="settings-footer">
          <button className="settings-footer-button settings-cancel-button" onClick={handleCancel}>
            Cancel
          </button>
          <button className="settings-footer-button settings-create-button" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
