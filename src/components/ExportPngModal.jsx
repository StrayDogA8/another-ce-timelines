import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/07-modals-menus.css";

const RESOLUTION_OPTIONS = [
  { value: 'current', label: 'Current', width: null, height: null },
  { value: 'hd', label: '1080p (1920 × 1080)', width: 1920, height: 1080 },
  { value: '4k', label: '4K (3840 × 2160)', width: 3840, height: 2160 },
  { value: 'letter', label: 'Letter 300 DPI (3300 × 2550)', width: 3300, height: 2550 },
  { value: 'a4', label: 'A4 300 DPI (3508 × 2480)', width: 3508, height: 2480 },
  { value: 'poster', label: 'Poster 36×24" (10800 × 7200)', width: 10800, height: 7200 },
];

export default function ExportPngModal({ isOpen, onClose, onExport, timelineData, timelineViewRef }) {
  const [filename, setFilename] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewScale, setPreviewScale] = useState(1);
  const [resolution, setResolution] = useState('current');
  const [bgOption, setBgOption] = useState('default');
  const [showTitle, setShowTitle] = useState(false);
  const [titlePosition, setTitlePosition] = useState('bottom-right');

  const previewTimeoutRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const backdropPointerDownRef = useRef(false);
  const previewContainerRef = useRef(null);

  useEffect(() => {
    if (isOpen && timelineData?.file) {
      const file = timelineData.file;
      setFilename(file.id || file.title || "timeline");
      setValidationErrors([]);
      setPreviewData(null);
      setPreviewScale(1);
      setResolution('current');
      setBgOption('default');
      setShowTitle(false);
      setTitlePosition('bottom-right');
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
        let previewOpts = {};
        if (bgOption === 'transparent') {
          previewOpts.transparentBg = true;
        } else if (bgOption === 'secondary' || bgOption === 'tertiary') {
          const varName = bgOption === 'secondary' ? '--secondary-bg' : '--tertiary-bg';
          previewOpts.customBg = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        }
        const data = await timelineViewRef.current.generatePreview(previewOpts);
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
  }, [isOpen, bgOption, timelineViewRef]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setPreviewScale((current) => Math.min(3, Math.max(0.3, Number((current + delta).toFixed(2)))));
  }, []);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !isOpen) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isOpen, handleWheel]);

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

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const selectedRes = RESOLUTION_OPTIONS.find(r => r.value === resolution) || RESOLUTION_OPTIONS[0];

    let exportBgOpts = {};
    if (bgOption === 'transparent') {
      exportBgOpts.transparentBg = true;
    } else if (bgOption === 'secondary' || bgOption === 'tertiary') {
      const varName = bgOption === 'secondary' ? '--secondary-bg' : '--tertiary-bg';
      exportBgOpts.customBg = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    onExport({
      ...exportBgOpts,
      filename: filename.trim(),
      targetWidth: selectedRes.width,
      targetHeight: selectedRes.height,
      showTitle,
      titlePosition,
      title: timelineData?.file?.title || '',
    });
    onClose();
  };

  const handleCancel = () => {
    setValidationErrors([]);
    onClose();
  };

  const getExportDimensions = () => {
    if (!previewData?.elementWidth || !previewData?.elementHeight) return null;
    const selectedRes = RESOLUTION_OPTIONS.find(r => r.value === resolution) || RESOLUTION_OPTIONS[0];
    if (selectedRes.width) {
      const scale = selectedRes.width / previewData.elementWidth;
      const scaledH = Math.round(previewData.elementHeight * scale);
      return { width: selectedRes.width, height: Math.max(scaledH, selectedRes.height) };
    }
    return { width: previewData.elementWidth * 2, height: previewData.elementHeight * 2 };
  };

  // Calculate the output aspect ratio for the preview wrapper
  const getOutputAspectRatio = () => {
    if (!previewData?.elementWidth || !previewData?.elementHeight) return null;
    const selectedRes = RESOLUTION_OPTIONS.find(r => r.value === resolution) || RESOLUTION_OPTIONS[0];
    if (!selectedRes.width || !selectedRes.height) return null;

    const scale = selectedRes.width / previewData.elementWidth;
    const scaledH = previewData.elementHeight * scale;
    if (selectedRes.height <= scaledH) return null; // timeline fills or exceeds target

    return `${selectedRes.width} / ${selectedRes.height}`;
  };

  const outputAspectRatio = getOutputAspectRatio();
  const previewBgColor = bgOption === 'secondary' ? 'var(--secondary-bg)'
    : bgOption === 'tertiary' ? 'var(--tertiary-bg)'
    : undefined;

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
          <div
            ref={previewContainerRef}
            className={`export-preview-container ${bgOption === 'transparent' ? 'export-preview-transparent' : ''}`}
          >
            {isGeneratingPreview ? (
              <div className="export-preview-loading">Generating preview...</div>
            ) : previewData?.imageUrl ? (
              <div
                ref={previewWrapperRef}
                className="export-preview-wrapper"
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: "center",
                  ...(outputAspectRatio ? {
                    aspectRatio: outputAspectRatio,
                    backgroundColor: previewBgColor,
                    width: '100%',
                  } : {}),
                }}
              >
                <img
                  src={previewData.imageUrl}
                  alt="Export preview"
                  className="export-preview-image"
                  draggable={false}
                />
                <div className="export-preview-bounds" style={{
                  border: '1px dashed var(--element-bg)',
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }} />
                {showTitle && resolution !== 'current' && timelineData?.file?.title && (
                  <div className={`export-preview-title export-preview-title-${titlePosition}`}>
                    {timelineData.file.title}
                    <svg
                      className="export-preview-title-logo"
                      viewBox="0 0 67 25"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <rect y="8.89844" width="28.2656" height="6.80469" />
                      <rect x="35.0703" width="31.9297" height="7.32812" />
                      <rect x="35.0703" y="16.75" width="31.9297" height="7.32812" />
                      <path d="M28.2656 5C28.2656 2.23858 30.5042 0 33.2656 0H35.0703V24.0781H33.2656C30.5042 24.0781 28.2656 21.8395 28.2656 19.0781V5Z" />
                    </svg>
                  </div>
                )}
              </div>
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
              <div className="settings-row-label">Resolution</div>
              <div className="settings-row-description">
                {(() => {
                  const dims = getExportDimensions();
                  return dims ? `${dims.width} × ${dims.height} px` : 'Higher resolutions are better for printing.';
                })()}
              </div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                {RESOLUTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Background</div>
              <div className="settings-row-description">Choose the background color for the export.</div>
            </div>
            <div className="settings-row-right">
              <select
                className="settings-select"
                value={bgOption}
                onChange={(e) => setBgOption(e.target.value)}
              >
                <option value="default">Default</option>
                <option value="secondary">Secondary</option>
                <option value="tertiary">Tertiary</option>
                <option value="transparent">Transparent</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">Title Watermark</div>
              <div className="settings-row-description">Overlay the timeline title on the export.</div>
            </div>
            <div className="settings-row-right">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                />
                <span className="settings-toggle-slider"></span>
              </label>
            </div>
          </div>

          {showTitle && (
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Title Position</div>
                <div className="settings-row-description">Where to place the title on the export.</div>
              </div>
              <div className="settings-row-right">
                <select
                  className="settings-select"
                  value={titlePosition}
                  onChange={(e) => setTitlePosition(e.target.value)}
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
            </div>
          )}

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
