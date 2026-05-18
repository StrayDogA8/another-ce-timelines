import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { renderNoteMarkdown } from "../utils/noteUtils";
import { createNote, addExistingNote, readNote, writeNote, deleteNote, getNotesBaseDir } from "../utils/electronApi";
import { isSafeNoteFilename } from "../utils/validation";

export function useNoteManagement({ selectedElement, timelineData, formData, setFormData, onUpdate }) {
  const [noteInitialContent, setNoteInitialContent] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [noteExists, setNoteExists] = useState(false);
  const [isNoteAddOpen, setIsNoteAddOpen] = useState(false);
  const [notesBaseUrl, setNotesBaseUrl] = useState("");
  const [notesBasePath, setNotesBasePath] = useState("");
  const noteEditorRef = useRef(null);
  const noteRenderRef = useRef(null);

  // Load notes base directory once on mount
  useEffect(() => {
    let isMounted = true;
    getNotesBaseDir().then((result) => {
      if (!isMounted) return;
      if (result?.success && result.fileUrl) {
        const normalized = result.fileUrl.endsWith("/") ? result.fileUrl : `${result.fileUrl}/`;
        setNotesBaseUrl(normalized);
      }
      if (result?.success && result.path) {
        setNotesBasePath(result.path);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Load note when selected element changes
  useEffect(() => {
    let isMounted = true;
    const loadNote = async () => {
      if (!selectedElement?.noteFile) {
        setNoteInitialContent("");
        setNoteExists(false);
        setIsNoteAddOpen(false);
        return;
      }
      const timelineId = timelineData?.file?.id?.replace("-timeline", "");
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
    return () => { isMounted = false; };
  }, [selectedElement?.id, selectedElement?.noteFile, timelineData?.file?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide broken images in rendered note
  useEffect(() => {
    if (!noteRenderRef.current) return;
    const imgs = noteRenderRef.current.querySelectorAll("img");
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth === 0) {
        img.style.display = "none";
      } else {
        img.addEventListener("error", function () {
          this.style.display = "none";
          this.style.minHeight = "0";
        }, { once: true });
      }
    });
  }, [noteInitialContent]);

  const noteWordCount = useMemo(() => {
    if (!noteInitialContent) return 0;
    return noteInitialContent.trim().split(/\s+/).filter(Boolean).length;
  }, [noteInitialContent]);

  const renderedNoteHtml = useMemo(
    () => renderNoteMarkdown(noteInitialContent, isNoteLoading, notesBaseUrl, notesBasePath),
    [noteInitialContent, isNoteLoading, notesBaseUrl, notesBasePath]
  );

  const noteViewCallbackRef = useCallback((node) => {
    noteRenderRef.current = node;
    if (node) node.innerHTML = renderedNoteHtml;
  }, [renderedNoteHtml]);

  const handleNoteSave = useCallback(async (content) => {
    if (!formData?.noteFile || !isSafeNoteFilename(formData.noteFile)) return;
    const timelineId = timelineData?.file?.id?.replace("-timeline", "");
    if (!timelineId) return;
    await writeNote({ timelineId, filename: formData.noteFile, content });
    setNoteInitialContent(content);
  }, [formData?.noteFile, timelineData?.file?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTaskToggle = useCallback((idx) => {
    let count = 0;
    const newContent = noteInitialContent.replace(
      /^(\s*[-*+] \[)([ x])(\])/gm,
      (match, pre, state, post) => {
        if (count++ === idx) return `${pre}${state === " " ? "x" : " "}${post}`;
        return match;
      }
    );
    setNoteInitialContent(newContent);
    handleNoteSave(newContent);
  }, [noteInitialContent, handleNoteSave]);

  const handleAddNote = useCallback(async () => {
    const timelineId = timelineData?.file?.id?.replace("-timeline", "");
    if (!timelineId) return;
    const result = await createNote({ timelineId, title: formData.title, elementId: formData.id });
    if (!result?.success) { console.error("Failed to create note:", result?.error); return; }
    const next = { ...formData, noteFile: result.filename || `${formData.id}.md` };
    setFormData(next);
    onUpdate?.(next);
    setNoteInitialContent(result?.content ?? `# ${formData.title}\n\n`);
  }, [formData, timelineData?.file?.id, onUpdate, setFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddExistingNote = useCallback(async () => {
    const timelineId = timelineData?.file?.id?.replace("-timeline", "");
    if (!timelineId) return;
    const result = await addExistingNote({ timelineId });
    if (!result?.success) {
      if (result?.error === "OUTSIDE_NOTES_DIR") {
        window.alert("That note is outside your Notes Folder. Choose a note inside the Notes Folder or change the Notes Folder in App Settings.");
      } else if (!result?.cancelled) {
        console.error("Failed to add existing note:", result?.error);
      }
      return;
    }
    const next = { ...formData, noteFile: result.filename };
    setFormData(next);
    onUpdate?.(next);
    setNoteInitialContent(result?.content ?? "");
    setNoteExists(true);
  }, [formData, timelineData?.file?.id, onUpdate, setFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteNote = useCallback(async () => {
    if (!formData?.noteFile || !isSafeNoteFilename(formData.noteFile)) return;
    const confirmed = window.confirm("Delete this note? This cannot be undone.");
    if (!confirmed) return;
    const timelineId = timelineData?.file?.id?.replace("-timeline", "");
    if (!timelineId) return;
    const result = await deleteNote({ timelineId, filename: formData.noteFile });
    if (!result?.success) { console.error("Failed to delete note:", result?.error); return; }
    const next = { ...formData };
    delete next.noteFile;
    setFormData(next);
    setNoteInitialContent("");
    onUpdate?.(next);
  }, [formData, timelineData?.file?.id, onUpdate, setFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlinkNote = useCallback(() => {
    if (!formData?.noteFile) return;
    const next = { ...formData };
    delete next.noteFile;
    setFormData(next);
    setNoteInitialContent("");
    setNoteExists(false);
    onUpdate?.(next);
  }, [formData, onUpdate, setFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    noteInitialContent,
    setNoteInitialContent,
    isNoteLoading,
    noteExists,
    isNoteAddOpen,
    setIsNoteAddOpen,
    notesBaseUrl,
    notesBasePath,
    noteEditorRef,
    noteWordCount,
    renderedNoteHtml,
    noteViewCallbackRef,
    handleTaskToggle,
    handleNoteSave,
    handleAddNote,
    handleAddExistingNote,
    handleDeleteNote,
    handleUnlinkNote,
  };
}
