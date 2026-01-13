import { useState, useEffect } from "react";
import { X, Trash2, Copy, Check } from "lucide-react";

export default function RightPanel({ onSelect, selectedElement, onUpdate, onDelete, timelineData }) {
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedElement) {
      setFormData({ ...selectedElement });
      setValidationErrors([]);
    }
  }, [selectedElement]);

  if (!selectedElement || !formData) {
    return (
      <div className="right-panel">
        <div className="right-panel-header">
          <h2>No Selection</h2>
        </div>
      </div>
    );
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === "date" || field === "parents") {
      setValidationErrors([]);
    }
  };

  const validateEventParents = () => {
    const errors = [];

    if (formData.type === "event" && formData.parents && formData.parents.length > 0) {
      const spans = timelineData.elements.filter(el => el.type === "span");
      const eventDate = formData.date;

      formData.parents.forEach(parentId => {
        const parentSpan = spans.find(span => span.id === parentId);

        if (!parentSpan) {
          errors.push(`Parent span "${parentId}" not found`);
        } else if (eventDate < parentSpan.start || eventDate > parentSpan.end) {
          errors.push(
            `Event date ${eventDate} is outside parent span "${parentSpan.title}" range (${parentSpan.start}-${parentSpan.end})`
          );
        }
      });
    }

    return errors;
  };

  const handleSave = () => {
    const errors = validateEventParents();

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    if (onUpdate) {
      onUpdate(formData);
    }
  };

  const handleClose = () => {
    onSelect(null);
  };

  const handleTagsChange = (value) => {
    const tags = value.split(",").map(t => t.trim()).filter(Boolean);
    handleChange("tags", tags);
  };

  const handleArrayChange = (field, value) => {
    const arr = value.split(",").map(t => t.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, [field]: arr }));
    // Clear validation errors when updating parents
    if (field === "parents") {
      setValidationErrors([]);
    }
  };

  const handleDelete = () => {
    const confirmMessage = `Are you sure you want to delete this ${formData.type}?\n\nTitle: ${formData.title}\nID: ${formData.id}\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      onDelete(formData.id);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(formData.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  return (
    <div className="right-panel">
      <div className="right-panel-header">
        <div>
          <h2>Edit {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}</h2>
          <div className="element-id-container">
            <p className="element-id">{formData.id}</p>
            <button
              className="copy-id-button"
              onClick={handleCopyId}
              title="Copy ID to clipboard"
              type="button"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <button className="close-button" onClick={handleClose} title="Close panel">
          <X size={20} />
        </button>
      </div>

      <div className="right-panel-content">
        <form className="edit-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              {validationErrors.map((error, idx) => (
                <div key={idx} className="validation-error">
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
            />
          </div>

          {/* Date/Start/End based on type */}
          {formData.type === "event" ? (
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="number"
                value={formData.date}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  handleChange("date", isNaN(value) ? 0 : value);
                }}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="start">Start Year</label>
                <input
                  id="start"
                  type="number"
                  value={formData.start}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    handleChange("start", isNaN(value) ? 0 : value);
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="end">End Year</label>
                <input
                  id="end"
                  type="number"
                  value={formData.end}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    handleChange("end", isNaN(value) ? 0 : value);
                  }}
                />
              </div>
            </>
          )}

          {/* Color */}
          <div className="form-group">
            <label htmlFor="color">Color</label>
            <div className="color-input-group">
              <input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className="color-picker"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className="color-text"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Importance (events only) */}
          {formData.type === "event" && (
            <div className="form-group">
              <label htmlFor="importance">Importance (1-5)</label>
              <input
                id="importance"
                type="number"
                min="1"
                max="5"
                value={formData.importance || 3}
                onChange={(e) => {
                  const value = e.target.value === '' ? 3 : parseInt(e.target.value, 10);
                  handleChange("importance", isNaN(value) ? 3 : value);
                }}
              />
            </div>
          )}

          {/* Parents (events only) */}
          {formData.type === "event" && (
            <div className="form-group">
              <label htmlFor="parents">Parents (comma-separated IDs)</label>
              <input
                id="parents"
                type="text"
                value={formData.parents?.join(", ") || ""}
                onChange={(e) => handleArrayChange("parents", e.target.value)}
                placeholder="span-id-1, span-id-2"
              />
            </div>
          )}

          {/* Branches (spans only) */}
          {formData.type === "span" && (
            <div className="form-group">
              <label htmlFor="branches">Branches (comma-separated IDs)</label>
              <input
                id="branches"
                type="text"
                value={formData.branches?.join(", ") || ""}
                onChange={(e) => handleArrayChange("branches", e.target.value)}
                placeholder="span-id-1, span-id-2"
              />
            </div>
          )}

          {/* Forks (spans only) */}
          {formData.type === "span" && (
            <div className="form-group">
              <label htmlFor="forks">Forks (comma-separated IDs)</label>
              <input
                id="forks"
                type="text"
                value={formData.forks?.join(", ") || ""}
                onChange={(e) => handleArrayChange("forks", e.target.value)}
                placeholder="span-id-1, span-id-2"
              />
            </div>
          )}

          {/* Tags */}
          <div className="form-group">
            <label htmlFor="tags">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              value={formData.tags?.join(", ") || ""}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          {/* Action buttons */}
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
          </div>

          {/* Delete button */}
          <div className="form-delete-section">
            <button type="button" className="btn-delete" onClick={handleDelete}>
              <Trash2 size={16} />
              Delete {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
