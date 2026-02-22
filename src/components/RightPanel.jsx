import { useState, useEffect, useRef, useMemo } from "react";
import { Copy, Check, Edit2, Eye, Maximize2, Minimize2, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Underline, Highlighter, Link2, Trash2, Unlink } from "lucide-react";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import { formatYear } from "../utils/timelineUtils";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { createNote, addExistingNote, readNote, writeNote, deleteNote, getNotesBaseDir } from "../utils/electronApi";

export default function RightPanel({
  onSelect,
  selectedElement,
  onUpdate,
  timelineData,
  editRequestId,
  onEditRequestHandled,
  isMaximized,
  onToggleMaximize,
  onFilterByTag,
  activeTags = [],
  onToggleTag,
  pluginFields = [],
}) {
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [noteExists, setNoteExists] = useState(false);
  const [notesBaseUrl, setNotesBaseUrl] = useState("");
  const [notesBasePath, setNotesBasePath] = useState("");
  const prevSelectedIdRef = useRef(null);
  const [spanParentQuery, setSpanParentQuery] = useState("");
  const [isSpanParentMenuOpen, setIsSpanParentMenuOpen] = useState(false);
  const spanParentMenuTimeoutRef = useRef(null);
  const [mergeParentQuery, setMergeParentQuery] = useState("");
  const [isMergeParentMenuOpen, setIsMergeParentMenuOpen] = useState(false);
  const mergeParentMenuTimeoutRef = useRef(null);
  const [parentQuery, setParentQuery] = useState("");
  const [isParentMenuOpen, setIsParentMenuOpen] = useState(false);
  const parentMenuTimeoutRef = useRef(null);
  const [tagQuery, setTagQuery] = useState("");
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const TAG_MAX_LENGTH = 32;
  const ID_MAX_LENGTH = 60;

  const isValidIdValue = (value) => /^[a-z0-9_-]+$/i.test(value);
  const isValidTagValue = (value) => /^[a-z0-9 _-]+$/i.test(value);
  const isSafeNoteFilename = (name) => {
    if (!name || typeof name !== 'string') return false;
    return /^[a-z0-9_-]+\.md$/i.test(name) && !name.includes('..');
  };
  const normalizeTagValue = (value) => value.trim().replace(/\s+/g, " ");

  const pushValidationError = (message) => {
    if (!message) return;
    setValidationErrors([message]);
  };

  useEffect(() => {
    if (selectedElement) {
      const prevId = prevSelectedIdRef.current;
      const shouldPreserveEditMode =
        isEditMode &&
        formData &&
        formData.type === selectedElement.type &&
        formData.title === selectedElement.title;
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
        if (!shouldPreserveEditMode) {
          setIsEditMode(false);
          setSpanParentQuery("");
          setIsSpanParentMenuOpen(false);
          setMergeParentQuery("");
          setIsMergeParentMenuOpen(false);
          setIsParentMenuOpen(false);
          setIsTagMenuOpen(false);
        }
      }
      prevSelectedIdRef.current = selectedElement.id;
    }
  }, [selectedElement]);

  useEffect(() => {
    if (!isEditMode) {
      setSpanParentQuery("");
      setIsSpanParentMenuOpen(false);
      setMergeParentQuery("");
      setIsMergeParentMenuOpen(false);
      setIsParentMenuOpen(false);
      setIsTagMenuOpen(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    let isMounted = true;
    const loadNote = async () => {
      if (!selectedElement?.noteFile) {
        setNoteContent("");
        setNoteExists(false);
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
        setNoteExists(true);
      } else {
        if (result?.error === "NOT_FOUND") {
          const next = { ...selectedElement };
          delete next.noteFile;
          setFormData(next);
          onUpdate?.(next);
        }
        setNoteContent("");
        setNoteExists(false);
      }
    };

    loadNote();
    return () => {
      isMounted = false;
    };
  }, [selectedElement, timelineData]);

  useEffect(() => {
    let isMounted = true;
    const loadNotesBaseDir = async () => {
      const result = await getNotesBaseDir();
      if (!isMounted) return;
      if (result?.success && result.fileUrl) {
        const normalized = result.fileUrl.endsWith("/") ? result.fileUrl : `${result.fileUrl}/`;
        setNotesBaseUrl(normalized);
      }
      if (result?.success && result.path) {
        setNotesBasePath(result.path);
      }
    };

    loadNotesBaseDir();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditMode) return;

    const handleOutsideClick = (event) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(event.target)) {
        return;
      }
      if (formData) {
        commitDraft(formData);
        if (formData.noteFile) {
          handleNoteSave();
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
    };
  }, [isEditMode, formData, noteContent]);

  // Cleanup all menu timeouts on unmount
  useEffect(() => {
    return () => {
      if (spanParentMenuTimeoutRef.current) clearTimeout(spanParentMenuTimeoutRef.current);
      if (mergeParentMenuTimeoutRef.current) clearTimeout(mergeParentMenuTimeoutRef.current);
      if (parentMenuTimeoutRef.current) clearTimeout(parentMenuTimeoutRef.current);
      if (tagMenuTimeoutRef.current) clearTimeout(tagMenuTimeoutRef.current);
    };
  }, []);

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

  const isValidHexColor = (color) => /^#[0-9A-Fa-f]{6}$/.test(color);

  const normalizeColor = (color) => {
    if (!color) return "#808080";
    if (isValidHexColor(color)) return color;
    // Try to salvage partial hex colors
    const cleaned = color.replace(/[^0-9A-Fa-f#]/g, "");
    if (isValidHexColor(cleaned)) return cleaned;
    return "#808080";
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
    const { dateInput: _dateInput, startInput: _startInput, endInput: _endInput, ...rest } = data;
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

  // Span parent candidates: spans whose time range contains this span's START
  const spanParentCandidates = useMemo(() => {
    if (!timelineData || !formData || formData.type !== "span" || !parentRange) return [];
    return timelineData.elements
      .filter((el) => el.type === "span" && el.id !== formData.id)
      .map((span) => ({
        ...span,
        _start: getSpanNumericStart(span),
        _end: getSpanNumericEnd(span),
      }))
      .filter((span) => Number.isFinite(span._start) && Number.isFinite(span._end) && parentRange.start >= span._start && parentRange.start <= span._end);
  }, [timelineData, formData, parentRange]);

  const spanParentSuggestions = useMemo(() => {
    if (!spanParentQuery.trim()) return spanParentCandidates;
    const needle = spanParentQuery.trim().toLowerCase();
    return spanParentCandidates.filter((span) =>
      span.id.toLowerCase().includes(needle) ||
      (span.title || "").toLowerCase().includes(needle)
    );
  }, [spanParentCandidates, spanParentQuery]);

  const mergeParentCandidates = useMemo(() => {
    if (!timelineData || !formData || formData.type !== "span" || !parentRange) return [];
    return timelineData.elements
      .filter((el) => el.type === "span" && el.id !== formData.id)
      .map((span) => ({
        ...span,
        _start: getSpanNumericStart(span),
        _end: getSpanNumericEnd(span),
      }))
      .filter((span) => Number.isFinite(span._start) && Number.isFinite(span._end) && parentRange.end >= span._start && parentRange.end <= span._end);
  }, [timelineData, formData, parentRange]);

  const mergeParentSuggestions = useMemo(() => {
    if (!mergeParentQuery.trim()) return mergeParentCandidates;
    const needle = mergeParentQuery.trim().toLowerCase();
    return mergeParentCandidates.filter((span) =>
      span.id.toLowerCase().includes(needle) ||
      (span.title || "").toLowerCase().includes(needle)
    );
  }, [mergeParentCandidates, mergeParentQuery]);

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

  const setSpanParent = (spanId) => {
    if (!spanId) return;
    setFormData((prev) => ({ ...prev, parent: spanId }));
    commitDraft({ ...formData, parent: spanId });
    setSpanParentQuery("");
    setIsSpanParentMenuOpen(false);
  };

  const clearSpanParent = () => {
    const { parent: _p, ...rest } = formData;
    setFormData(rest);
    commitDraft(rest);
  };

  const handleSpanParentBlur = () => {
    if (spanParentMenuTimeoutRef.current) {
      clearTimeout(spanParentMenuTimeoutRef.current);
    }
    spanParentMenuTimeoutRef.current = setTimeout(() => {
      setIsSpanParentMenuOpen(false);
    }, 120);
  };

  const setMergeParent = (spanId) => {
    if (!spanId) return;
    setFormData((prev) => ({ ...prev, mergeParent: spanId }));
    commitDraft({ ...formData, mergeParent: spanId });
    setMergeParentQuery("");
    setIsMergeParentMenuOpen(false);
  };

  const clearMergeParent = () => {
    const { mergeParent: _m, ...rest } = formData;
    setFormData(rest);
    commitDraft(rest);
  };

  const handleMergeParentBlur = () => {
    if (mergeParentMenuTimeoutRef.current) {
      clearTimeout(mergeParentMenuTimeoutRef.current);
    }
    mergeParentMenuTimeoutRef.current = setTimeout(() => {
      setIsMergeParentMenuOpen(false);
    }, 120);
  };

  const handleParentBlur = () => {
    if (parentMenuTimeoutRef.current) {
      clearTimeout(parentMenuTimeoutRef.current);
    }
    const trimmed = parentQuery.trim();
    if (trimmed) {
      if (trimmed.length > ID_MAX_LENGTH) {
        pushValidationError(`Parent ID must be ${ID_MAX_LENGTH} characters or fewer.`);
        return;
      }
      if (!isValidIdValue(trimmed)) {
        pushValidationError("Parent ID can only include letters, numbers, hyphens, and underscores.");
        return;
      }
    }
    if (validationErrors.length) setValidationErrors([]);
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
    const normalized = normalizeTagValue(tag);
    if (!normalized) return;
    if (normalized.length > TAG_MAX_LENGTH) {
      pushValidationError(`Tags must be ${TAG_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!isValidTagValue(normalized)) {
      pushValidationError("Tags can only include letters, numbers, spaces, hyphens, and underscores.");
      return;
    }
    const existing = Array.isArray(formData.tags) ? formData.tags : [];
    if (existing.includes(normalized)) return;
    const nextTags = [...existing, normalized];
    if (validationErrors.length) setValidationErrors([]);
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
      if (parsedStart.value >= parsedEnd.value) {
        errors.push("Start must be before End.");
      }
      if (parsedEnd.value <= timelineStart || parsedStart.value >= timelineEnd) {
        errors.push("Span/Era must overlap with the timeline range.");
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
    const next = { ...formData, noteFile: result.filename || `${formData.id}.md` };
    setFormData(next);
    onUpdate?.(next);
    setNoteContent(result?.content ?? `# ${formData.title}\n\n`);
  };

  const handleAddExistingNote = async () => {
    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;
    const result = await addExistingNote({ timelineId });
    if (!result?.success) {
      if (result?.error === "OUTSIDE_NOTES_DIR") {
        window.alert("That note is outside your Notes Folder. Choose a note inside the Notes Folder or change the Notes Folder in App Settings.");
      } else if (!result?.cancelled) {
        console.error('Failed to add existing note:', result?.error);
      }
      return;
    }
    const next = { ...formData, noteFile: result.filename };
    setFormData(next);
    onUpdate?.(next);
    setNoteContent(result?.content ?? "");
    setNoteExists(true);
  };

  const handleNoteSave = async () => {
    if (!formData?.noteFile || !isSafeNoteFilename(formData.noteFile)) return;
    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;
    await writeNote({
      timelineId,
      filename: formData.noteFile,
      content: noteContent,
    });
  };

  const handleDeleteNote = async () => {
    if (!formData?.noteFile || !isSafeNoteFilename(formData.noteFile)) return;
    const confirmed = window.confirm("Delete this note? This cannot be undone.");
    if (!confirmed) return;

    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;

    const result = await deleteNote({
      timelineId,
      filename: formData.noteFile,
    });

    if (!result?.success) {
      console.error('Failed to delete note:', result?.error);
      return;
    }

    const next = { ...formData };
    delete next.noteFile;
    setFormData(next);
    setNoteContent("");
    onUpdate?.(next);
  };

  const handleUnlinkNote = () => {
    if (!formData?.noteFile) return;
    const next = { ...formData };
    delete next.noteFile;
    setFormData(next);
    setNoteContent("");
    setNoteExists(false);
    onUpdate?.(next);
  };

  const renderNoteMarkdown = (content, isLoading) => {
    const raw = isLoading ? "_Loading note..._" : content || "";
    const withUnderline = raw.replace(/__(.+?)__/g, "<u>$1</u>");
    const withHighlight = withUnderline.replace(/==(.+?)==/g, "<mark>$1</mark>");
    const html = marked.parse(withHighlight);
    return sanitizeHtml(html);
  };

  const sanitizeHtml = (html) => {
    const baseUrl = notesBaseUrl || "";
    const basePath = notesBasePath || "";

    const normalizeFsPath = (inputPath) => {
      if (!inputPath) return "";
      let value = decodeURIComponent(String(inputPath)).replace(/\\/g, "/");
      if (/^\/[a-zA-Z]:\//.test(value)) {
        value = value.slice(1);
      }
      const parts = [];
      value.split("/").forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") {
          if (parts.length) parts.pop();
          return;
        }
        parts.push(part);
      });
      return parts.join("/");
    };

    const isPathInsideBase = (candidatePath) => {
      if (!basePath) return false;
      const normalizedBase = normalizeFsPath(basePath).toLowerCase();
      const normalizedCandidate = normalizeFsPath(candidatePath).toLowerCase();
      if (!normalizedBase) return false;
      if (normalizedCandidate === normalizedBase) return true;
      return normalizedCandidate.startsWith(`${normalizedBase}/`);
    };

    const fileUrlToPath = (fileUrl) => {
      try {
        const url = new URL(fileUrl);
        if (url.protocol !== "file:") return null;
        return url.pathname;
      } catch {
        return null;
      }
    };

    const normalizeSrc = (rawValue) => {
      const value = String(rawValue || "").trim();
      if (!value) return null;

      if (/^https:\/\//i.test(value)) return value;

      if (/^file:\/\//i.test(value)) {
        const filePath = fileUrlToPath(value);
        if (!filePath || !isPathInsideBase(filePath)) return null;
        return value;
      }

      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
        return null;
      }

      if (!baseUrl) return null;

      try {
        const resolved = new URL(value, baseUrl).toString();
        const resolvedPath = fileUrlToPath(resolved);
        if (!resolvedPath || !isPathInsideBase(resolvedPath)) return null;
        return resolved;
      } catch {
        return null;
      }
    };

    const normalizeHref = (rawValue) => {
      const value = String(rawValue || "").trim();
      if (!value) return null;

      if (/^https:\/\//i.test(value) || /^mailto:/i.test(value)) {
        return value;
      }

      if (/^file:\/\//i.test(value)) {
        const filePath = fileUrlToPath(value);
        if (!filePath || !isPathInsideBase(filePath)) return null;
        return value;
      }

      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
        return null;
      }

      if (!baseUrl) return null;

      try {
        const resolved = new URL(value, baseUrl).toString();
        const resolvedPath = fileUrlToPath(resolved);
        if (!resolvedPath || !isPathInsideBase(resolvedPath)) return null;
        return resolved;
      } catch {
        return null;
      }
    };

    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "a",
        "abbr",
        "b",
        "blockquote",
        "br",
        "code",
        "del",
        "div",
        "em",
        "font",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "i",
        "img",
        "li",
        "mark",
        "ol",
        "p",
        "pre",
        "span",
        "strong",
        "table",
        "tbody",
        "thead",
        "tr",
        "td",
        "th",
        "u",
        "ul",
      ],
      ALLOWED_ATTR: [
        "href",
        "target",
        "rel",
        "src",
        "alt",
        "title",
        "color",
        "face",
        "size",
        "width",
        "height",
        "loading",
      ],
      KEEP_CONTENT: true,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "text/html");
    const nodes = Array.from(doc.body.querySelectorAll("*"));
    nodes.forEach((node) => {
      const tagName = node.tagName.toLowerCase();

      if (tagName === "a") {
        const href = normalizeHref(node.getAttribute("href"));
        if (!href) {
          node.removeAttribute("href");
        } else {
          node.setAttribute("href", href);
        }
        node.setAttribute("rel", "noopener noreferrer");
        node.setAttribute("target", "_blank");
      }

      if (tagName === "img") {
        const src = normalizeSrc(node.getAttribute("src"));
        if (!src) {
          node.remove();
          return;
        }
        node.setAttribute("src", src);
        if (!node.getAttribute("loading")) {
          node.setAttribute("loading", "lazy");
        }
      }
    });

    return doc.body.innerHTML;
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
    <div
      ref={panelRef}
      className={`right-panel ${isMaximized ? "is-maximized" : ""}`}
    >
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
                        timelineData?.file?.useMonths === true,
                        timelineData?.file?.hideDecimals
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
                        timelineData?.file?.useMonths === true,
                        timelineData?.file?.hideDecimals
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
                        timelineData?.file?.useMonths === true,
                        timelineData?.file?.hideDecimals
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

            {/* Parent span (spans only) */}
            {formData.type === "span" && (
              <div className="view-group">
                <label>Parent</label>
                <div className="view-separator" />
                {formData.parent ? (
                  <button
                    type="button"
                    className="tag-chip tag-chip-link"
                    onClick={() => onSelect(formData.parent)}
                  >
                    {timelineData.elements.find(el => el.id === formData.parent)?.title || formData.parent}
                  </button>
                ) : (
                  <p>None</p>
                )}
              </div>
            )}

            {/* Merge target (spans only) */}
            {formData.type === "span" && (
              <div className="view-group">
                <label>Merge Into</label>
                <div className="view-separator" />
                {formData.mergeParent ? (
                  <button
                    type="button"
                    className="tag-chip tag-chip-link"
                    onClick={() => onSelect(formData.mergeParent)}
                  >
                    {timelineData.elements.find(el => el.id === formData.mergeParent)?.title || formData.mergeParent}
                  </button>
                ) : (
                  <p>None</p>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="view-group view-group-chips">
              <label>Tags</label>
              <div className="view-separator" />
              {Array.isArray(formData.tags) && formData.tags.length > 0 ? (
                <div className="tag-chip-list">
                  {formData.tags.map((tag) => {
                    const isSelected = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`tag-chip tag-chip-link${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          if (onToggleTag) {
                            onToggleTag(tag);
                          } else {
                            onFilterByTag?.(tag);
                          }
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p>None</p>
              )}
            </div>

            {pluginFields
              .filter((f) => !f.elementTypes || f.elementTypes.includes(formData.type))
              .map((field) => (
                <div className="view-group" key={field.id}>
                  <label>{field.label}</label>
                  <div className="view-separator" />
                  <p>{formData[field.id] ?? field.defaultValue ?? ""}</p>
                </div>
              ))}

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

            {/* Details Section */}
            <div className="edit-section-label">Details</div>

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
                  maxLength={200}
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
                    maxLength={20}
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
                    maxLength={20}
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
                    maxLength={20}
                  />
                  </div>
                </div>
              </>
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
                        if (validationErrors.length) setValidationErrors([]);
                        handleChange("parents", trimmed ? [trimmed] : []);
                      }}
                      onFocus={() => setIsParentMenuOpen(true)}
                      onBlur={handleParentBlur}
                      placeholder="Search span ID or title..."
                      className="edit-input branch-input"
                      maxLength={ID_MAX_LENGTH}
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

            {/* Parent span (spans only) */}
            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="spanParent">Parent</label>
                  <div className="edit-separator" />
                  {formData.parent ? (
                    <div className="chip-selected-list">
                      <div className="chip-selected-item">
                        <button
                          type="button"
                          className="chip-selected-link"
                          onClick={() => onSelect(formData.parent)}
                        >
                          {timelineData.elements.find((el) => el.id === formData.parent)?.title || formData.parent}
                        </button>
                        <button
                          type="button"
                          className="chip-selected-remove"
                          onClick={clearSpanParent}
                          aria-label="Remove parent"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="branch-picker">
                      <input
                        id="spanParent"
                        type="text"
                        value={spanParentQuery}
                        onChange={(e) => {
                          setSpanParentQuery(e.target.value);
                          setIsSpanParentMenuOpen(true);
                        }}
                        onFocus={() => setIsSpanParentMenuOpen(true)}
                        onBlur={handleSpanParentBlur}
                        placeholder="Search span ID or title..."
                        className="edit-input branch-input"
                        maxLength={ID_MAX_LENGTH}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (spanParentSuggestions.length > 0) {
                              setSpanParent(spanParentSuggestions[0].id);
                            }
                          }
                        }}
                      />
                      {isSpanParentMenuOpen && spanParentQuery.trim().length > 0 && (
                        <div className="branch-suggestions">
                          {spanParentSuggestions.length > 0 ? (
                            spanParentSuggestions.map((span) => (
                              <button
                                key={span.id}
                                type="button"
                                className="branch-suggestion-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSpanParent(span.id);
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
                  )}
                </div>
              </div>
            )}

            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="mergeParent">Merge Into</label>
                  <div className="edit-separator" />
                  {formData.mergeParent ? (
                    <div className="chip-selected-list">
                      <div className="chip-selected-item">
                        <button
                          type="button"
                          className="chip-selected-link"
                          onClick={() => onSelect(formData.mergeParent)}
                        >
                          {timelineData.elements.find((el) => el.id === formData.mergeParent)?.title || formData.mergeParent}
                        </button>
                        <button
                          type="button"
                          className="chip-selected-remove"
                          onClick={clearMergeParent}
                          aria-label="Remove merge target"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="branch-picker">
                      <input
                        id="mergeParent"
                        type="text"
                        value={mergeParentQuery}
                        onChange={(e) => {
                          setMergeParentQuery(e.target.value);
                          setIsMergeParentMenuOpen(true);
                        }}
                        onFocus={() => setIsMergeParentMenuOpen(true)}
                        onBlur={handleMergeParentBlur}
                        placeholder="Search span ID or title..."
                        className="edit-input branch-input"
                        maxLength={ID_MAX_LENGTH}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (mergeParentSuggestions.length > 0) {
                              setMergeParent(mergeParentSuggestions[0].id);
                            }
                          }
                        }}
                      />
                      {isMergeParentMenuOpen && mergeParentQuery.trim().length > 0 && (
                        <div className="branch-suggestions">
                          {mergeParentSuggestions.length > 0 ? (
                            mergeParentSuggestions.map((span) => (
                              <button
                                key={span.id}
                                type="button"
                                className="branch-suggestion-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setMergeParent(span.id);
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
                  )}
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
                        if (validationErrors.length) setValidationErrors([]);
                      }}
                      onFocus={() => setIsTagMenuOpen(true)}
                      onBlur={handleTagBlur}
                      placeholder="Add a tag..."
                      className="edit-input branch-input"
                      maxLength={TAG_MAX_LENGTH}
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
                <div className="chip-selected-list">
                  {formData.tags.map((tag) => {
                    return (
                    <div
                      key={tag}
                      className="chip-selected-item"
                    >
                      <span className="chip-selected-text">{tag}</span>
                        <button
                          type="button"
                          className="chip-selected-remove"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove ${tag}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Style Section */}
            <div className="edit-section-label">Style</div>

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
                      onBlur={(e) => {
                        const normalized = normalizeColor(e.target.value);
                        handleChange("color", normalized);
                        commitDraft({ ...formData, color: normalized });
                      }}
                      className="edit-color-text"
                      maxLength={7}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Event styling (events only) */}
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

            {pluginFields.filter((f) => !f.elementTypes || f.elementTypes.includes(formData.type)).length > 0 && (
              <>
                <div className="edit-section-label">Custom</div>
                {pluginFields
                  .filter((f) => !f.elementTypes || f.elementTypes.includes(formData.type))
                  .map((field) => {
                    const fieldType = field.type || "text";
                    const value = formData[field.id] ?? field.defaultValue ?? "";
                    return (
                      <div className="form-group" key={field.id}>
                        <div className="edit-row">
                          <label htmlFor={`plugin-field-${field.id}`}>{field.label}</label>
                          <div className="edit-separator" />
                          {fieldType === "select" ? (
                            <div className="edit-select-wrap">
                              <select
                                id={`plugin-field-${field.id}`}
                                className="edit-select"
                                value={value}
                                onChange={(e) => {
                                  handleChange(field.id, e.target.value);
                                  commitDraft({ ...formData, [field.id]: e.target.value });
                                }}
                              >
                                {(field.options || []).map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label || opt.value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : fieldType === "color" ? (
                            <div className="edit-color-wrap">
                              <input
                                id={`plugin-field-${field.id}`}
                                type="color"
                                value={value || "#000000"}
                                onChange={(e) => {
                                  handleChange(field.id, e.target.value);
                                  commitDraft({ ...formData, [field.id]: e.target.value });
                                }}
                                className="edit-color-picker"
                              />
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                onBlur={(e) => commitDraft({ ...formData, [field.id]: e.target.value })}
                                className="edit-color-text"
                                maxLength={7}
                                placeholder="#000000"
                              />
                            </div>
                          ) : (
                            <input
                              id={`plugin-field-${field.id}`}
                              type={fieldType}
                              value={value}
                              onChange={(e) => handleChange(field.id, e.target.value)}
                              onBlur={(e) => commitDraft({ ...formData, [field.id]: e.target.value })}
                              className="edit-input"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

            <div className="form-group note-form-group">
              {!formData.noteFile ? (
                <div className="note-add-actions">
                  <button type="button" className="btn-secondary btn-note" onClick={handleAddNote}>
                    Create Note
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-note"
                    onClick={handleAddExistingNote}
                  >
                    Add Existing Note
                  </button>
                </div>
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
                    {noteExists && (
                      <>
                        <div className="note-toolbar-divider" />
                        <button type="button" onClick={handleUnlinkNote} title="Unlink Note">
                          <Unlink size={14} />
                        </button>
                        <button type="button" onClick={handleDeleteNote} title="Delete Note">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
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

