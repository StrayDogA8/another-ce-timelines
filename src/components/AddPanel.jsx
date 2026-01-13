import { Plus } from "lucide-react";

export default function AddPanel({ onAddEvent, onAddSpan, onAddEra, zoom, timelineHeight }) {
  return (
    <div className="add-panel">
      <button
        className="add-button add-event"
        onClick={onAddEvent}
        title="Add Event"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>Event</span>
      </button>

      <button
        className="add-button add-span"
        onClick={onAddSpan}
        title="Add Span"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>Span</span>
      </button>

      <button
        className="add-button add-era"
        onClick={onAddEra}
        title="Add Era"
      >
        <Plus size={16} strokeWidth={2.5} />
        <span>Era</span>
      </button>

      <div className="devmode">
        <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
        <div>Height: {timelineHeight}px</div>
      </div>
    </div>
  );
}
