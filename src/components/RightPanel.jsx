import { useState, useEffect, useRef } from "react";
import { Copy, Check, Edit2, Eye, ChevronDown, ChevronRight, Maximize2, Minimize2, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Underline, Highlighter, Link2 } from "lucide-react";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import { marked } from "marked";
import { createNote, readNote, writeNote } from "../utils/electronApi";

export default function RightPanel({
  onSelect,
  selectedElement,
  onUpdate,
  onDelete,
  timelineData,
  editRequestId,
  onEditRequestHandled,
  isMaximized,
  onToggleMaximize,
}) {
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isForksOpen, setIsForksOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const prevSelectedIdRef = useRef(null);

  useEffect(() => {
    if (selectedElement) {
      const prevId = prevSelectedIdRef.current;
      setFormData({
        ...selectedElement,
        dateInput: selectedElement.dateLabel ?? selectedElement.date ?? "",
        startInput: selectedElement.startLabel ?? selectedElement.start ?? "",
        endInput: selectedElement.endLabel ?? selectedElement.end ?? "",
      });
      setValidationErrors([]);
      if (prevId !== selectedElement.id) {
        setIsEditMode(false);
      }
      prevSelectedIdRef.current = selectedElement.id;
    }
  }, [selectedElement]);

  useEffect(() => {
    let isMounted = true;
    const loadNote = async () => {
      if (!selectedElement?.noteFile) {
        setNoteContent("");
        return;
      }
      const timelineId = timelineData?.file?.id?.replace('-timeline', '');
      if (!timelineId) return;
      setIsNoteLoading(true);
      const result = await readNote({ timelineId, filename: selectedElement.noteFile });
      if (!isMounted) return;
      setIsNoteLoading(false);
      if (result?.success) {
        setNoteContent(result.content ?? "");
      } else {
        setNoteContent("");
      }
    };

    loadNote();
    return () => {
      isMounted = false;
    };
  }, [selectedElement, timelineData]);


  useEffect(() => {
    if (!selectedElement || !editRequestId) return;
    if (selectedElement.id !== editRequestId) return;
    setIsEditMode(true);
    onEditRequestHandled?.();
  }, [selectedElement, editRequestId, onEditRequestHandled]);

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
    if (field === "dateInput" || field === "parents") {
      setValidationErrors([]);
    }
  };

  const validateEventParents = (draft) => {
    const errors = [];

    if (draft.type === "event" && draft.parents && draft.parents.length > 0) {
      const spans = timelineData.elements.filter(el => el.type === "span");
      const eventDate = parseTimelineInput(draft.dateInput).value;

      if (eventDate === null) {
        errors.push("Event date must be a number or MM/DD/YYYY.");
        return errors;
      }

      draft.parents.forEach(parentId => {
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

  const stripInputs = (data) => {
    const { dateInput, startInput, endInput, ...rest } = data;
    return rest;
  };

  const buildValidatedUpdate = (draft) => {
    const errors = validateEventParents(draft);
    const parsedDate = parseTimelineInput(draft.dateInput);
    const parsedStart = parseTimelineInput(draft.startInput);
    const parsedEnd = parseTimelineInput(draft.endInput);
    const useMonths = timelineData?.file?.useMonths === true;
    const timelineStart = timelineData?.file?.start;
    const timelineEnd = timelineData?.file?.end;

    if (draft.type === "event" && parsedDate.value === null) {
      errors.push("Event date must be a number or MM/DD/YYYY.");
    }
    if (draft.type !== "event" && (parsedStart.value === null || parsedEnd.value === null)) {
      errors.push("Start and end must be numbers or MM/DD/YYYY.");
    }
    if (draft.type === "event" && parsedDate.value !== null) {
      if (parsedDate.value < timelineStart || parsedDate.value > timelineEnd) {
        errors.push("Event date must be within the timeline bounds.");
      }
    }
    if (draft.type !== "event" && parsedStart.value !== null && parsedEnd.value !== null) {
      if (parsedStart.value < timelineStart || parsedEnd.value > timelineEnd) {
        errors.push("Span/Era range must be within the timeline bounds.");
      }
    }

    if (errors.length > 0) {
      return { errors, nextData: null };
    }

    const nextData = stripInputs({ ...draft });
    if (draft.type === "event") {
      nextData.date =
        useMonths && parsedDate.precision !== "day"
          ? snapToMonthGrid(parsedDate.value)
          : parsedDate.value;
      if (parsedDate.label) {
        nextData.dateLabel = parsedDate.label;
      } else {
        delete nextData.dateLabel;
      }
    } else {
      nextData.start =
        useMonths && parsedStart.precision !== "day"
          ? snapToMonthGrid(parsedStart.value)
          : parsedStart.value;
      nextData.end =
        useMonths && parsedEnd.precision !== "day"
          ? snapToMonthGrid(parsedEnd.value)
          : parsedEnd.value;
      if (parsedStart.label) {
        nextData.startLabel = parsedStart.label;
      } else {
        delete nextData.startLabel;
      }
      if (parsedEnd.label) {
        nextData.endLabel = parsedEnd.label;
      } else {
        delete nextData.endLabel;
      }
    }

    return { errors, nextData };
  };

  const commitDraft = (draft) => {
    const { errors, nextData } = buildValidatedUpdate(draft);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return false;
    }

    setValidationErrors([]);
    if (onUpdate) {
      onUpdate(nextData);
    }
    return true;
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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(formData.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  const handleAddNote = async () => {
    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;
    const result = await createNote({
      timelineId,
      title: formData.title,
      elementId: formData.id,
    });
    if (!result?.success) {
      console.error('Failed to create note:', result?.error);
      return;
    }
    const next = { ...formData, noteFile: result.filename };
    setFormData(next);
    onUpdate?.(next);
    setNoteContent(result?.content ?? `# ${formData.title}\n\n`);
  };

  const handleNoteSave = async () => {
    if (!formData?.noteFile) return;
    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;
    await writeNote({
      timelineId,
      filename: formData.noteFile,
      content: noteContent,
    });
  };

  const renderNoteMarkdown = (content, isLoading) => {
    const raw = isLoading ? "_Loading note..._" : content || "";
    const withUnderline = raw.replace(/__(.+?)__/g, "<u>$1</u>");
    const withHighlight = withUnderline.replace(/==(.+?)==/g, "<mark>$1</mark>");
    return marked.parse(withHighlight);
  };

  const wrapSelection = (prefix, suffix = prefix) => {
    const textarea = document.querySelector('.note-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const before = noteContent.slice(0, start);
    const selected = noteContent.slice(start, end);
    const after = noteContent.slice(end);
    const next = `${before}${prefix}${selected || ''}${suffix}${after}`;
    setNoteContent(next);

    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + (selected || '').length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const insertHeading = (level) => {
    const textarea = document.querySelector('.note-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const lineStart = noteContent.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = noteContent.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? noteContent.length : lineEnd;
    const line = noteContent.slice(lineStart, actualLineEnd);
    const cleaned = line.replace(/^#{1,6}\s+/, '');
    const prefix = `${'#'.repeat(level)} `;
    const nextLine = `${prefix}${cleaned}`;
    const next = `${noteContent.slice(0, lineStart)}${nextLine}${noteContent.slice(actualLineEnd)}`;
    setNoteContent(next);
    const cursor = lineStart + prefix.length + (start - lineStart);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const insertLink = () => {
    const textarea = document.querySelector('.note-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const before = noteContent.slice(0, start);
    const selected = noteContent.slice(start, end) || 'link text';
    const after = noteContent.slice(end);
    const token = `[${selected}](https://)`;
    const next = `${before}${token}${after}`;
    setNoteContent(next);
    const urlStart = before.length + token.indexOf('https://');
    const urlEnd = urlStart + 'https://'.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(urlStart, urlEnd);
    });
  };

  return (
    <div className={`right-panel ${isMaximized ? "is-maximized" : ""}`}>
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
            <button
              className="copy-id-button"
              onClick={() => setIsEditMode((prev) => !prev)}
              title={isEditMode ? "View details" : "Edit details"}
              type="button"
            >
              {isEditMode ? <Eye size={14} /> : <Edit2 size={14} />}
            </button>
          </div>
        </div>
        <button
          className="close-button"
          onClick={onToggleMaximize}
          title={isMaximized ? "Restore panel" : "Maximize panel"}
        >
          {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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
                  <p>{formData.dateLabel ?? formData.date}</p>
                </div>
            ) : (
              <>
                <div className="view-group">
                  <label>Start Year</label>
                  <div className="view-separator" />
                  <p>{formData.startLabel ?? formData.start}</p>
                </div>
                <div className="view-group">
                  <label>End Year</label>
                  <div className="view-separator" />
                  <p>{formData.endLabel ?? formData.end}</p>
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
                          onUpdate({ ...stripInputs({ ...formData, color }) });
                        }}
                      />
                    ))}
                    <label className="color-option color-picker-option">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => {
                          handleChange("color", e.target.value);
                          onUpdate({ ...stripInputs({ ...formData, color: e.target.value }) });
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

            {formData.noteFile && (
              <>
                <div className="note-divider" />
                <div
                  className="note-render"
                  dangerouslySetInnerHTML={{
                    __html: renderNoteMarkdown(noteContent, isNoteLoading),
                  }}
                />
              </>
            )}
          </div>
        ) : (
          /* Edit Mode */
          <form
            id="right-panel-edit-form"
            className="edit-form"
            onSubmit={(e) => e.preventDefault()}
          >
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
              <div className="edit-row">
                <label htmlFor="title">Title</label>
                <div className="edit-separator" />
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  onBlur={(e) => commitDraft({ ...formData, title: e.target.value })}
                  className="edit-input"
                />
              </div>
            </div>

            {/* Date/Start/End based on type */}
            {formData.type === "event" ? (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="date">Date</label>
                  <div className="edit-separator" />
                  <input
                    id="date"
                    type="text"
                    inputMode="numeric"
                    value={formData.dateInput ?? ""}
                    onChange={(e) => {
                      handleChange("dateInput", e.target.value);
                    }}
                    onBlur={(e) => commitDraft({ ...formData, dateInput: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="start">Start Year</label>
                    <div className="edit-separator" />
                  <input
                    id="start"
                    type="text"
                    inputMode="numeric"
                    value={formData.startInput ?? ""}
                    onChange={(e) => {
                      handleChange("startInput", e.target.value);
                    }}
                    onBlur={(e) => commitDraft({ ...formData, startInput: e.target.value })}
                    className="edit-input"
                  />
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="end">End Year</label>
                    <div className="edit-separator" />
                  <input
                    id="end"
                    type="text"
                    inputMode="numeric"
                    value={formData.endInput ?? ""}
                    onChange={(e) => {
                      handleChange("endInput", e.target.value);
                    }}
                    onBlur={(e) => commitDraft({ ...formData, endInput: e.target.value })}
                    className="edit-input"
                  />
                  </div>
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
                <div className="edit-row">
                  <label htmlFor="parents">Parent</label>
                  <div className="edit-separator" />
                  <input
                    id="parents"
                    type="text"
                    value={formData.parents?.[0] || ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      handleChange("parents", value ? [value] : []);
                    }}
                    placeholder="span-id"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      commitDraft({ ...formData, parents: value ? [value] : [] });
                    }}
                    className="edit-input"
                  />
                </div>
              </div>
            )}

            {formData.type === "event" && (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="eventLineStyle">Line Style</label>
                    <div className="edit-separator" />
                    <div className="edit-select-wrap">
                      <select
                        id="eventLineStyle"
                        className="edit-select"
                        value={formData.eventLineStyle || "solid"}
                        onChange={(e) => handleChange("eventLineStyle", e.target.value)}
                        onBlur={(e) => commitDraft({ ...formData, eventLineStyle: e.target.value })}
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="eventBorderStyle">Border Style</label>
                    <div className="edit-separator" />
                    <div className="edit-select-wrap">
                      <select
                        id="eventBorderStyle"
                        className="edit-select"
                        value={formData.eventBorderStyle || "solid"}
                        onChange={(e) => handleChange("eventBorderStyle", e.target.value)}
                        onBlur={(e) => commitDraft({ ...formData, eventBorderStyle: e.target.value })}
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Branches (spans only) */}
            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="branches">Branches</label>
                  <div className="edit-separator" />
                  <input
                    id="branches"
                    type="text"
                    value={formData.branches?.join(", ") || ""}
                    onChange={(e) => handleArrayChange("branches", e.target.value)}
                    placeholder="span-id-1, span-id-2"
                    onBlur={(e) => {
                      const arr = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                      commitDraft({ ...formData, branches: arr });
                    }}
                    className="edit-input"
                  />
                </div>
              </div>
            )}

            {/* Forks (spans only) */}
            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="forks">Forks</label>
                  <div className="edit-separator" />
                  <input
                    id="forks"
                    type="text"
                    value={formData.forks?.join(", ") || ""}
                    onChange={(e) => handleArrayChange("forks", e.target.value)}
                    placeholder="span-id-1, span-id-2"
                    onBlur={(e) => {
                      const arr = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                      commitDraft({ ...formData, forks: arr });
                    }}
                    className="edit-input"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              {!formData.noteFile ? (
                <button type="button" className="btn-secondary btn-note" onClick={handleAddNote}>
                  Add Note
                </button>
              ) : (
                <div className="note-editor">
                  <div className="note-toolbar">
                    <button type="button" onClick={() => insertHeading(1)} title="Heading 1">
                      <Heading1 size={14} />
                    </button>
                    <button type="button" onClick={() => insertHeading(2)} title="Heading 2">
                      <Heading2 size={14} />
                    </button>
                    <button type="button" onClick={() => insertHeading(3)} title="Heading 3">
                      <Heading3 size={14} />
                    </button>
                    <div className="note-toolbar-divider" />
                    <button type="button" onClick={() => wrapSelection('**')} title="Bold">
                      <Bold size={14} />
                    </button>
                    <button type="button" onClick={() => wrapSelection('*')} title="Italic">
                      <Italic size={14} />
                    </button>
                    <button type="button" onClick={() => wrapSelection('~~')} title="Strikethrough">
                      <Strikethrough size={14} />
                    </button>
                    <button type="button" onClick={() => wrapSelection('__')} title="Underline">
                      <Underline size={14} />
                    </button>
                    <button type="button" onClick={() => wrapSelection('==')} title="Highlight">
                      <Highlighter size={14} />
                    </button>
                    <div className="note-toolbar-divider" />
                    <button type="button" onClick={insertLink} title="Link">
                      <Link2 size={14} />
                    </button>
                  </div>
                  <textarea
                    className="note-textarea"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    onBlur={handleNoteSave}
                    placeholder={isNoteLoading ? "Loading note..." : "Write your note..."}
                    rows={8}
                  />
                </div>
              )}
            </div>

          </form>
        )}
      </div>
    </div>
  );
}
