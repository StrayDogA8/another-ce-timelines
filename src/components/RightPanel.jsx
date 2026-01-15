import { useState, useEffect } from "react";
import { X, Trash2, Copy, Check, Edit2, ChevronDown, ChevronRight } from "lucide-react";

export default function RightPanel({ onSelect, selectedElement, onUpdate, onDelete, timelineData }) {
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isForksOpen, setIsForksOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);

  useEffect(() => {
    if (selectedElement) {
      setFormData({ ...selectedElement });
      setValidationErrors([]);
      setIsEditMode(false);
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
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setFormData({ ...selectedElement });
    setValidationErrors([]);
    setIsEditMode(false);
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
          <h2>{formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}</h2>
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
            {!isEditMode && (
              <button
                className="copy-id-button"
                onClick={() => setIsEditMode(true)}
                title="Edit"
                type="button"
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>
        </div>
        <button className="close-button" onClick={handleClose} title="Close panel">
          <X size={20} />
        </button>
      </div>

      <div className="right-panel-content">
        {!isEditMode ? (
          /* View Mode */
          <div className="view-mode">
            {/* Title */}
            <div className="view-group">
              <label>Name</label>
              <div className="view-separator" />
              <p>{formData.title}</p>
            </div>

            {/* Date/Start/End based on type */}
            {formData.type === "event" ? (
              <div className="view-group">
                <label>Date</label>
                <div className="view-separator" />
                <p>{formData.date}</p>
              </div>
            ) : (
              <>
                <div className="view-group">
                  <label>Start Year</label>
                  <div className="view-separator" />
                  <p>{formData.start}</p>
                </div>
                <div className="view-group">
                  <label>End Year</label>
                  <div className="view-separator" />
                  <p>{formData.end}</p>
                </div>
              </>
            )}

            {/* Color (spans and eras only) */}
            {formData.type !== "event" && (
              <>
                <div className="color-group-solo">
                  <button
                    type="button"
                    className="color-toggle"
                    onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
                  >
                    {isColorMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <label>Color</label>
                  </button>
                </div>
                {isColorMenuOpen && (
                  <div className="color-picker-menu">
                    {[
                      '#8B7D6B', '#9B6B6B', '#C87D4A', '#D4C25A',
                      '#6B8B6B', '#6B8B8B', '#6B7B8B'
                    ].map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="color-option"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          handleChange("color", color);
                          onUpdate({ ...formData, color });
                        }}
                      />
                    ))}
                    <label className="color-option color-picker-option">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => {
                          handleChange("color", e.target.value);
                          onUpdate({ ...formData, color: e.target.value });
                        }}
                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                      />
                      <div className="color-picker-icon">+</div>
                    </label>
                  </div>
                )}
              </>
            )}

            {/* Parent (events only) */}
            {formData.type === "event" && (
              <div className="view-group">
                <label>Parent</label>
                <div className="view-separator" />
                {formData.parents && formData.parents.length > 0 && formData.parents[0] ? (
                  <button
                    type="button"
                    className="parent-link"
                    onClick={() => onSelect(formData.parents[0])}
                  >
                    {timelineData.elements.find(el => el.id === formData.parents[0])?.title || formData.parents[0]}
                  </button>
                ) : (
                  <p>None</p>
                )}
              </div>
            )}

            {/* Branches (spans only) */}
            {formData.type === "span" && (
              <>
                <div className="color-group-solo">
                  <button
                    type="button"
                    className="color-toggle"
                    onClick={() => setIsBranchesOpen(!isBranchesOpen)}
                  >
                    {isBranchesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <label>Branches</label>
                  </button>
                </div>
                {isBranchesOpen && (
                  <div className="dropdown-content">
                    {formData.branches && formData.branches.length > 0 ? (
                      formData.branches.map((branchId, index) => {
                        const branchElement = timelineData.elements.find(el => el.id === branchId);
                        return (
                          <div key={index} className="dropdown-item">
                            <button
                              type="button"
                              className="dropdown-link"
                              onClick={() => onSelect(branchId)}
                            >
                              {branchElement?.title || branchId}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="dropdown-item">None</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Forks (spans only) */}
            {formData.type === "span" && (
              <>
                <div className="color-group-solo">
                  <button
                    type="button"
                    className="color-toggle"
                    onClick={() => setIsForksOpen(!isForksOpen)}
                  >
                    {isForksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <label>Forks</label>
                  </button>
                </div>
                {isForksOpen && (
                  <div className="dropdown-content">
                    {formData.forks && formData.forks.length > 0 ? (
                      formData.forks.map((forkId, index) => {
                        const forkElement = timelineData.elements.find(el => el.id === forkId);
                        return (
                          <div key={index} className="dropdown-item">
                            <span className="fork-position">{index === 0 ? 'top' : 'bottom'}</span>
                            <button
                              type="button"
                              className="dropdown-link"
                              onClick={() => onSelect(forkId)}
                            >
                              {forkElement?.title || forkId}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="dropdown-item">None</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Description (all types) */}
            {formData.description && (
              <>
                <div className="color-group-solo">
                  <button
                    type="button"
                    className="color-toggle"
                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                  >
                    {isDescriptionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <label>Description</label>
                  </button>
                </div>
                {isDescriptionOpen && (
                  <div className="description-content">
                    {formData.description}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Edit Mode */
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

            {/* Color (spans and eras only) */}
            {formData.type !== "event" && (
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
            )}

            {/* Parent (events only) */}
            {formData.type === "event" && (
              <div className="form-group">
                <label htmlFor="parents">Parent (span ID)</label>
                <input
                  id="parents"
                  type="text"
                  value={formData.parents?.[0] || ""}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    handleChange("parents", value ? [value] : []);
                  }}
                  placeholder="span-id"
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

            {/* Description (all types) */}
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Enter a description..."
                rows={4}
                style={{
                  padding: '6px 8px',
                  border: '1px solid var(--active-bg)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  backgroundColor: 'white',
                  color: 'var(--dark-bg)',
                  width: '100%',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Action buttons */}
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
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
        )}
      </div>
    </div>
  );
}
