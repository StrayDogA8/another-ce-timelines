import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { Maximize2, Minimize2, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Underline, Highlighter, Link, Link2, Trash2, Unlink, ChevronLeft, ChevronRight, ChevronDown, Pencil, ExternalLink, BookOpen, Calendar, FileText, ImagePlay } from "lucide-react";
import { parseTimelineInput, fractionalYearToDate } from "../utils/dateUtils";
import { formatYear } from "../utils/timelineUtils";
import { isValidIdValue, isValidTagValue, isSafeNoteFilename, normalizeTagValue, parseMediaWikiUrl, buildValidatedUpdate } from "../utils/validation";
import { normalizeColor } from "../utils/colorUtils";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { createNote, addExistingNote, readNote, writeNote, deleteNote, getNotesBaseDir, fetchWikipedia } from "../utils/electronApi";


const NoteEditor = forwardRef(function NoteEditor(
  { initialContent, isNoteLoading, noteExists, onSave, onUnlink, onDelete },
  ref
) {
  const [noteContent, setNoteContent] = useState(initialContent ?? "");
  const noteContentRef = useRef(noteContent);
  noteContentRef.current = noteContent;

  // Sync when parent resets content (element switch, note create/link/delete)
  useEffect(() => {
    setNoteContent(initialContent ?? "");
  }, [initialContent]);

  // Trigger save on outside-click
  useImperativeHandle(ref, () => ({
    save: () => onSave(noteContentRef.current),
  }), [onSave]);

  const wrapSelection = (prefix, suffix = prefix) => {
    const textarea = document.querySelector('.note-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const before = noteContentRef.current.slice(0, start);
    const selected = noteContentRef.current.slice(start, end);
    const after = noteContentRef.current.slice(end);
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
    const content = noteContentRef.current;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = content.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? content.length : lineEnd;
    const line = content.slice(lineStart, actualLineEnd);
    const cleaned = line.replace(/^#{1,6}\s+/, '');
    const prefix = `${'#'.repeat(level)} `;
    const nextLine = `${prefix}${cleaned}`;
    const next = `${content.slice(0, lineStart)}${nextLine}${content.slice(actualLineEnd)}`;
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
    const content = noteContentRef.current;
    const before = content.slice(0, start);
    const selected = content.slice(start, end) || 'link text';
    const after = content.slice(end);
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

  const insertImage = () => {
    const textarea = document.querySelector('.note-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const content = noteContentRef.current;
    const before = content.slice(0, start);
    const after = content.slice(start);
    const token = `![](https://)`;
    setNoteContent(`${before}${token}${after}`);
    const urlStart = before.length + 4;
    const urlEnd = urlStart + 8;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(urlStart, urlEnd);
    });
  };


  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <div className="note-toolbar-format">
          <button type="button" onClick={() => insertHeading(1)} title="Heading 1"><Heading1 size={14} /></button>
          <button type="button" onClick={() => insertHeading(2)} title="Heading 2"><Heading2 size={14} /></button>
          <button type="button" onClick={() => insertHeading(3)} title="Heading 3"><Heading3 size={14} /></button>
          <div className="note-toolbar-divider" />
          <button type="button" onClick={() => wrapSelection('**')} title="Bold"><Bold size={14} /></button>
          <button type="button" onClick={() => wrapSelection('*')} title="Italic"><Italic size={14} /></button>
          <button type="button" onClick={() => wrapSelection('~~')} title="Strikethrough"><Strikethrough size={14} /></button>
          <button type="button" onClick={() => wrapSelection('__')} title="Underline"><Underline size={14} /></button>
          <button type="button" onClick={() => wrapSelection('==')} title="Highlight"><Highlighter size={14} /></button>
          <div className="note-toolbar-divider" />
          <button type="button" onClick={insertLink} title="Link"><Link2 size={14} /></button>
          <button type="button" onClick={insertImage} title="Embed image or video"><ImagePlay size={14} /></button>
        </div>
        {noteExists && (
          <div className="note-toolbar-actions">
            <div className="note-toolbar-divider" />
            <button type="button" onClick={onUnlink} title="Unlink Note"><Unlink size={14} /></button>
            <button type="button" onClick={onDelete} title="Delete Note"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      <textarea
        className="note-textarea"
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        onBlur={() => onSave(noteContentRef.current)}
        placeholder={isNoteLoading ? "Loading note..." : "Write your note..."}
        rows={8}
      />
    </div>
  );
});

const EVENT_STROKE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "none", label: "None" },
];

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
  onUpdateGroups,
  tagColors = {},
  onRequestDelete,
  onSelectPrevious,
  onSelectNext,
  prevElement,
  nextElement,
}) {
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [noteInitialContent, setNoteInitialContent] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [noteExists, setNoteExists] = useState(false);
  const [isNoteAddOpen, setIsNoteAddOpen] = useState(false);
  const noteEditorRef = useRef(null);
  const noteRenderRef = useRef(null);

  const [notesBaseUrl, setNotesBaseUrl] = useState("");
  const [notesBasePath, setNotesBasePath] = useState("");
  const prevSelectedIdRef = useRef(null);
  const [spanParentQuery, setSpanParentQuery] = useState("");
  const [isSpanParentMenuOpen, setIsSpanParentMenuOpen] = useState(false);
  const spanParentMenuTimeoutRef = useRef(null);
  const [spanRelationType, setSpanRelationType] = useState("branch");
  const [isSpanRelationOpen, setIsSpanRelationOpen] = useState(false);
  const [mergeParentQuery, setMergeParentQuery] = useState("");
  const [isMergeParentMenuOpen, setIsMergeParentMenuOpen] = useState(false);
  const mergeParentMenuTimeoutRef = useRef(null);
  const [parentQuery, setParentQuery] = useState("");
  const [isParentMenuOpen, setIsParentMenuOpen] = useState(false);
  const parentMenuTimeoutRef = useRef(null);
  const [tagQuery, setTagQuery] = useState("");
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuTimeoutRef = useRef(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const groupMenuTimeoutRef = useRef(null);
  const [wikiContent, setWikiContent] = useState("");
  const [isWikiLoading, setIsWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState("");
  const [isSourceFormOpen, setIsSourceFormOpen] = useState(false);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isNoteCollapsed, setIsNoteCollapsed] = useState(false);
  const [isWikiCollapsed, setIsWikiCollapsed] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [editingSourceIndex, setEditingSourceIndex] = useState(null);
  const wikiCacheRef = useRef(new Map());
  const wikiRenderRef = useRef(null);
  const WIKI_SANITIZE_VERSION = "collapsible-1";
  const panelRef = useRef(null);
  const datePickerRefs = useRef({});
  const TAG_MAX_LENGTH = 32;
  const ID_MAX_LENGTH = 60;
  const showCalendarInputIcon = timelineData?.file?.useCalendar === true;

  const pushValidationError = (message) => {
    if (!message) return;
    setValidationErrors([message]);
  };

  const stripEditableEraSuffix = useCallback((input) => {
    const raw = String(input ?? "").trim();
    if (!raw) return "";
    const negSuffix = typeof timelineData?.file?.negID === "string" ? timelineData.file.negID.trim() : "";
    const posSuffix = typeof timelineData?.file?.posID === "string" ? timelineData.file.posID.trim() : "";
    let next = raw;

    if (negSuffix) {
      const spacedNegSuffix = ` ${negSuffix}`;
      if (next.endsWith(spacedNegSuffix)) {
        const base = next.slice(0, -spacedNegSuffix.length).trim();
        if (base && !base.startsWith("-")) {
          next = `-${base}`;
        } else {
          next = base;
        }
      }
    }

    if (posSuffix) {
      const spacedPosSuffix = ` ${posSuffix}`;
      if (next.endsWith(spacedPosSuffix)) {
        next = next.slice(0, -spacedPosSuffix.length).trim();
      }
    }

    return next;
  }, [
    timelineData?.file?.negID,
    timelineData?.file?.posID,
  ]);

  const formatEditableDateInput = useCallback((value, label) => {
    if (label != null && label !== "") return stripEditableEraSuffix(label);
    if (!Number.isFinite(value)) return value ?? "";
    return stripEditableEraSuffix(formatYear(
      value,
      timelineData?.file?.negID,
      timelineData?.file?.posID,
      timelineData?.file?.useCalendar === true,
      timelineData?.file?.hideDecimals
    ));
  }, [
    stripEditableEraSuffix,
    timelineData?.file?.negID,
    timelineData?.file?.posID,
    timelineData?.file?.useCalendar,
    timelineData?.file?.hideDecimals,
  ]);

  const getPickerIsoValue = useCallback((inputValue, fallbackValue) => {
    const parsed = parseTimelineInput(inputValue);
    const resolvedValue = Number.isFinite(parsed.value) ? parsed.value : fallbackValue;
    if (!Number.isFinite(resolvedValue)) return "";
    const { year, month, day } = fractionalYearToDate(resolvedValue);
    if (!Number.isFinite(year) || year < 0 || year > 9999) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, []);

  const getTimelineLimitIsoValue = useCallback((value) => {
    if (!Number.isFinite(value)) return "";
    const { year, month, day } = fractionalYearToDate(value);
    if (!Number.isFinite(year) || year < 0 || year > 9999) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, []);

  const calendarMinIso = showCalendarInputIcon
    ? getTimelineLimitIsoValue(timelineData?.file?.start)
    : "";
  const calendarMaxIso = showCalendarInputIcon
    ? getTimelineLimitIsoValue(timelineData?.file?.end)
    : "";

  const formatIsoAsEditableDate = useCallback((isoValue) => {
    const raw = String(isoValue ?? "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const [, year, month, day] = match;
    return `${month}/${day}/${year}`;
  }, []);

  const handleCalendarPick = useCallback((field, isoValue) => {
    const formatted = formatIsoAsEditableDate(isoValue);
    if (!formatted) return;
    const nextDraft = { ...formData, [field]: formatted };
    setFormData(nextDraft);
    commitDraft(nextDraft);
  }, [formData, formatIsoAsEditableDate]);

  const openCalendarPicker = useCallback((pickerKey) => {
    const input = datePickerRefs.current[pickerKey];
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  }, []);

  useEffect(() => {
    const anyOpen = isSpanParentMenuOpen || isMergeParentMenuOpen ||
      isParentMenuOpen || isTagMenuOpen || isGroupMenuOpen || isSpanRelationOpen;
    if (!anyOpen) return;
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setIsSpanParentMenuOpen(false);
      setIsMergeParentMenuOpen(false);
      setIsParentMenuOpen(false);
      setIsTagMenuOpen(false);
      setIsGroupMenuOpen(false);
      setIsSpanRelationOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSpanParentMenuOpen, isMergeParentMenuOpen, isParentMenuOpen, isTagMenuOpen, isGroupMenuOpen, isSpanRelationOpen]);

  useEffect(() => {
    if (selectedElement) {
      const prevId = prevSelectedIdRef.current;
      const shouldPreserveEditMode = isEditMode;
      setFormData({
        ...selectedElement,
        dateInput: formatEditableDateInput(selectedElement.date, selectedElement.dateLabel),
        startInput: formatEditableDateInput(selectedElement.start, selectedElement.startLabel),
        endInput: formatEditableDateInput(selectedElement.end, selectedElement.endLabel),
      });
      const parentId = selectedElement.parents?.[0];
      const parentTitle = parentId
        ? timelineData?.elements?.find((el) => el.id === parentId)?.title || parentId
        : "";
      setParentQuery(parentTitle);
      setTagQuery("");
      setValidationErrors([]);
      if (prevId !== selectedElement.id) {
        setSpanRelationType(selectedElement.extendFrom ? "extend" : "branch");
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
  }, [selectedElement, isEditMode, timelineData?.elements, formatEditableDateInput]);

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
        setNoteInitialContent("");
        setNoteExists(false);
        setIsNoteAddOpen(false);
        return;
      }
      const timelineId = timelineData?.file?.id?.replace('-timeline', '');
      if (!timelineId) return;
      setIsNoteLoading(true);
      const result = await readNote({ timelineId, filename: selectedElement.noteFile });
      if (!isMounted) return;
      setIsNoteLoading(false);
      if (result?.success) {
        setNoteInitialContent(result.content ?? "");
        setNoteExists(true);
      } else {
        if (result?.error === "NOT_FOUND") {
          const next = { ...selectedElement };
          delete next.noteFile;
          setFormData(next);
          onUpdate?.(next);
        }
        setNoteInitialContent("");
        setNoteExists(false);
      }
    };

    loadNote();
    return () => {
      isMounted = false;
    };
  }, [selectedElement?.id, selectedElement?.noteFile, timelineData?.file?.id]);

  useEffect(() => {
    if (!selectedElement?.wikiUrl) {
      setWikiContent("");
      setWikiError("");
      return;
    }
    fetchWikiContent(selectedElement.wikiUrl);
  }, [selectedElement?.wikiUrl]);

  useEffect(() => {
    if (!wikiRenderRef.current || !wikiContent) return;
    const container = wikiRenderRef.current;
    // Collapse infobox td cells with long lists (those not already wrapped by mw-collapsible)
    container.querySelectorAll(".infobox td").forEach((td) => {
      if (td.dataset.wikiInit) return;
      td.dataset.wikiInit = "1";
      if (td.querySelectorAll("li").length < 4) return;
      const contentWrap = document.createElement("div");
      contentWrap.className = "wiki-section-hidden";
      while (td.firstChild) contentWrap.appendChild(td.firstChild);
      const bracket = document.createElement("span");
      bracket.className = "wiki-toggle-bracket";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wiki-toggle-btn";
      btn.textContent = "show";
      bracket.appendChild(document.createTextNode("["));
      bracket.appendChild(btn);
      bracket.appendChild(document.createTextNode("]"));
      btn.addEventListener("click", () => {
        const nowHidden = contentWrap.classList.toggle("wiki-section-hidden");
        btn.textContent = nowHidden ? "show" : "hide";
      });
      td.appendChild(bracket);
      td.appendChild(contentWrap);
    });
  }, [wikiContent]);

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
          noteEditorRef.current?.save();
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
    };
  }, [isEditMode, formData]);

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

  const extendFromCandidates = useMemo(() => {
    if (!timelineData || !formData || formData.type !== "span" || !parentRange) return [];
    return timelineData.elements
      .filter((el) => el.type === "span" && el.id !== formData.id)
      .map((span) => ({
        ...span,
        _start: getSpanNumericStart(span),
        _end: getSpanNumericEnd(span),
      }))
      .filter((span) => Number.isFinite(span._end) && Math.abs(span._end - parentRange.start) < 1e-6);
  }, [timelineData, formData, parentRange]);

  const extendFromSuggestions = useMemo(() => {
    if (!spanParentQuery.trim()) return extendFromCandidates;
    const needle = spanParentQuery.trim().toLowerCase();
    return extendFromCandidates.filter((span) =>
      span.id.toLowerCase().includes(needle) ||
      (span.title || "").toLowerCase().includes(needle)
    );
  }, [extendFromCandidates, spanParentQuery]);

  const extendEnabled = useMemo(() => {
    const selectedId = formData?.parent || formData?.extendFrom;
    if (!selectedId) return extendFromCandidates.length > 0;
    return extendFromCandidates.some((c) => c.id === selectedId);
  }, [formData?.parent, formData?.extendFrom, extendFromCandidates]);

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
  const noteWordCount = useMemo(() => {
    if (!noteInitialContent) return 0;
    return noteInitialContent.trim().split(/\s+/).filter(Boolean).length;
  }, [noteInitialContent]);

  useEffect(() => {
    if (!noteRenderRef.current) return;
    const imgs = noteRenderRef.current.querySelectorAll('img');
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth === 0) {
        img.style.display = 'none';
      } else {
        img.addEventListener('error', function() {
          this.style.display = 'none';
          this.style.minHeight = '0';
        }, { once: true });
      }
    });
  }, [noteInitialContent]);


  const renderEventStrokeStyleControl = (field, currentValue, ariaLabel, variant) => (
    <div className="event-style-toggle" role="group" aria-label={ariaLabel}>
      {EVENT_STROKE_STYLE_OPTIONS.map((option) => {
        const isActive = (currentValue || "solid") === option.value;
        return (
          <button
            key={`${field}-${option.value}`}
            type="button"
            className={`event-style-option${isActive ? " is-active" : ""}`}
            aria-pressed={isActive ? "true" : "false"}
            aria-label={option.label}
            title={option.label}
            onClick={() => {
              const next = { ...formData, [field]: option.value };
              setFormData(next);
              commitDraft(next);
            }}
          >
            <span
              className={`event-style-preview event-style-preview-${variant} event-style-preview-${option.value}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );

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
    const { extendFrom: _e, ...base } = formData;
    const next = { ...base, parent: spanId };
    setFormData(next);
    commitDraft(next);
    setSpanParentQuery("");
    setIsSpanParentMenuOpen(false);
  };

  const setExtendFrom = (spanId) => {
    if (!spanId) return;
    const { parent: _p, ...base } = formData;
    const next = { ...base, extendFrom: spanId };
    setFormData(next);
    commitDraft(next);
    setSpanParentQuery("");
    setIsSpanParentMenuOpen(false);
  };

  const clearExtendFrom = () => {
    if (!formData.extendFrom) return;
    const { extendFrom: _e, ...rest } = formData;
    setFormData(rest);
    commitDraft(rest);
  };

  const clearSpanParent = () => {
    if (!formData.parent) return;
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
    setIsTagMenuOpen(false);
  };

  const removeTag = (tag) => {
    const existing = Array.isArray(formData.tags) ? formData.tags : [];
    const nextTags = existing.filter((value) => value !== tag);
    setFormData((prev) => ({ ...prev, tags: nextTags }));
    commitDraft({ ...formData, tags: nextTags });
  };

  const handleEditSource = (i) => {
    const src = formData.sources[i];
    setEditingSourceIndex(i);
    setSourceTitle(src.title || "");
    setSourceUrl(src.url || "");
    setSourceDescription(src.description || src.citation || "");
  };

  const handleSaveEditedSource = () => {
    const title = sourceTitle.trim();
    if (!title) return;
    const next = (Array.isArray(formData.sources) ? formData.sources : []).map((src, i) =>
      i === editingSourceIndex ? { title, url: sourceUrl.trim(), description: sourceDescription.trim() } : src
    );
    setFormData((prev) => ({ ...prev, sources: next }));
    commitDraft({ ...formData, sources: next });
    setEditingSourceIndex(null);
    setSourceTitle(""); setSourceUrl(""); setSourceDescription("");
  };

  const handleAddSource = () => {
    const title = sourceTitle.trim();
    if (!title) return;
    const next = [...(Array.isArray(formData.sources) ? formData.sources : []), { title, url: sourceUrl.trim(), description: sourceDescription.trim() }];
    setFormData((prev) => ({ ...prev, sources: next }));
    commitDraft({ ...formData, sources: next });
    setSourceTitle("");
    setSourceUrl("");
    setSourceDescription("");
    setIsSourceFormOpen(false);
  };

  const handleRemoveSource = (index) => {
    const next = (Array.isArray(formData.sources) ? formData.sources : []).filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, sources: next }));
    commitDraft({ ...formData, sources: next });
  };

  const commitDraft = (draft) => {
    let effectiveDraft = draft;

    const { errors, nextData } = buildValidatedUpdate(effectiveDraft, timelineData);
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

  const formatDisplayYear = useCallback((value) => (
    formatYear(
      value,
      timelineData?.file?.negID,
      timelineData?.file?.posID,
      timelineData?.file?.useCalendar === true,
      timelineData?.file?.hideDecimals
    )
  ), [
    timelineData?.file?.negID,
    timelineData?.file?.posID,
    timelineData?.file?.useCalendar,
    timelineData?.file?.hideDecimals,
  ]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => {
      if (prev && formData?.noteFile) noteEditorRef.current?.save();
      return !prev;
    });
  }, [formData?.noteFile]);


  useEffect(() => {
    if (!selectedElement) return;
    const handler = (e) => {
      if (e.key !== "e" && e.key !== "E") return;
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      e.preventDefault();
      toggleEditMode();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedElement, toggleEditMode]);

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
    setNoteInitialContent(result?.content ?? `# ${formData.title}\n\n`);
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
    setNoteInitialContent(result?.content ?? "");
    setNoteExists(true);
  };

  const handleNoteSave = async (content) => {
    if (!formData?.noteFile || !isSafeNoteFilename(formData.noteFile)) return;
    const timelineId = timelineData?.file?.id?.replace('-timeline', '');
    if (!timelineId) return;
    await writeNote({
      timelineId,
      filename: formData.noteFile,
      content,
    });
    setNoteInitialContent(content);
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
    setNoteInitialContent("");
    onUpdate?.(next);
  };

  const handleUnlinkNote = () => {
    if (!formData?.noteFile) return;
    const next = { ...formData };
    delete next.noteFile;
    setFormData(next);
    setNoteInitialContent("");
    setNoteExists(false);
    onUpdate?.(next);
  };

  const sanitizeWikiHtml = (html, host = "https://en.wikipedia.org") => {
    const preDoc = new DOMParser().parseFromString(html, "text/html");
    preDoc.querySelectorAll("img").forEach((img) => {
      const lazySrc = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
      if (lazySrc) img.setAttribute("src", lazySrc);
    });
    const sanitized = DOMPurify.sanitize(preDoc.body.innerHTML, {
      ALLOWED_TAGS: [
        "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code",
        "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt",
        "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
        "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre",
        "q", "s", "samp", "section", "small", "span", "strong", "sub",
        "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
        "time", "tr", "u", "ul", "var", "wbr",
      ],
      ALLOWED_ATTR: [
        "href", "target", "rel", "src", "alt", "title", "class", "id",
        "colspan", "rowspan", "scope", "headers", "width", "height",
        "loading", "decoding",
      ],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
      KEEP_CONTENT: true,
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "text/html");
    doc.body.querySelectorAll("a").forEach((node) => {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
      const href = node.getAttribute("href");
      if (href && href.startsWith("/wiki/")) {
        node.setAttribute("href", `${host}${href}`);
      } else if (href && href.startsWith("./")) {
        node.setAttribute("href", `${host}/wiki/${href.slice(2)}`);
      }
    });
    doc.body.querySelectorAll("img").forEach((node) => {
      let src = node.getAttribute("src");
      if (src && src.startsWith("//")) {
        src = `https:${src}`;
      } else if (src && src.startsWith("/")) {
        src = `${host}${src}`;
      }
      if (src) {
        src = src.replace(/\/revision\/latest\/[^?]+/, "/revision/latest");
        node.setAttribute("src", src);
      }
      node.setAttribute("loading", "eager");
    });

    // Remove embedded map widgets and coordinate/map-link blocks that render as noisy lists in-panel.
    const mapLikeSelectors = [
      ".mw-kartographer-map",
      ".mw-kartographer-maplink",
      ".mw-kartographer-container",
      ".locmap",
      ".maptable",
      ".maplink",
      ".mapframe",
      ".coordinates",
      ".geo-inline-hidden",
      ".plainlist .geo",
      ".plainlist .geo-inline",
    ];
    doc.body.querySelectorAll(mapLikeSelectors.join(",")).forEach((node) => {
      const removableWrapper = node.closest("li, tr, figure, p, div");
      if (removableWrapper && removableWrapper !== doc.body && removableWrapper.textContent?.trim() === node.textContent?.trim()) {
        removableWrapper.remove();
      } else {
        node.remove();
      }
    });
    doc.body.querySelectorAll('a[href*="geohack"], a[href*="openstreetmap"], a[href*="maplink"], a[href*="maps.wikimedia"]').forEach((node) => {
      const removableWrapper = node.closest("li, tr, p, div");
      if (removableWrapper && /map|coordinate|openstreetmap|geohack/i.test(removableWrapper.textContent || "")) {
        removableWrapper.remove();
      } else {
        node.remove();
      }
    });
    doc.body.querySelectorAll(".infobox tr").forEach((row) => {
      const rowText = (row.textContent || "").toLowerCase();
      const hasMapMarkers = Boolean(
        row.querySelector(
          '.mw-kartographer-map, .mw-kartographer-maplink, .mw-kartographer-container, .locmap, .maptable, .mapframe, .coordinates, .geo, a[href*="geohack"], a[href*="openstreetmap"], a[href*="maps.wikimedia"]'
        )
      );
      const looksLikeLocationList =
        row.querySelector(".plainlist, ul, ol") &&
        /map|location|locations|coordinates|coord\./.test(rowText);
      if (hasMapMarkers || looksLikeLocationList) {
        row.remove();
      }
    });

    // Transform mw-collapsible sections (sidebar lists) into native <details>/<summary>
    doc.body.querySelectorAll(".mw-collapsible").forEach((collapsible) => {
      const isOpen = !collapsible.classList.contains("mw-collapsed");
      const titleEl = collapsible.querySelector(".sidebar-list-title");
      const contentEl = collapsible.querySelector(".mw-collapsible-content");
      if (!titleEl || !contentEl) return;
      collapsible.querySelectorAll(".mw-collapsible-text").forEach((el) => el.remove());
      const details = doc.createElement("details");
      if (isOpen) details.open = true;
      details.className = "wiki-sidebar-section";
      const summary = doc.createElement("summary");
      summary.className = "wiki-sidebar-summary";
      while (titleEl.firstChild) summary.appendChild(titleEl.firstChild);
      details.appendChild(summary);
      contentEl.classList.add("wiki-sidebar-content");
      details.appendChild(contentEl);
      collapsible.parentNode.replaceChild(details, collapsible);
    });

    return doc.body.innerHTML;
  };

  const fetchWikiContent = async (url) => {
    if (!url) return;

    const cacheKey = `${WIKI_SANITIZE_VERSION}:${url}`;
    if (wikiCacheRef.current.has(cacheKey)) {
      setWikiContent(wikiCacheRef.current.get(cacheKey));
      setWikiError("");
      return;
    }

    const parsed = parseMediaWikiUrl(url);
    if (!parsed) {
      setWikiError("Invalid wiki URL");
      setWikiContent("");
      return;
    }

    setIsWikiLoading(true);
    setWikiError("");

    try {
      const apiPaths = [`${parsed.host}/api.php`, `${parsed.host}/w/api.php`];
      const query = `?action=parse&page=${encodeURIComponent(parsed.title)}&prop=text&disabletoc=1&format=json&formatversion=2`;
      let data = null;
      for (const base of apiPaths) {
        const result = await fetchWikipedia({ url: base + query });
        if (!result?.success) continue;
        const parsed2 = JSON.parse(result.html);
        if (parsed2?.parse?.text) { data = parsed2; break; }
      }
      if (!data) throw new Error("No content returned");
      const wikiHtml = data.parse.text;
      const sanitized = sanitizeWikiHtml(wikiHtml, parsed.host);
      wikiCacheRef.current.set(cacheKey, sanitized);
      setWikiContent(sanitized);
    } catch (err) {
      setWikiError(`Failed to load wiki article: ${err.message}`);
      setWikiContent("");
    } finally {
      setIsWikiLoading(false);
    }
  };

  const [wikiUrlInput, setWikiUrlInput] = useState("");
  const [isWikiUrlInputOpen, setIsWikiUrlInputOpen] = useState(false);
  const [wikiUrlInputError, setWikiUrlInputError] = useState("");
  const wikiUrlInputRef = useRef(null);

  const handleOpenWikiInput = () => {
    setWikiUrlInput(formData.wikiUrl || "");
    setWikiUrlInputError("");
    setIsWikiUrlInputOpen(true);
    setTimeout(() => wikiUrlInputRef.current?.focus(), 0);
  };

  const handleWikiUrlSubmit = () => {
    const trimmed = wikiUrlInput.trim();
    if (!trimmed) {
      setIsWikiUrlInputOpen(false);
      setWikiUrlInputError("");
      return;
    }
    if (!parseMediaWikiUrl(trimmed)) {
      setWikiUrlInputError("Enter a valid MediaWiki URL (e.g., https://en.wikipedia.org/wiki/Ancient_Greece)");
      return;
    }
    const next = { ...formData, wikiUrl: trimmed };
    setFormData(next);
    commitDraft(next);
    setIsWikiUrlInputOpen(false);
    setWikiUrlInputError("");
  };

  const handleWikiUrlKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleWikiUrlSubmit();
    } else if (e.key === "Escape") {
      setIsWikiUrlInputOpen(false);
      setWikiUrlInputError("");
    }
  };

  const handleRemoveWikiUrl = () => {
    const next = { ...formData };
    delete next.wikiUrl;
    setFormData(next);
    setWikiContent("");
    setWikiError("");
    setIsWikiUrlInputOpen(false);
    setWikiUrlInputError("");
    commitDraft(next);
  };

  const renderNoteMarkdown = (content, isLoading) => {
    const raw = isLoading ? "_Loading note..._" : content || "";
    const withUnderline = raw.replace(/__(.+?)__/g, "<u>$1</u>");
    const withHighlight = withUnderline.replace(/==(.+?)==/g, "<mark>$1</mark>");

    const extractYouTubeId = (url) => {
      try {
        const u = new URL(url);
        if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
        if (u.hostname.endsWith("youtube.com")) return u.searchParams.get("v");
      } catch {}
      return null;
    };

    const extractVimeoId = (url) => {
      try {
        const u = new URL(url);
        if (u.hostname === "vimeo.com" || u.hostname.endsWith(".vimeo.com")) {
          const match = u.pathname.match(/\/(\d+)/);
          return match ? match[1] : null;
        }
      } catch {}
      return null;
    };

    const renderer = new marked.Renderer();
    const originalImage = renderer.image.bind(renderer);
    renderer.image = (href, title, text) => {
      const youtubeId = extractYouTubeId(href);
      if (youtubeId) {
        return `<iframe class="video-embed" src="https://www.youtube-nocookie.com/embed/${youtubeId}" width="560" height="315" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
      }
      const vimeoId = extractVimeoId(href);
      if (vimeoId) {
        return `<iframe class="video-embed" src="https://player.vimeo.com/video/${vimeoId}" width="560" height="315" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>`;
      }
      return originalImage(href, title, text);
    };

    const html = marked.parse(withHighlight, { renderer });
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
        "iframe",
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
        "frameborder",
        "allowfullscreen",
        "allow",
        "class",
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

      if (tagName === "iframe") {
        const ALLOWED_IFRAME_ORIGINS = [
          "https://www.youtube-nocookie.com",
          "https://www.youtube.com",
          "https://player.vimeo.com",
        ];
        const src = node.getAttribute("src") || "";
        const allowed = ALLOWED_IFRAME_ORIGINS.some((origin) =>
          src.startsWith(origin + "/")
        );
        if (!allowed) {
          node.remove();
          return;
        }
      }
    });

    return doc.body.innerHTML;
  };

  const renderedNoteHtml = useMemo(
    () => renderNoteMarkdown(noteInitialContent, isNoteLoading),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteInitialContent, isNoteLoading, notesBaseUrl, notesBasePath]
  );

  const noteViewCallbackRef = useCallback((node) => {
    noteRenderRef.current = node;
    if (node) node.innerHTML = renderedNoteHtml;
  }, [renderedNoteHtml]);

  const showLegacyBreaks = timelineData?.file?.allowLegacyBreaks === true;

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
        <span className="rp-type-label">{formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}</span>
        <div className="right-panel-actions">
          <button
            className="close-button"
            type="button"
            onClick={toggleEditMode}
            title={isEditMode ? "Switch to overview" : "Edit"}
          >
            {isEditMode ? <BookOpen size={18} /> : <Pencil size={18} />}
          </button>
          <button
            className="close-button"
            onClick={onToggleMaximize}
            title={isMaximized ? "Restore panel" : "Maximize panel"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div className="right-panel-content">
        {!isEditMode ? (
          /* View Mode */
          <div className="view-mode">
            {/* Title */}
            <div className="view-group view-group-title">
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
                      formatDisplayYear(formData.date)}
                  </p>
                </div>
            ) : (
              <div className="view-group">
                <label>Date</label>
                <div className="view-separator" />
                <p>
                  {(formData.startLabel ?? formatDisplayYear(formData.start))}
                  {" – "}
                  {(formData.endLabel ?? formatDisplayYear(formData.end))}
                </p>
              </div>
            )}

            {/* Color (spans and eras only) */}

            {/* Parent (events only) */}
            {formData.type === "event" && formData.parents && formData.parents.length > 0 && formData.parents[0] && (
              <div className="view-group">
                <label>Parent</label>
                <div className="view-separator" />
                <button
                  type="button"
                  className="parent-link"
                  onClick={() => onSelect(formData.parents[0])}
                >
                  {timelineData.elements.find(el => el.id === formData.parents[0])?.title || formData.parents[0]}
                </button>
              </div>
            )}

            {/* Parent span (spans only) */}
            {formData.type === "span" && formData.parent && (
              <div className="view-group">
                <label>Parent</label>
                <div className="view-separator" />
                <button
                  type="button"
                  className="parent-link"
                  onClick={() => onSelect(formData.parent)}
                >
                  {timelineData.elements.find(el => el.id === formData.parent)?.title || formData.parent}
                </button>
              </div>
            )}


            {/* Merge target (spans only) */}
            {formData.type === "span" && formData.mergeParent && (
              <div className="view-group">
                <label>Merge Into</label>
                <div className="view-separator" />
                <button
                  type="button"
                  className="parent-link"
                  onClick={() => onSelect(formData.mergeParent)}
                >
                  {timelineData.elements.find(el => el.id === formData.mergeParent)?.title || formData.mergeParent}
                </button>
              </div>
            )}

            {formData.type === "span" && formData.extendFrom && (
              <div className="view-group">
                <label>Extend From</label>
                <div className="view-separator" />
                <button
                  type="button"
                  className="parent-link"
                  onClick={() => onSelect(formData.extendFrom)}
                >
                  {timelineData.elements.find(el => el.id === formData.extendFrom)?.title || formData.extendFrom}
                </button>
              </div>
            )}

            {/* Tags */}
            {Array.isArray(formData.tags) && formData.tags.length > 0 && (
              <div className="view-group view-group-chips">
                <label>Tags</label>
                <div className="view-separator" />
                <div className="tag-chip-list">
                  {formData.tags.map((tag) => {
                    const isSelected = activeTags.includes(tag);
                    const tagColor = tagColors[tag];
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
                        <span className="tag-chip-dot" style={{ background: tagColor || "var(--element-bg)" }} />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Group (events and spans only, view mode) */}
            {(formData.type === "event" || formData.type === "span") && (() => {
              const groups = timelineData?.file?.groups || [];
              const group = groups.find((g) => g.id === formData.groupId);
              return group ? (
                <div className="view-group">
                  <label>Group</label>
                  <div className="view-separator" />
                  <p>{group.title || group.id}</p>
                </div>
              ) : null;
            })()}

            {timelineData?.file?.useMaps && (formData.lat != null || formData.lng != null) && (
              <div className="view-group">
                <label>Coordinates</label>
                <div className="view-separator" />
                <p>{[formData.lat, formData.lng].filter((v) => v !== "" && v != null).join(", ")}</p>
              </div>
            )}

            {formData.noteFile && (
              <>
                <div className="note-divider" />
                <button type="button" className="rp-note-header sources-collapse-btn" onClick={() => setIsNoteCollapsed(v => !v)}>
                  <span className="rp-note-label rp-note-label-note">Note</span>
                  <span className="sources-collapse-right">
                    {noteWordCount > 0 && <span className="rp-note-meta">markdown · {noteWordCount} words</span>}
                    <ChevronDown size={14} style={{transform: isNoteCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--element-bg)'}} />
                  </span>
                </button>
                {!isNoteCollapsed && (
                  <div className="note-render" ref={noteViewCallbackRef} />
                )}
              </>
            )}

            {timelineData?.file?.useWikipedia && formData.wikiUrl && (
              <>
                <div className="note-divider" />
                <button type="button" className="rp-note-header sources-collapse-btn" onClick={() => setIsWikiCollapsed(v => !v)}>
                  <span className="rp-note-label rp-note-label-wiki">Wiki</span>
                  <span className="sources-collapse-right">
                    <a
                      className="rp-note-meta wiki-header-link"
                      href={formData.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in browser"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open article
                    </a>
                    <ChevronDown size={14} style={{transform: isWikiCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--element-bg)'}} />
                  </span>
                </button>
                {!isWikiCollapsed && (isWikiLoading ? (
                  <div className="wiki-loading">Loading wiki article...</div>
                ) : wikiError ? (
                  <div className="wiki-error">{wikiError}</div>
                ) : (
                  <div
                    ref={wikiRenderRef}
                    className="wiki-render"
                    dangerouslySetInnerHTML={{ __html: wikiContent }}
                  />
                ))}
              </>
            )}

            {Array.isArray(formData.sources) && formData.sources.length > 0 && (
              <>
                <div className="note-divider" />
                <button type="button" className="rp-note-header sources-collapse-btn" onClick={() => setIsSourcesCollapsed(v => !v)}>
                  <span className="rp-sources-label"><Link size={12} strokeWidth={2} />Sources</span>
                  <span className="sources-collapse-right">
                    <span className="rp-note-meta">{formData.sources.length}</span>
                    <ChevronDown size={14} style={{transform: isSourcesCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--element-bg)'}} />
                  </span>
                </button>
                {!isSourcesCollapsed && (
                  <div className="sources-list">
                    {formData.sources.map((src, i) => (
                      <div key={i} className="wiki-url-card">
                        <div className="wiki-url-card-avatar">{src.title.charAt(0).toUpperCase()}</div>
                        <div className="wiki-url-card-info">
                          <div className="wiki-url-card-title">{src.title}</div>
                          {(src.description || src.citation) && <div className="wiki-url-card-host">{src.description || src.citation}</div>}
                        </div>
                        {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" className="wiki-url-card-btn" title="Open"><ExternalLink size={13} /></a>}
                      </div>
                    ))}
                  </div>
                )}
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

            {/* Details */}

            {/* Title */}
            <div className="form-group">
              <div className="edit-row">
                <label htmlFor="title">Name</label>
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
                  <div className={`edit-input-shell${showCalendarInputIcon ? " has-left-icon" : ""}`}>
                    {showCalendarInputIcon && (
                      <>
                        <button
                          type="button"
                          className="edit-input-icon-button"
                          aria-label="Open calendar"
                          onClick={() => openCalendarPicker("date")}
                        >
                          <Calendar size={14} className="edit-input-icon" aria-hidden="true" />
                        </button>
                        <input
                          ref={(node) => {
                            if (node) datePickerRefs.current.date = node;
                            else delete datePickerRefs.current.date;
                          }}
                          type="date"
                          tabIndex={-1}
                          aria-hidden="true"
                          className="edit-input-native-date"
                          value={getPickerIsoValue(formData.dateInput, selectedElement?.date)}
                          min={calendarMinIso || undefined}
                          max={calendarMaxIso || undefined}
                          onChange={(e) => handleCalendarPick("dateInput", e.target.value)}
                        />
                      </>
                    )}
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
              </div>
            ) : (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="start">Start Year</label>
                    <div className="edit-separator" />
                  <div className={`edit-input-shell${showCalendarInputIcon ? " has-left-icon" : ""}`}>
                    {showCalendarInputIcon && (
                      <>
                        <button
                          type="button"
                          className="edit-input-icon-button"
                          aria-label="Open calendar"
                          onClick={() => openCalendarPicker("start")}
                        >
                          <Calendar size={14} className="edit-input-icon" aria-hidden="true" />
                        </button>
                        <input
                          ref={(node) => {
                            if (node) datePickerRefs.current.start = node;
                            else delete datePickerRefs.current.start;
                          }}
                          type="date"
                          tabIndex={-1}
                          aria-hidden="true"
                          className="edit-input-native-date"
                          value={getPickerIsoValue(formData.startInput, selectedElement?.start)}
                          min={calendarMinIso || undefined}
                          max={calendarMaxIso || undefined}
                          onChange={(e) => handleCalendarPick("startInput", e.target.value)}
                        />
                      </>
                    )}
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
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="end">End Year</label>
                    <div className="edit-separator" />
                  <div className={`edit-input-shell${showCalendarInputIcon ? " has-left-icon" : ""}`}>
                    {showCalendarInputIcon && (
                      <>
                        <button
                          type="button"
                          className="edit-input-icon-button"
                          aria-label="Open calendar"
                          onClick={() => openCalendarPicker("end")}
                        >
                          <Calendar size={14} className="edit-input-icon" aria-hidden="true" />
                        </button>
                        <input
                          ref={(node) => {
                            if (node) datePickerRefs.current.end = node;
                            else delete datePickerRefs.current.end;
                          }}
                          type="date"
                          tabIndex={-1}
                          aria-hidden="true"
                          className="edit-input-native-date"
                          value={getPickerIsoValue(formData.endInput, selectedElement?.end)}
                          min={calendarMinIso || undefined}
                          max={calendarMaxIso || undefined}
                          onChange={(e) => handleCalendarPick("endInput", e.target.value)}
                        />
                      </>
                    )}
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
                </div>
              </>
            )}

            {/* Relations */}
            {(formData.type === "event" || formData.type === "span") && (
              <>
            {/* Parent (events only) */}
            {formData.type === "event" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="parents">Parent</label>
                  <div className="edit-separator" />
                  <div className="span-relation-wrap">
                    {formData.parents?.[0] ? (
                      <div className="relation-selected-list">
                        <div className="relation-selected-item">
                          <button type="button" className="relation-selected-link" onClick={() => onSelect(formData.parents[0])}>
                            {timelineData.elements.find((el) => el.id === formData.parents[0])?.title || formData.parents[0]}
                          </button>
                          <button type="button" className="relation-selected-remove" onClick={() => { const next = { ...formData, parents: [] }; setFormData(next); commitDraft(next); setParentQuery(""); }}>×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="branch-picker">
                        <input
                          id="parents" type="text" value={parentQuery}
                          onChange={(e) => { setParentQuery(e.target.value); setIsParentMenuOpen(true); }}
                          onFocus={() => setIsParentMenuOpen(true)}
                          onBlur={handleParentBlur}
                          placeholder="Search span..." className="edit-input branch-input"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const choice = parentSuggestions[0]; if (choice) { const next = { ...formData, parents: [choice.id], groupId: choice.groupId ?? formData.groupId }; setFormData(next); commitDraft(next); setParentQuery(""); setIsParentMenuOpen(false); } } }}
                        />
                        {isParentMenuOpen && (
                          <div className="branch-suggestions">
                            {parentSuggestions.length > 0 ? parentSuggestions.map((span) => (
                              <button key={span.id} type="button" className="branch-suggestion-item" onMouseDown={(e) => { e.preventDefault(); const next = { ...formData, parents: [span.id], groupId: span.groupId ?? formData.groupId }; setFormData(next); commitDraft(next); setParentQuery(""); setIsParentMenuOpen(false); }}>
                                <span className="branch-suggestion-title">{span.title || span.id}</span>
                                <span className="branch-suggestion-id">{span.id}</span>
                              </button>
                            )) : <div className="branch-suggestion-empty">No matching spans</div>}
                          </div>
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
                  <div className="span-relation-wrap">
                    <div className="span-relation-dropdown">
                      <button
                        type="button"
                        className="span-relation-dropdown-btn"
                        onClick={() => setIsSpanRelationOpen((v) => !v)}
                      >
                        {spanRelationType === "branch" ? "Branch from" : "Extend from"}
                        <ChevronDown size={10} />
                      </button>
                      {isSpanRelationOpen && (
                        <div className="span-relation-dropdown-menu">
                          <button
                            type="button"
                            className={`span-relation-dropdown-item${spanRelationType === "branch" ? " active" : ""}`}
                            onMouseDown={() => {
                              if (spanRelationType === "extend" && formData.extendFrom) {
                                const { extendFrom: _e, ...base } = formData;
                                const next = { ...base, parent: formData.extendFrom };
                                setFormData(next);
                                commitDraft(next);
                              }
                              setSpanRelationType("branch");
                              setIsSpanRelationOpen(false);
                              setSpanParentQuery("");
                            }}
                          >Branch from</button>
                          <button
                            type="button"
                            className={`span-relation-dropdown-item${spanRelationType === "extend" ? " active" : ""}${!extendEnabled ? " disabled" : ""}`}
                            disabled={!extendEnabled}
                            onMouseDown={() => {
                              if (!extendEnabled) return;
                              if (spanRelationType === "branch" && formData.parent) {
                                const { parent: _p, ...base } = formData;
                                const next = { ...base, extendFrom: formData.parent };
                                setFormData(next);
                                commitDraft(next);
                              }
                              setSpanRelationType("extend");
                              setIsSpanRelationOpen(false);
                              setSpanParentQuery("");
                            }}
                          >Extend from</button>
                        </div>
                      )}
                    </div>
                    {(formData.parent || formData.extendFrom) ? (
                      <div className="relation-selected-list">
                        <div className="relation-selected-item">
                          <button type="button" className="relation-selected-link" onClick={() => onSelect(formData.parent || formData.extendFrom)}>
                            {(() => { const id = formData.parent || formData.extendFrom; return timelineData.elements.find((el) => el.id === id)?.title || id; })()}
                          </button>
                          <button type="button" className="relation-selected-remove" onClick={() => { clearSpanParent(); clearExtendFrom(); }}>×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="branch-picker">
                        <input
                          id="spanParent" type="text" value={spanParentQuery}
                          onChange={(e) => { setSpanParentQuery(e.target.value); setIsSpanParentMenuOpen(true); }}
                          onFocus={() => setIsSpanParentMenuOpen(true)}
                          onBlur={handleSpanParentBlur}
                          placeholder="Search span..." className="edit-input branch-input" maxLength={ID_MAX_LENGTH}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const suggestions = spanRelationType === "branch" ? spanParentSuggestions : extendFromSuggestions; if (suggestions.length > 0) { if (spanRelationType === "branch") setSpanParent(suggestions[0].id); else setExtendFrom(suggestions[0].id); } } }}
                        />
                        {isSpanParentMenuOpen && spanParentQuery.trim().length > 0 && (() => {
                          const suggestions = spanRelationType === "branch" ? spanParentSuggestions : extendFromSuggestions;
                          const emptyMsg = spanRelationType === "branch" ? "No matching spans" : "No contiguous spans";
                          return (
                            <div className="branch-suggestions">
                              {suggestions.length > 0 ? suggestions.map((span) => (
                                <button key={span.id} type="button" className="branch-suggestion-item" onMouseDown={(e) => { e.preventDefault(); if (spanRelationType === "branch") setSpanParent(span.id); else setExtendFrom(span.id); }}>
                                  <span className="branch-suggestion-title">{span.title || span.id}</span>
                                  <span className="branch-suggestion-id">{span.id}</span>
                                </button>
                              )) : <div className="branch-suggestion-empty">{emptyMsg}</div>}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="mergeParent">Merge Into</label>
                  <div className="edit-separator" />
                  <div className="span-relation-wrap"><div className="branch-picker">
                    {formData.mergeParent ? (
                      <div className="relation-selected-list">
                        <div className="relation-selected-item">
                          <button type="button" className="relation-selected-link" onClick={() => onSelect(formData.mergeParent)}>
                            {timelineData.elements.find((el) => el.id === formData.mergeParent)?.title || formData.mergeParent}
                          </button>
                          <button type="button" className="relation-selected-remove" onClick={clearMergeParent}>×</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <input
                          id="mergeParent" type="text" value={mergeParentQuery}
                          onChange={(e) => { setMergeParentQuery(e.target.value); setIsMergeParentMenuOpen(true); }}
                          onFocus={() => setIsMergeParentMenuOpen(true)}
                          onBlur={handleMergeParentBlur}
                          placeholder="Search span..." className="edit-input branch-input" maxLength={ID_MAX_LENGTH}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (mergeParentSuggestions.length > 0) setMergeParent(mergeParentSuggestions[0].id); } }}
                        />
                        {isMergeParentMenuOpen && mergeParentQuery.trim().length > 0 && (
                          <div className="branch-suggestions">
                            {mergeParentSuggestions.length > 0 ? mergeParentSuggestions.map((span) => (
                              <button key={span.id} type="button" className="branch-suggestion-item" onMouseDown={(e) => { e.preventDefault(); setMergeParent(span.id); }}>
                                <span className="branch-suggestion-title">{span.title || span.id}</span>
                                <span className="branch-suggestion-id">{span.id}</span>
                              </button>
                            )) : <div className="branch-suggestion-empty">No matching spans</div>}
                          </div>
                        )}
                      </>
                    )}
                  </div></div>
                </div>
              </div>
            )}

            </>)}

            {/* Tags */}
            <div className="form-group">
              <div className="edit-row edit-row-tags">
                <label htmlFor="tags">Tags</label>
                <div className="tag-edit-flow">
                  {Array.isArray(formData.tags) && formData.tags.map((tag) => (
                    <div key={tag} className="tag-edit-chip">
                      <span>{tag}</span>
                      <button
                        type="button"
                        className="tag-edit-remove"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >×</button>
                    </div>
                  ))}
                  <div className="branch-picker tag-picker tag-edit-picker">
                    {!isTagMenuOpen && (
                      <button type="button" className="tag-add-chip" onClick={() => { setIsTagMenuOpen(true); document.getElementById('tags')?.focus(); }}>
                        + Add tag
                      </button>
                    )}
                    <input
                      id="tags"
                      type="text"
                      value={tagQuery}
                      onChange={(e) => {
                        setTagQuery(e.target.value);
                        setIsTagMenuOpen(true);
                        if (validationErrors.length) setValidationErrors([]);
                      }}
                      onFocus={() => { clearTimeout(tagMenuTimeoutRef.current); setIsTagMenuOpen(true); }}
                      onBlur={handleTagBlur}
                      placeholder="add tag..."
                      className="tag-edit-input"
                      style={{display: isTagMenuOpen ? 'block' : 'none'}}
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
              </div>
            </div>

            {/* Group (events and spans only) */}
            {(formData.type === "event" || formData.type === "span") && (() => {
              const groups = timelineData?.file?.groups || [];
              const filteredGroups = groups.filter((g) =>
                !newGroupName || (g.title || g.id).toLowerCase().includes(newGroupName.toLowerCase())
              );
              const handleGroupBlur = () => {
                groupMenuTimeoutRef.current = setTimeout(() => setIsGroupMenuOpen(false), 150);
              };
              const addGroup = (name) => {
                const trimmed = name.trim();
                if (!trimmed) return;
                const id = `g-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
                if (groups.some((g) => g.id === id)) {
                  const next = { ...formData, groupId: id };
                  setFormData(next);
                  commitDraft(next);
                } else {
                  const maxStack = groups.reduce((max, g) => Math.max(max, g.stack || 0), 0);
                  const newGroup = { id, title: trimmed, order: groups.length, stack: maxStack + 1, visible: true };
                  onUpdateGroups([...groups, newGroup]);
                  const next = { ...formData, groupId: id };
                  setFormData(next);
                  commitDraft(next);
                }
                setNewGroupName("");
                setIsGroupMenuOpen(false);
              };
              return (
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="groupId">Group</label>
                    <div className="edit-separator" />
                    <div className="edit-select-wrap">
                      <select
                        id="groupId"
                        className="edit-select"
                        value={formData.groupId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          const next = { ...formData, groupId: val };
                          setFormData(next);
                          commitDraft(next);
                        }}
                      >
                        <option value="">Inherit</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.title || g.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Map */}
            {timelineData?.file?.useMaps && (
              <div className="form-group">
                <div className="edit-row">
                  <label>Coordinates</label>
                  <div className="edit-separator" />
                  <div className="coord-inputs">
                    <input
                      id="lat"
                      type="number"
                      className="edit-input"
                      value={formData.lat ?? ""}
                      onChange={(e) => handleChange("lat", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => commitDraft({ ...formData, lat: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="lat"
                      step="any"
                    />
                    <span className="coord-sep">,</span>
                    <input
                      id="lng"
                      type="number"
                      className="edit-input"
                      value={formData.lng ?? ""}
                      onChange={(e) => handleChange("lng", e.target.value === "" ? null : Number(e.target.value))}
                      onBlur={(e) => commitDraft({ ...formData, lng: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="lng"
                      step="any"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Style */}
            <div className="edit-section-divider" />

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

            {/* Size (spans only) */}
            {formData.type === "span" && (
              <div className="form-group">
                <div className="edit-row">
                  <label htmlFor="spanSize">Size</label>
                  <div className="edit-separator" />
                  <div className="edit-select-wrap">
                    <select
                      id="spanSize"
                      className="edit-select"
                      value={formData.spanSize || "normal"}
                      onChange={(e) => {
                        const val = e.target.value === "normal" ? undefined : e.target.value;
                        const next = { ...formData };
                        if (val) {
                          next.spanSize = val;
                        } else {
                          delete next.spanSize;
                        }
                        setFormData(next);
                        commitDraft(next);
                      }}
                    >
                      <option value="thin">Thin</option>
                      <option value="normal">Normal</option>
                      <option value="thick">Thick</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {formData.type === "span" && (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="hideSpanDetails">Hide Details</label>
                    <div className="edit-separator" />
                    <label className="settings-toggle" style={{gridColumn: 2, justifySelf: 'end'}}>
                      <input
                        id="hideSpanDetails"
                        type="checkbox"
                        checked={formData.hideDetails === true || (formData.hideName === true && formData.hideYears === true)}
                        onChange={(e) => {
                          const next = { ...formData, hideDetails: e.target.checked };
                          delete next.hideName;
                          delete next.hideYears;
                          setFormData(next);
                          commitDraft(next);
                        }}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="hideSpanYears">Hide Year</label>
                    <div className="edit-separator" />
                    <label className="settings-toggle" style={{gridColumn: 2, justifySelf: 'end'}}>
                      <input
                        id="hideSpanYears"
                        type="checkbox"
                        checked={formData.hideYears === true}
                        onChange={(e) => {
                          const next = { ...formData };
                          if (e.target.checked) { next.hideYears = true; } else { delete next.hideYears; }
                          setFormData(next);
                          commitDraft(next);
                        }}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                </div>
              </>
            )}

            {formData.type === "era" && (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="eraSize">Size</label>
                    <div className="edit-separator" />
                    <div className="edit-select-wrap">
                      <select
                        id="eraSize"
                        className="edit-select"
                        value={formData.eraSize || "normal"}
                        onChange={(e) => {
                          const val = e.target.value === "normal" ? undefined : e.target.value;
                          const next = { ...formData };
                          if (val) {
                            next.eraSize = val;
                          } else {
                            delete next.eraSize;
                          }
                          setFormData(next);
                          commitDraft(next);
                        }}
                      >
                        <option value="normal">Normal</option>
                        <option value="thick">Thick</option>
                        <option value="extra-thick">Extra Thick</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="hideEraDetails">Hide Details</label>
                    <div className="edit-separator" />
                    <label className="settings-toggle" style={{gridColumn: 2, justifySelf: 'end'}}>
                      <input
                        id="hideEraDetails"
                        type="checkbox"
                        checked={formData.hideDetails === true}
                        onChange={(e) => {
                          const next = { ...formData };
                          if (e.target.checked) { next.hideDetails = true; } else { delete next.hideDetails; }
                          setFormData(next);
                          commitDraft(next);
                        }}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Event styling (events only) */}
            {formData.type === "event" && (
              <>
                <div className="form-group">
                  <div className="edit-row">
                    <label>Line Style</label>
                    <div className="edit-separator" />
                    {renderEventStrokeStyleControl("eventLineStyle", formData.eventLineStyle, "Event line style", "line")}
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label>Border Style</label>
                    <div className="edit-separator" />
                    {renderEventStrokeStyleControl("eventBorderStyle", formData.eventBorderStyle, "Event border style", "border")}
                  </div>
                </div>
                <div className="form-group">
                  <div className="edit-row">
                    <label htmlFor="hideEventYears">Hide Year</label>
                    <div className="edit-separator" />
                    <label className="settings-toggle" style={{gridColumn: 2, justifySelf: 'end'}}>
                      <input
                        id="hideEventYears"
                        type="checkbox"
                        checked={formData.hideYears === true}
                        onChange={(e) => {
                          const next = { ...formData };
                          if (e.target.checked) { next.hideYears = true; } else { delete next.hideYears; }
                          setFormData(next);
                          commitDraft(next);
                        }}
                      />
                      <span className="settings-toggle-slider" />
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="edit-section-divider" />

            {/* Breaks */}
            {showLegacyBreaks && formData.type === "span" && (
                <div className="breaks-list">
                  {Array.isArray(formData.breaks) && formData.breaks.length > 0 && (
                    formData.breaks
                      .map((brk, idx) => ({ ...brk, _idx: idx }))
                      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
                      .map((brk) => {
                        const idx = brk._idx;
                        return (
                          <div key={idx} className="break-item">
                            <div className="break-item-header">
                              <span className="break-item-label">Break {formData.breaks
                                .map((b, i) => ({ ...b, _i: i }))
                                .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
                                .findIndex((b) => b._i === idx) + 1}</span>
                              <button
                                type="button"
                                className="break-remove"
                                onClick={() => {
                                  const nextBreaks = formData.breaks.filter((_, i) => i !== idx);
                                  handleChange("breaks", nextBreaks);
                                  commitDraft({ ...formData, breaks: nextBreaks });
                                }}
                                aria-label="Remove break"
                              >
                                ×
                              </button>
                            </div>
                            <div className="break-field">
                              <label>year</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={brk.yearInput ?? String(brk.year ?? "")}
                                onChange={(e) => {
                                  const nextBreaks = [...formData.breaks];
                                  nextBreaks[idx] = { ...nextBreaks[idx], yearInput: e.target.value };
                                  handleChange("breaks", nextBreaks);
                                }}
                                onBlur={(e) => {
                                  const parsed = parseTimelineInput(e.target.value);
                                  if (parsed.value !== null) {
                                    const nextBreaks = [...formData.breaks];
                                    nextBreaks[idx] = { ...nextBreaks[idx], year: parsed.value, yearInput: undefined };
                                    handleChange("breaks", nextBreaks);
                                    commitDraft({ ...formData, breaks: nextBreaks });
                                  }
                                }}
                                maxLength={20}
                              />
                            </div>
                            <div className="break-field">
                              <label>label</label>
                              <input
                                type="text"
                                value={brk.label ?? ""}
                                onChange={(e) => {
                                  const nextBreaks = [...formData.breaks];
                                  nextBreaks[idx] = { ...nextBreaks[idx], label: e.target.value };
                                  handleChange("breaks", nextBreaks);
                                }}
                                onBlur={() => commitDraft(formData)}
                                maxLength={200}
                              />
                            </div>
                            <div className="break-field">
                              <label>color</label>
                              <div className="break-color-wrap">
                                <input
                                  type="color"
                                  value={brk.color || formData.color || "#808080"}
                                  onChange={(e) => {
                                    const nextBreaks = [...formData.breaks];
                                    nextBreaks[idx] = { ...nextBreaks[idx], color: e.target.value };
                                    handleChange("breaks", nextBreaks);
                                    commitDraft({ ...formData, breaks: nextBreaks.map((b, i) => i === idx ? { ...b, color: e.target.value } : b) });
                                  }}
                                  className="edit-color-picker"
                                />
                                <input
                                  type="text"
                                  value={brk.color || ""}
                                  onChange={(e) => {
                                    const nextBreaks = [...formData.breaks];
                                    nextBreaks[idx] = { ...nextBreaks[idx], color: e.target.value };
                                    handleChange("breaks", nextBreaks);
                                  }}
                                  onBlur={(e) => {
                                    const normalized = normalizeColor(e.target.value);
                                    const nextBreaks = [...formData.breaks];
                                    nextBreaks[idx] = { ...nextBreaks[idx], color: normalized };
                                    handleChange("breaks", nextBreaks);
                                    commitDraft({ ...formData, breaks: nextBreaks.map((b, i) => i === idx ? { ...b, color: normalized } : b) });
                                  }}
                                  className="edit-color-text"
                                  maxLength={7}
                                  placeholder="#000000"
                                />
                              </div>
                            </div>
                            <div className="break-field">
                              <label>size</label>
                              <select
                                className="edit-select"
                                style={{ fontSize: "var(--text-xs)", padding: "3px 20px 3px 6px", minWidth: 0 }}
                                value={brk.size || ""}
                                onChange={(e) => {
                                  const nextBreaks = [...formData.breaks];
                                  const val = e.target.value;
                                  if (val) {
                                    nextBreaks[idx] = { ...nextBreaks[idx], size: val };
                                  } else {
                                    const { size: _, ...rest } = nextBreaks[idx];
                                    nextBreaks[idx] = rest;
                                  }
                                  handleChange("breaks", nextBreaks);
                                  commitDraft({ ...formData, breaks: nextBreaks });
                                }}
                              >
                                <option value="">Inherit</option>
                                <option value="thin">Thin</option>
                                <option value="normal">Normal</option>
                                <option value="thick">Thick</option>
                              </select>
                            </div>
                          </div>
                        );
                      })
                  )}
                  <button
                    type="button"
                    className="btn-add-break"
                    onClick={() => {
                      const existingBreaks = Array.isArray(formData.breaks) ? formData.breaks : [];
                      const allYears = [formData.start, ...existingBreaks.map((b) => b.year).filter((y) => y != null), formData.end];
                      allYears.sort((a, b) => a - b);
                      // Find the largest gap to place the new break
                      let maxGap = 0;
                      let gapStart = formData.start;
                      let gapEnd = formData.end;
                      for (let i = 0; i < allYears.length - 1; i++) {
                        const gap = allYears[i + 1] - allYears[i];
                        if (gap > maxGap) {
                          maxGap = gap;
                          gapStart = allYears[i];
                          gapEnd = allYears[i + 1];
                        }
                      }
                      const newYear = Math.round((gapStart + gapEnd) / 2);
                      const nextBreaks = [...existingBreaks, { year: newYear, label: "", color: formData.color || "#808080" }];
                      handleChange("breaks", nextBreaks);
                      commitDraft({ ...formData, breaks: nextBreaks });
                    }}
                  >
                    + Add Break
                  </button>
                </div>
            )}

            <div className="form-group note-form-group">
              {!formData.noteFile ? (
                <div className="note-add-actions">
                  <div className="note-add-dropdown-wrap">
                    <button type="button" className="note-create-card" onClick={() => setIsNoteAddOpen(v => !v)}>
                      <div className="note-create-card-icon"><FileText size={18} /></div>
                      <div className="note-create-card-text">
                        <span className="note-create-card-title">Add note</span>
                        <span className="note-create-card-subtitle">Attach a note to this event</span>
                      </div>
                    </button>
                    {isNoteAddOpen && (
                      <>
                        <div className="note-add-dropdown-backdrop" onClick={() => setIsNoteAddOpen(false)} />
                        <div className="note-add-dropdown">
                          <button type="button" className="note-add-dropdown-item" onClick={() => { setIsNoteAddOpen(false); handleAddNote(); }}>
                            Create Note
                          </button>
                          <button type="button" className="note-add-dropdown-item" onClick={() => { setIsNoteAddOpen(false); handleAddExistingNote(); }}>
                            Add Existing Note
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="note-editor-card">
                  <div className="rp-note-header">
                    <span className="rp-note-label rp-note-label-note">Note</span>
                    {noteWordCount > 0 && (
                      <span className="rp-note-meta">markdown · {noteWordCount} words</span>
                    )}
                  </div>
                  <NoteEditor
                    ref={noteEditorRef}
                    key={`${selectedElement?.id}-${formData?.noteFile}`}
                    initialContent={noteInitialContent}
                    isNoteLoading={isNoteLoading}
                    noteExists={noteExists}
                    onSave={handleNoteSave}
                    onUnlink={handleUnlinkNote}
                    onDelete={handleDeleteNote}
                  />
                </div>
              )}
              {timelineData?.file?.useWikipedia && !formData.wikiUrl && !isWikiUrlInputOpen && (
                <button type="button" className="note-create-card" onClick={handleOpenWikiInput}>
                  <div className="note-create-card-icon"><BookOpen size={18} /></div>
                  <div className="note-create-card-text">
                    <span className="note-create-card-title">Add wiki</span>
                    <span className="note-create-card-subtitle">Link a MediaWiki article</span>
                  </div>
                </button>
              )}
              {timelineData?.file?.useWikipedia && isWikiUrlInputOpen && (
                <div className="wiki-url-input-card">
                  <div className="source-field">
                    <label className="source-field-label">URL</label>
                    <input
                      ref={wikiUrlInputRef}
                      type="text"
                      className={`source-field-input${wikiUrlInputError ? " settings-input-error" : ""}`}
                      value={wikiUrlInput}
                      onChange={(e) => { setWikiUrlInput(e.target.value); setWikiUrlInputError(""); }}
                      onKeyDown={handleWikiUrlKeyDown}
                      placeholder="https://en.wikipedia.org/wiki/…"
                    />
                    {wikiUrlInputError && (
                      <div className="wiki-url-error">{wikiUrlInputError}</div>
                    )}
                  </div>
                  <div className="source-add-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setIsWikiUrlInputOpen(false); setWikiUrlInputError(""); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleWikiUrlSubmit}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              {timelineData?.file?.useWikipedia && formData.wikiUrl && !isWikiUrlInputOpen && (() => {
                const parsedWiki = parseMediaWikiUrl(formData.wikiUrl);
                if (!parsedWiki) return null;
                const safeUrl = `${parsedWiki.host}/wiki/${encodeURIComponent(parsedWiki.title)}`;
                const articleTitle = parsedWiki.title.replace(/_/g, " ");
                let articleHost = "";
                try { articleHost = new URL(parsedWiki.host).hostname; } catch {}
                const avatarLetter = articleTitle.charAt(0).toUpperCase();
                return (
                  <div className="wiki-url-card">
                    <div className="wiki-url-card-avatar">{avatarLetter}</div>
                    <div className="wiki-url-card-info">
                      <div className="wiki-url-card-title">{articleTitle}</div>
                      <div className="wiki-url-card-host">{articleHost}</div>
                    </div>
                    <div className="wiki-url-card-actions">
                      <button
                        type="button"
                        className="wiki-url-card-btn"
                        onClick={handleOpenWikiInput}
                        title="Change"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="wiki-url-card-btn wiki-url-card-btn-remove"
                        onClick={handleRemoveWikiUrl}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="sources-edit-section">
                <button type="button" className="rp-note-header sources-collapse-btn" onClick={() => setIsSourcesCollapsed(v => !v)}>
                  <span className="rp-sources-label"><Link size={12} strokeWidth={2} />Sources</span>
                  <span className="sources-collapse-right">
                    {Array.isArray(formData.sources) && formData.sources.length > 0 && (
                      <span className="rp-note-meta">{formData.sources.length}</span>
                    )}
                    <ChevronDown size={14} style={{transform: isSourcesCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--element-bg)'}} />
                  </span>
                </button>
                {!isSourcesCollapsed && <div className="sources-list">
                  {(Array.isArray(formData.sources) ? formData.sources : []).map((src, i) => (
                    editingSourceIndex === i ? (
                      <div key={i} className="source-add-form" style={{marginTop: 0, paddingTop: 8, borderTop: 'none'}}>
                        <div className="source-field">
                          <label className="source-field-label">Title</label>
                          <input type="text" className="source-field-input" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setEditingSourceIndex(null); setSourceTitle(""); setSourceUrl(""); setSourceDescription(""); }}} autoFocus />
                        </div>
                        <div className="source-field">
                          <label className="source-field-label">URL (optional)</label>
                          <input type="text" className="source-field-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === 'Escape') { setEditingSourceIndex(null); setSourceTitle(""); setSourceUrl(""); setSourceDescription(""); }}} />
                        </div>
                        <div className="source-field">
                          <label className="source-field-label">Description (optional)</label>
                          <textarea className="source-field-input source-field-textarea" value={sourceDescription} onChange={(e) => setSourceDescription(e.target.value)} placeholder="Author, year, notes…" rows={2} onKeyDown={(e) => { if (e.key === 'Escape') { setEditingSourceIndex(null); setSourceTitle(""); setSourceUrl(""); setSourceDescription(""); }}} />
                        </div>
                        <div className="source-add-actions">
                          <button type="button" className="btn-secondary" onClick={() => { setEditingSourceIndex(null); setSourceTitle(""); setSourceUrl(""); setSourceDescription(""); }}>Cancel</button>
                          <button type="button" className="btn-primary" onClick={handleSaveEditedSource}>Save</button>
                        </div>
                      </div>
                    ) : (
                    <div key={i} className="source-item">
                      <div className="wiki-url-card-avatar">{src.title.charAt(0).toUpperCase()}</div>
                      <div className="source-text">
                        <span className="source-title">{src.title}</span>
                        {(src.description || src.citation) && <span className="source-citation">{src.description || src.citation}</span>}
                      </div>
                      <div className="source-item-actions">
                        {src.url && (
                          <button
                            type="button"
                            className={`wiki-url-card-btn${formData.sourceLink === src.url ? ' source-link-active' : ''}`}
                            title={formData.sourceLink === src.url ? 'Remove featured link' : 'Set as featured link'}
                            onClick={() => {
                              const next = { ...formData, sourceLink: formData.sourceLink === src.url ? undefined : src.url };
                              if (!next.sourceLink) delete next.sourceLink;
                              setFormData(next);
                              commitDraft(next);
                            }}
                          ><Link size={13} /></button>
                        )}
                        <button type="button" className="wiki-url-card-btn" onClick={() => handleEditSource(i)} title="Edit"><Pencil size={13} /></button>
                        <button type="button" className="wiki-url-card-btn wiki-url-card-btn-remove" onClick={() => handleRemoveSource(i)} title="Remove"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    )
                  ))}
                </div>}
                {!isSourcesCollapsed && (isSourceFormOpen ? (
                  <div className="source-add-form">
                    <div className="source-field">
                      <label className="source-field-label">Title</label>
                      <input
                        type="text"
                        className="source-field-input"
                        placeholder="Source title"
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setIsSourceFormOpen(false); }}
                        autoFocus
                      />
                    </div>
                    <div className="source-field">
                      <label className="source-field-label">URL (optional)</label>
                      <input
                        type="text"
                        className="source-field-input"
                        placeholder="https://…"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setIsSourceFormOpen(false); }}
                      />
                    </div>
                    <div className="source-field">
                      <label className="source-field-label">Description (optional)</label>
                      <textarea
                        className="source-field-input source-field-textarea"
                        placeholder="Author, year, notes…"
                        value={sourceDescription}
                        onChange={(e) => setSourceDescription(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setIsSourceFormOpen(false); }}
                        rows={3}
                      />
                    </div>
                    <div className="source-add-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setIsSourceFormOpen(false); setSourceTitle(""); setSourceUrl(""); setSourceDescription(""); }}>Cancel</button>
                      <button type="button" className="btn-primary" onClick={handleAddSource}>Add source</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="source-add-btn" onClick={() => setIsSourceFormOpen(true)}>
                    + Add source
                  </button>
                ))}
              </div>
            </div>

          </form>
        )}
      </div>

      <div className="rp-action-bar">
          <div className="rp-action-group">
            <button
              className="rp-action-nav"
              type="button"
              disabled={!prevElement}
              onClick={onSelectPrevious}
              title={prevElement ? `Previous: ${prevElement.title}` : "No previous element"}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="rp-action-nav"
              type="button"
              disabled={!nextElement}
              onClick={onSelectNext}
              title={nextElement ? `Next: ${nextElement.title}` : "No next element"}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="rp-action-group">
            <button
              className="rp-action-edit"
              type="button"
              onClick={toggleEditMode}
            >
              <span>{isEditMode ? "Exit" : "Edit"}</span>
              <span className="rp-action-key">E</span>
            </button>
            <button
              className="rp-action-delete"
              type="button"
              onClick={() => onRequestDelete?.(formData.id)}
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
    </div>
  );
}
