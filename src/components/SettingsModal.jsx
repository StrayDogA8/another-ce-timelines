import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import "../styles/07-modals-menus.css";

export default function SettingsModal({ isOpen, onClose, timelineData, onUpdateTimeline }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [detailLevel, setDetailLevel] = useState(1);
  const [layout, setLayout] = useState("Horizontal");
  const [negID, setNegID] = useState("BCE");
  const [posID, setPosID] = useState("CE");
  const [showCenterTimeline, setShowCenterTimeline] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (timelineData?.file) {
      setTitle(timelineData.file.title || "");
      setStart(timelineData.file.start || 0);
      setEnd(timelineData.file.end || 0);
      setDetailLevel(timelineData.file.detailLevel || 1);
      setNegID(timelineData.file.negID || "BCE");
      setPosID(timelineData.file.posID || "CE");
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
      if (onUpdateTimeline) {
        onUpdateTimeline({
          title,
          start: Number(start),
          end: Number(end),
          detailLevel: Number(detailLevel),
          negID,
          posID,
        });
      }
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, start, end, detailLevel, negID, posID]);

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
              <div className="settings-row-label">Layout</div>
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
              <div className="settings-row-label">Detail Level</div>
              <div className="settings-row-description">Multiplier for zoom level. 1 is default, 0.2 is most zoomed out, 5 is most zoomed in.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="range"
                min="0.2"
                max="5"
                step="0.1"
                className="settings-slider"
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value)}
                title={`Detail Level: ${detailLevel}x`}
              />
              <span className="settings-value">{Number(detailLevel).toFixed(1)}x</span>
            </div>
          </div>

          <div className="settings-row no-border-bottom">
            <div className="settings-row-left">
              <div className="settings-row-label">Start Point</div>
              <div className="settings-row-description">The first year/date shown on the timeline.</div>
            </div>
            <div className="settings-row-right">
              <input
                type="number"
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
                type="number"
                className="settings-input settings-input-small"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-row no-border-bottom">
            <div className="settings-row-left">
              <div className="settings-row-label">Negative Era</div>
              <div className="settings-row-description">Default: B.C.E</div>
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
              <div className="settings-row-description">Default: C.E.</div>
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
