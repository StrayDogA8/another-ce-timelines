import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Underline, Highlighter, Link2, Trash2, Unlink, ImagePlay } from "lucide-react";

const NoteEditor = forwardRef(function NoteEditor(
  { initialContent, isNoteLoading, noteExists, onSave, onUnlink, onDelete },
  ref
) {
  const [noteContent, setNoteContent] = useState(initialContent ?? "");
  const noteContentRef = useRef(noteContent);
  const textareaRef = useRef(null);
  noteContentRef.current = noteContent;

  useEffect(() => {
    setNoteContent(initialContent ?? "");
  }, [initialContent]);

  useImperativeHandle(ref, () => ({
    save: () => onSave(noteContentRef.current),
  }), [onSave]);

  const wrapSelection = (prefix, suffix = prefix) => {
    const textarea = textareaRef.current;
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
    const textarea = textareaRef.current;
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
    const textarea = textareaRef.current;
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
    const textarea = textareaRef.current;
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
        ref={textareaRef}
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

export default NoteEditor;
