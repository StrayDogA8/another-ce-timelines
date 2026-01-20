import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { parseTimelineInput } from "../utils/dateUtils";
import "../styles/07-modals-menus.css";

export default function NewTimelineModal({ isOpen, onClose, onCreate }) {
  const DETAIL_MIN = 0.2;
  const DETAIL_MID = 1;
  const DETAIL_MAX = 5;
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("2024");
  const [detailLevel, setDetailLevel] = useState(1);
  const [detailSlider, setDetailSlider] = useState(50);
  const [showDetailTooltip, setShowDetailTooltip] = useState(false);
  const [detailTooltipLeft, setDetailTooltipLeft] = useState(0);
  const [negID, setNegID] = useState("");
  const [posID, setPosID] = useState("");
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

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert("Please enter a timeline name");
      return;
    }

    const parsedStart = parseTimelineInput(start);
    const parsedEnd = parseTimelineInput(end);

    onCreate({
      title: title.trim(),
      start: parsedStart.value,
      end: parsedEnd.value,
      detailLevel: Number(detailLevel),
      negID,
      posID,
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
    setNegID("");
    setPosID("");
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
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter timeline name"
                autoFocus
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Detail Level</div>
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
