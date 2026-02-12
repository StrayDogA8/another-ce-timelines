import { ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/07-modals-menus.css";

export default function ExportPngModal({ isOpen, onClose, onExport, timelineData, timelineViewRef }) {
  const [transparentBg, setTransparentBg] = useState(false);
  const [filename, setFilename] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewScale, setPreviewScale] = useState(1);

  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(100);

  const previewTimeoutRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const isDraggingRef = useRef(null); // 'left' | 'right' | null
  const dragStartXRef = useRef(0);
  const dragStartCropRef = useRef(0);
  const backdropPointerDownRef = useRef(false);

  useEffect(() => {
    if (isOpen && timelineData?.file) {
      const file = timelineData.file;
      setFilename(file.id || file.title || "timeline");
      setTransparentBg(false);
      setValidationErrors([]);
      setPreviewData(null);
      setCropLeft(0);
      setCropRight(100);
      setPreviewScale(1);
    }
  }, [isOpen, timelineData]);

  useEffect(() => {
    if (!isOpen || !timelineViewRef?.current?.generatePreview) return;

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const data = await timelineViewRef.current.generatePreview({
          transparentBg,
        });
        setPreviewData(data);
      } catch (error) {
        console.error('Error generating preview:', error);
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 300);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [isOpen, transparentBg, timelineViewRef]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || !previewWrapperRef.current || !previewData) return;

    const rect = previewWrapperRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartXRef.current;
    const deltaPercent = (deltaX / rect.width) * 100;
    const newPercent = Math.max(0, Math.min(100, dragStartCropRef.current + deltaPercent));

    if (isDraggingRef.current === 'left' && newPercent < cropRight - 2) {
      setCropLeft(newPercent);
    } else if (isDraggingRef.current === 'right' && newPercent > cropLeft + 2) {
      setCropRight(newPercent);
    }
  }, [previewData, cropLeft, cropRight]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, handleMouseMove, handleMouseUp]);

  const handleDragStart = (handle, e) => {
    e.preventDefault();
    isDraggingRef.current = handle;
    dragStartXRef.current = e.clientX;
    dragStartCropRef.current = handle === 'left' ? cropLeft : cropRight;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e) => {
    backdropPointerDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropMouseUp = (e) => {
    if (backdropPointerDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    backdropPointerDownRef.current = false;
  };

  const handleExport = () => {
    const errors = [];

    if (!filename.trim()) {
      errors.push("Please enter a filename.");
    }

    if (cropLeft >= cropRight) {
      errors.push("Invalid crop region.");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    onExport({
      transparentBg,
      cropLeft,
      cropRight,
      filename: filename.trim(),
    });
    onClose();
  };

  const handleCancel = () => {
    setValidationErrors([]);
    onClose();
  };

  const handleZoomIn = () => {
    setPreviewScale((current) => Math.min(2, Number((current + 0.1).toFixed(2))));
  };

  const handleZoomOut = () => {
    setPreviewScale((current) => Math.max(0.5, Number((current - 0.1).toFixed(2))));
  };

  return (
    <div className="settings-backdrop" onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp}>
      <div className="settings-modal export-png-modal">
        <div className="settings-header">
          <button
            className="settings-back-button"
            onClick={handleCancel}
            aria-label="Close"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className="settings-title">EXPORT PNG</h2>
        </div>

        {validationErrors.length > 0 && (
          <div className="settings-errors">
            {validationErrors.map((error, index) => (
              <div key={index} className="settings-error">
                {error}
              </div>
            ))}
          </div>
        )}

        <div className="settings-content">
          {/* Preview with crop overlay */}
          <div className={`export-preview-container ${transparentBg ? 'export-preview-transparent' : ''}`}>
            {isGeneratingPreview ? (
              <div className="export-preview-loading">Generating preview...</div>
            ) : previewData?.imageUrl ? (
              <>
                <div
                  ref={previewWrapperRef}
                  className="export-preview-wrapper"
                  style={{ transform: `scale(${previewScale})`, transformOrigin: "center" }}
                >
                  <img
                    src={previewData.imageUrl}
                    alt="Export preview"
                    className="export-preview-image"
                    draggable={false}
                  />
                  {/* Crop overlay - horizontal only */}
                  <div className="export-crop-overlay">
                    {/* Left mask */}
                    <div
                      className="export-crop-mask"
                      style={{
                        top: 0,
                        left: 0,
                        width: `${cropLeft}%`,
                        height: '100%',
                      }}
                    />
                    {/* Right mask */}
                    <div
                      className="export-crop-mask"
                      style={{
                        top: 0,
                        right: 0,
                        width: `${100 - cropRight}%`,
                        height: '100%',
                      }}
                    />

                    {/* Crop region border */}
                    <div
                      className="export-crop-border"
                      style={{
                        left: `${cropLeft}%`,
                        width: `${cropRight - cropLeft}%`,
                      }}
                    />

                    {/* Handles */}
                    <div
                      className="export-crop-handle export-crop-handle-left"
                      style={{ left: `${cropLeft}%`, top: 0, height: '100%' }}
                      onMouseDown={(e) => handleDragStart('left', e)}
                    />
                    <div
                      className="export-crop-handle export-crop-handle-right"
                      style={{ left: `${cropRight}%`, top: 0, height: '100%' }}
                      onMouseDown={(e) => handleDragStart('right', e)}
                    />
                  </div>
                </div>
                <div className="export-preview-controls">
                  <button
                    type="button"
                    className="export-preview-button"
                    onClick={handleZoomOut}
                    aria-label="Zoom out"
                    disabled={previewScale <= 0.5}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    type="button"
                    className="export-preview-button"
                    onClick={handleZoomIn}
                    aria-label="Zoom in"
                    disabled={previewScale >= 2}
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="export-preview-placeholder">Preview will appear here</div>
            )}
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Filename</div>
              <div className="settings-row-description">The name of the exported PNG file.</div>
            </div>
            <div className="settings-row-right">
              <div className="export-filename-input">
                <input
                  type="text"
                  className="settings-input"
                  value={filename}
                  onChange={(e) => {
                    setFilename(e.target.value);
                    if (validationErrors.length) setValidationErrors([]);
                  }}
                  placeholder="Enter filename"
                  maxLength={100}
                />
                <span className="export-filename-ext">.png</span>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Transparent Background</div>
              <div className="settings-row-description">Export with a transparent background instead of the theme color.</div>
            </div>
            <div className="settings-row-right">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                />
                <span className="settings-toggle-slider"></span>
              </label>
            </div>
          </div>

        </div>

        <div className="settings-footer">
          <button className="settings-footer-button settings-cancel-button" onClick={handleCancel}>
            Cancel
          </button>
          <button className="settings-footer-button settings-create-button" onClick={handleExport}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
