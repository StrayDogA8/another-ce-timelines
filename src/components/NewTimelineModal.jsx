import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import "../styles/07-modals-menus.css";

export default function NewTimelineModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(2024);
  const [detailLevel, setDetailLevel] = useState(5);
  const [negID, setNegID] = useState("BCE");
  const [posID, setPosID] = useState("CE");

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

    onCreate({
      title: title.trim(),
      start: Number(start),
      end: Number(end),
      detailLevel: Number(detailLevel),
      negID,
      posID,
    });
  };

  const handleCancel = () => {
    // Reset form
    setTitle("");
    setStart(0);
    setEnd(2024);
    setDetailLevel(5);
    setNegID("BCE");
    setPosID("CE");
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
              <input
                type="range"
                min="1"
                max="20"
                className="settings-slider"
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value)}
                title={`Detail Level: ${detailLevel}`}
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
