import { useState, useEffect, useRef, useMemo } from "react";
import { Copy, Check, Edit2, Eye, ChevronDown, ChevronRight, Maximize2, Minimize2, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Underline, Highlighter, Link2 } from "lucide-react";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import { formatYear } from "../utils/timelineUtils";
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
  const [noteContent, setNoteContent] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const prevSelectedIdRef = useRef(null);
  const [branchQuery, setBranchQuery] = useState("");
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const branchMenuTimeoutRef = useRef(null);
  const [parentQuery, setParentQuery] = useState("");
  const [isParentMenuOpen, setIsParentMenuOpen] = useState(false);
  const parentMenuTimeoutRef = useRef(null);
  const [tagQuery, setTagQuery] = useState("");
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuTimeoutRef = useRef(null);

  useEffect(() => {
    if (selectedElement) {
      const prevId = prevSelectedIdRef.current;
      setFormData({
        ...selectedElement,
        dateInput: selectedElement.dateLabel ?? selectedElement.date ?? "",
        startInput: selectedElement.startLabel ?? selectedElement.start ?? "",
        endInput: selectedElement.endLabel ?? selectedElement.end ?? "",
      });
      setParentQuery(selectedElement.parents?.[0] || "");
      setTagQuery("");
      setValidationErrors([]);
      if (prevId !== selectedElement.id) {
        setIsEditMode(false);
        setBranchQuery("");
        setIsBranchMenuOpen(false);
        setIsParentMenuOpen(false);
        setIsTagMenuOpen(false);
      }
      prevSelectedIdRef.current = selectedElement.id;
    }
  }, [selectedElement]);

  useEffect(() => {
    if (!isEditMode) {
      setBranchQuery("");
      setIsBranchMenuOpen(false);
      setIsParentMenuOpen(false);
      setIsTagMenuOpen(false);
    }
  }, [isEditMode]);

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

  const getSpanNumericStart = (span) => {
    const parsed = parseTimelineInput(span.startLabel ?? span.start);
    return parsed.value ?? span.start;
  };

  const getSpanNumericEnd = (span) => {
    const parsed = parseTimelineInput(span.endLabel ?? span.end);
    return parsed.value ?? span.end;
  };

  const parentRange = useMemo(() => {
    if (!formData || formData.type !== "span") return null;
    const parsedStart = parseTimelineInput(formData.startInput ?? formData.start);
    const parsedEnd = parseTimelineInput(formData.endInput ?? formData.end);
    const start = parsedStart.value ?? formData.start;
    const end = parsedEnd.value ?? formData.end;
    if (start === undefined || end === undefined || start === null || end === null) {
      return null;
    }
    return { start, end };
  }, [formData]);

  const parentCandidates = useMemo(() => {
    if (!timelineData || !formData || formData.type !== "event") return [];
    return timelineData.elements
      .filter((el) => el.type === "span")
      .map((span) => ({
        ...span,
        _start: getSpanNumericStart(span),
        _end: getSpanNumericEnd(span),
      }))
      .filter((span) => {
        if (!Number.isFinite(span._start) || !Number.isFinite(span._end)) return false;
        if (!formData.dateInput) return true;
        const parsedEventDate = parseTimelineInput(formData.dateInput).value;
        if (!Number.isFinite(parsedEventDate)) return true;
        return parsedEventDate >= span._start && parsedEventDate <= span._end;
      });
  }, [timelineData, formData]);

  const parentSuggestions = useMemo(() => {
    const needle = parentQuery.trim().toLowerCase();
    if (!needle) return parentCandidates;
    return parentCandidates.filter((span) =>
      span.id.toLowerCase().includes(needle) ||
      (span.title || "").toLowerCase().includes(needle)
    );
  }, [parentCandidates, parentQuery]);

  const branchCandidates = useMemo(() => {
    if (!timelineData || !formData || formData.type !== "span" || !parentRange) return [];
    const existing = new Set(formData.branches || []);
    return timelineData.elements
      .filter((el) => el.type === "span" && el.id !== formData.id)
      .map((span) => ({
        ...span,
        _start: getSpanNumericStart(span),
        _end: getSpanNumericEnd(span),
      }))
      .filter((span) => Number.isFinite(span._start) && span._start >= parentRange.start && span._start <= parentRange.end)
      .filter((span) => !existing.has(span.id));
  }, [timelineData, formData, parentRange]);

  const branchSuggestions = useMemo(() => {
    if (!branchQuery.trim()) return [];
    const needle = branchQuery.trim().toLowerCase();
    return branchCandidates.filter((span) =>
      span.id.toLowerCase().includes(needle) ||
      (span.title || "").toLowerCase().includes(needle)
    );
  }, [branchCandidates, branchQuery]);

  const tagCandidates = useMemo(() => {
    if (!timelineData) return [];
    const tags = new Set();
    timelineData.elements.forEach((element) => {
      if (Array.isArray(element.tags)) {
        element.tags.forEach((tag) => {
          if (tag) tags.add(tag);
        });
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [timelineData]);

  const tagSuggestions = useMemo(() => {
    const needle = tagQuery.trim().toLowerCase();
    if (!needle) return tagCandidates;
    return tagCandidates.filter((tag) => tag.toLowerCase().includes(needle));
  }, [tagCandidates, tagQuery]);

  const addBranch = (spanId) => {
    if (!spanId) return;
    const existing = Array.isArray(formData.branches) ? formData.branches : [];
    if (existing.includes(spanId)) return;
    const nextBranches = [...existing, spanId];
    setFormData((prev) => ({ ...prev, branches: nextBranches }));
    commitDraft({ ...formData, branches: nextBranches });
    setBranchQuery("");
  };

  const removeBranch = (spanId) => {
    const existing = Array.isArray(formData.branches) ? formData.branches : [];
    const nextBranches = existing.filter((id) => id !== spanId);
    setFormData((prev) => ({ ...prev, branches: nextBranches }));
    commitDraft({ ...formData, branches: nextBranches });
  };

  const handleBranchBlur = () => {
    if (branchMenuTimeoutRef.current) {
      clearTimeout(branchMenuTimeoutRef.current);
    }
    branchMenuTimeoutRef.current = setTimeout(() => {
      setIsBranchMenuOpen(false);
    }, 120);
  };

  const handleParentBlur = () => {
    if (parentMenuTimeoutRef.current) {
      clearTimeout(parentMenuTimeoutRef.current);
    }
    const trimmed = parentQuery.trim();
    handleChange("parents", trimmed ? [trimmed] : []);
    commitDraft({ ...formData, parents: trimmed ? [trimmed] : [] });
    parentMenuTimeoutRef.current = setTimeout(() => {
      setIsParentMenuOpen(false);
    }, 120);
  };

  const handleTagBlur = () => {
    if (tagMenuTimeoutRef.current) {
      clearTimeout(tagMenuTimeoutRef.current);
    }
    tagMenuTimeoutRef.current = setTimeout(() => {
      setIsTagMenuOpen(false);
    }, 120);
  };

  const addTag = (tag) => {
    if (!tag) return;
    const existing = Array.isArray(formData.tags) ? formData.tags : [];
    if (existing.includes(tag)) return;
    const nextTags = [...existing, tag];
    setFormData((prev) => ({ ...prev, tags: nextTags }));
    commitDraft({ ...formData, tags: nextTags });
    setTagQuery("");
  };

  const removeTag = (tag) => {
    const existing = Array.isArray(formData.tags) ? formData.tags : [];
    const nextTags = existing.filter((value) => value !== tag);
    setFormData((prev) => ({ ...prev, tags: nextTags }));
    commitDraft({ ...formData, tags: nextTags });
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

  if (!selectedElement || !formData) {
    return (
      <div className="right-panel">
        <div className="right-panel-header">
          <h2>No Selection</h2>
        </div>
      </div>
    );
  }

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
                  <p>
                    {formData.dateLabel ??
                      formatYear(
                        formData.date,
                        timelineData?.file?.negID,
                        timelineData?.file?.posID,
                        timelineData?.file?.useMonths === true
                      )}
                  </p>
                </div>
            ) : (
              <>
                <div className="view-group">
                  <label>Start Year</label>
                  <div className="view-separator" />
                  <p>
                    {formData.startLabel ??
                      formatYear(
                        formData.start,
                        timelineData?.file?.negID,
                        timelineData?.file?.posID,
                        timelineData?.file?.useMonths === true
                      )}
                  </p>
                </div>
                <div className="view-group">
                  <label>End Year</label>
                  <div className="view-separator" />
                  <p>
                    {formData.endLabel ??
                      formatYear(
                        formData.end,
                        timelineData?.file?.negID,
                        timelineData?.file?.posID,
                        timelineData?.file?.useMonths === true
                      )}
                  </p>
                </div>
              </>
            )}

            {/* Color (spans and eras only) */}

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

            {/* Tags */}
            <div className="view-group">
              <label>Tags</label>
              <div className="view-separator" />
              {Array.isArray(formData.tags) && formData.tags.length > 0 ? (
                <div className="tag-chip-list">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p>None</p>
              )}
            </div>

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
                <div className="edit-row">
                  <label htmlFor="color">Color</label>
                  <div className="edit-separator" />
                  <div className="edit-color-wrap">
                    <input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => {
                        handleChange("color", e.target.value);
                        commitDraft({ ...formData, color: e.target.value });
                      }}
                      className="edit-color-picker"
                      aria-label="Pick color"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => handleChange("color", e.target.value)}
                      onBlur={(e) => commitDraft({ ...formData, color: e.target.value })}
                      className="edit-color-text"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Parent (events only) */}
            {formData.type === "event" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="parents">Parent</label>
                  <div className="edit-separator" />
                  <div className="branch-picker parent-picker">
                    <input
                      id="parents"
                      type="text"
                      value={parentQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setParentQuery(value);
                        setIsParentMenuOpen(true);
                        const trimmed = value.trim();
                        handleChange("parents", trimmed ? [trimmed] : []);
                      }}
                      onFocus={() => setIsParentMenuOpen(true)}
                      onBlur={handleParentBlur}
                      placeholder="Search span ID or title..."
                      className="edit-input branch-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const choice = parentSuggestions[0];
                          if (choice) {
                            setParentQuery(choice.id);
                            handleChange("parents", [choice.id]);
                            commitDraft({ ...formData, parents: [choice.id] });
                            setIsParentMenuOpen(false);
                          }
                        }
                      }}
                    />
                    {isParentMenuOpen && (
                      <div className="branch-suggestions">
                        {parentSuggestions.length > 0 ? (
                          parentSuggestions.map((span) => (
                            <button
                              key={span.id}
                              type="button"
                              className="branch-suggestion-item"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setParentQuery(span.id);
                                handleChange("parents", [span.id]);
                                commitDraft({ ...formData, parents: [span.id] });
                                setIsParentMenuOpen(false);
                              }}
                            >
                              <span className="branch-suggestion-title">{span.title || span.id}</span>
                              <span className="branch-suggestion-id">{span.id}</span>
                            </button>
                          ))
                        ) : (
                          <div className="branch-suggestion-empty">No matching spans</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="form-group">
              <div className="edit-row">
                <label htmlFor="tags">Tags</label>
                <div className="edit-separator" />
                <div className="branch-picker tag-picker">
                  <input
                    id="tags"
                    type="text"
                    value={tagQuery}
                    onChange={(e) => {
                      setTagQuery(e.target.value);
                      setIsTagMenuOpen(true);
                    }}
                    onFocus={() => setIsTagMenuOpen(true)}
                    onBlur={handleTagBlur}
                    placeholder="Add a tag..."
                    className="edit-input branch-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = tagQuery.trim();
                        if (trimmed) addTag(trimmed);
                      }
                    }}
                  />
                  {isTagMenuOpen && tagSuggestions.length > 0 && (
                    <div className="branch-suggestions">
                      {tagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="branch-suggestion-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTag(tag);
                          }}
                        >
                          <span className="branch-suggestion-title">{tag}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {Array.isArray(formData.tags) && formData.tags.length > 0 && (
                <div className="branch-selected-list tag-selected-list">
                  {formData.tags.map((tag) => (
                    <div key={tag} className="branch-selected-item tag-selected-item">
                      <span className="branch-selected-link">{tag}</span>
                      <button
                        type="button"
                        className="branch-selected-remove"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                  <div className="branch-picker">
                    <input
                      id="branches"
                      type="text"
                      value={branchQuery}
                      onChange={(e) => {
                        setBranchQuery(e.target.value);
                        setIsBranchMenuOpen(true);
                      }}
                      onFocus={() => setIsBranchMenuOpen(true)}
                      onBlur={handleBranchBlur}
                      placeholder="Search span ID or title..."
                      className="edit-input branch-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (branchSuggestions.length > 0) {
                            addBranch(branchSuggestions[0].id);
                          }
                        }
                      }}
                    />
                    {isBranchMenuOpen && branchQuery.trim().length > 0 && (
                      <div className="branch-suggestions">
                        {branchSuggestions.length > 0 ? (
                          branchSuggestions.map((span) => (
                            <button
                              key={span.id}
                              type="button"
                              className="branch-suggestion-item"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addBranch(span.id);
                              }}
                            >
                              <span className="branch-suggestion-title">{span.title || span.id}</span>
                              <span className="branch-suggestion-id">{span.id}</span>
                            </button>
                          ))
                        ) : (
                          <div className="branch-suggestion-empty">No matching spans</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {Array.isArray(formData.branches) && formData.branches.length > 0 && (
                  <div className="branch-selected-list">
                    {formData.branches.map((branchId) => {
                      const branchElement = timelineData.elements.find((el) => el.id === branchId);
                      return (
                        <div key={branchId} className="branch-selected-item">
                          <button
                            type="button"
                            className="branch-selected-link"
                            onClick={() => onSelect(branchId)}
                          >
                            {branchElement?.title || branchId}
                          </button>
                          <button
                            type="button"
                            className="branch-selected-remove"
                            onClick={() => removeBranch(branchId)}
                            aria-label={`Remove ${branchElement?.title || branchId}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}


            <div className="form-group note-form-group">
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
