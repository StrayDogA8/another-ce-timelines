import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { formatYear } from "../utils/timelineUtils";
import "../styles/07-modals-menus.css";

const RESOLUTION_OPTIONS = [
  { value: 'current', label: 'Timeline', width: null, height: null },
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
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const [resolution, setResolution] = useState('current');
  const [bgOption, setBgOption] = useState('default');
  const [showTitle, setShowTitle] = useState(false);
  const [titlePosition, setTitlePosition] = useState('bottom-right');
  const [titleStyle, setTitleStyle] = useState('title-logo');
  const [titleText, setTitleText] = useState('');
  const [exportRange, setExportRange] = useState({ startPercent: 0, endPercent: 100 });

  const previewTimeoutRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const previewDragRef = useRef({ startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });
  const backdropPointerDownRef = useRef(false);
  const previewContainerRef = useRef(null);

  const clampPreviewOffset = useCallback((nextOffset, scaleValue = previewScale) => {
    const container = previewContainerRef.current;
    const wrapper = previewWrapperRef.current;
    if (!container || !wrapper) return nextOffset;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const baseWidth = wrapper.offsetWidth;
    const baseHeight = wrapper.offsetHeight;
    if (!containerWidth || !containerHeight || !baseWidth || !baseHeight) return nextOffset;

    const scaledWidth = baseWidth * scaleValue;
    const scaledHeight = baseHeight * scaleValue;
    const limitX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const limitY = Math.max(0, (scaledHeight - containerHeight) / 2);

    return {
      x: Math.min(limitX, Math.max(-limitX, nextOffset.x)),
      y: Math.min(limitY, Math.max(-limitY, nextOffset.y)),
    };
  }, [previewScale]);

  useEffect(() => {
    if (isOpen && timelineData?.file) {
      const file = timelineData.file;
      setFilename(file.id || file.title || "timeline");
      setValidationErrors([]);
      setPreviewData(null);
      setPreviewScale(1);
      setPreviewOffset({ x: 0, y: 0 });
      setIsDraggingPreview(false);
      setResolution('current');
      setBgOption('default');
      setShowTitle(false);
      setTitlePosition('bottom-right');
      setTitleStyle('title-logo');
      setTitleText(file.title || "");
      setExportRange({ startPercent: 0, endPercent: 100 });
    }
  }, [isOpen, timelineData]);

  useEffect(() => {
    if (resolution === "current" && showTitle) {
      setShowTitle(false);
    }
  }, [resolution, showTitle]);

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
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setPreviewScale((current) => {
      const nextScale = Math.min(10, Math.max(0.3, Number((current + delta).toFixed(2))));
      setPreviewOffset((currentOffset) => clampPreviewOffset(currentOffset, nextScale));
      return nextScale;
    });
  }, [clampPreviewOffset]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !isOpen) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isOpen, handleWheel]);

  useEffect(() => {
    if (!isDraggingPreview) return;

    const handleMouseMove = (e) => {
      const drag = previewDragRef.current;
      const nextOffset = {
        x: drag.startOffsetX + (e.clientX - drag.startX),
        y: drag.startOffsetY + (e.clientY - drag.startY),
      };
      setPreviewOffset(clampPreviewOffset(nextOffset));
    };

    const handleMouseUp = () => {
      setIsDraggingPreview(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPreview, clampPreviewOffset]);

  useEffect(() => {
    setPreviewOffset((current) => clampPreviewOffset(current));
  }, [previewScale, previewData, resolution, clampPreviewOffset]);

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

  const handlePreviewMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    previewDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: previewOffset.x,
      startOffsetY: previewOffset.y,
    };
    setIsDraggingPreview(true);
  };

  const handleExport = () => {
    const selectedRes = RESOLUTION_OPTIONS.find(r => r.value === resolution) || RESOLUTION_OPTIONS[0];

    let exportBgOpts = {};
    if (bgOption === 'transparent') {
      exportBgOpts.transparentBg = true;
    } else if (bgOption === 'secondary' || bgOption === 'tertiary') {
      const varName = bgOption === 'secondary' ? '--secondary-bg' : '--tertiary-bg';
      exportBgOpts.customBg = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    const startYear = previewData?.percentToYear
      ? previewData.percentToYear(exportRange.startPercent)
      : previewData?.minYear;
    const endYear = previewData?.percentToYear
      ? previewData.percentToYear(exportRange.endPercent)
      : previewData?.maxYear;

    onExport({
      ...exportBgOpts,
      filename: (filename || "").trim() || (timelineData?.file?.id || timelineData?.file?.title || "timeline"),
      targetWidth: selectedRes.width,
      targetHeight: selectedRes.height,
      exportStartYear: startYear,
      exportEndYear: endYear,
      showTitle,
      titlePosition,
      titleStyle,
      title: titleText,
    });
    onClose();
  };

  const handleCancel = () => {
    setValidationErrors([]);
    onClose();
  };

  const selectedRes = RESOLUTION_OPTIONS.find(r => r.value === resolution) || RESOLUTION_OPTIONS[0];
  const minRangePercent = 5;
  const rangeSpanPercent = Math.max(minRangePercent, exportRange.endPercent - exportRange.startPercent);
  const rangeRatio = rangeSpanPercent / 100;
  const rangeWidthPx = previewData?.elementWidth ? previewData.elementWidth * rangeRatio : null;

  const getExportDimensions = () => {
    if (!previewData?.elementWidth || !previewData?.elementHeight) return null;
    if (selectedRes.width) {
      const sourceWidth = rangeWidthPx || previewData.elementWidth;
      const scale = selectedRes.width / sourceWidth;
      const scaledH = Math.round(previewData.elementHeight * scale);
      return { width: selectedRes.width, height: Math.max(scaledH, selectedRes.height) };
    }
    const sourceWidth = rangeWidthPx || previewData.elementWidth;
    return {
      width: Math.round(sourceWidth * 2),
      height: previewData.elementHeight * 2
    };
  };

  // Calculate the output aspect ratio for the preview wrapper
  const getOutputAspectRatio = () => {
    if (!previewData?.elementWidth || !previewData?.elementHeight) return null;
    if (!selectedRes.width || !selectedRes.height) return null;

    const sourceWidth = rangeWidthPx || previewData.elementWidth;
    const scale = selectedRes.width / sourceWidth;
    const scaledH = previewData.elementHeight * scale;
    if (selectedRes.height <= scaledH) return null; // timeline fills or exceeds target

    return `${selectedRes.width} / ${selectedRes.height}`;
  };

  const outputAspectRatio = getOutputAspectRatio();
  const previewBgColor = bgOption === 'secondary' ? 'var(--secondary-bg)'
    : bgOption === 'tertiary' ? 'var(--tertiary-bg)'
    : undefined;
  const file = timelineData?.file;
  const displayYear = (value) => {
    if (!Number.isFinite(value)) return "--";
    const useMonths = file?.useMonths === true;
    return formatYear(useMonths ? value : Math.round(value), file?.negID, file?.posID, useMonths);
  };
  const selectedStartYear = previewData?.percentToYear
    ? previewData.percentToYear(exportRange.startPercent)
    : previewData?.minYear;
  const selectedEndYear = previewData?.percentToYear
    ? previewData.percentToYear(exportRange.endPercent)
    : previewData?.maxYear;
  const rangeMinYear = previewData?.minYear;
  const rangeMaxYear = previewData?.maxYear;
  const rangeStep = 0.1;

  const hasCustomRange = exportRange.startPercent > 0 || exportRange.endPercent < 100;
  const previewImageStyle = hasCustomRange
    ? {
      width: `${100 / rangeRatio}%`,
      maxWidth: "none",
      maxHeight: "none",
      marginLeft: `-${(exportRange.startPercent / rangeSpanPercent) * 100}%`,
    }
    : undefined;

  const handleStartRangeChange = (e) => {
    const raw = Number(e.target.value);
    if (!Number.isFinite(raw)) return;
    setExportRange((current) => ({
      startPercent: Math.min(Math.max(0, raw), current.endPercent - minRangePercent),
      endPercent: current.endPercent,
    }));
  };

  const handleEndRangeChange = (e) => {
    const raw = Number(e.target.value);
    if (!Number.isFinite(raw)) return;
    setExportRange((current) => ({
      startPercent: current.startPercent,
      endPercent: Math.max(Math.min(100, raw), current.startPercent + minRangePercent),
    }));
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
          <div
            ref={previewContainerRef}
            className={`export-preview-container ${bgOption === 'transparent' ? 'export-preview-transparent' : ''}`}
          >
            {isGeneratingPreview ? (
              <div className="export-preview-loading">Generating preview...</div>
            ) : previewData?.imageUrl ? (
              <div
                ref={previewWrapperRef}
                className={`export-preview-wrapper${isDraggingPreview ? ' is-dragging' : ''}`}
                onMouseDown={handlePreviewMouseDown}
                style={{
                  transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                  transformOrigin: "center",
                  ...(hasCustomRange ? { justifyContent: 'flex-start' } : {}),
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
                  style={previewImageStyle}
                  draggable={false}
                />
                <div className="export-preview-bounds" style={{
                  border: '1px dashed var(--element-bg)',
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }} />
                {showTitle && resolution !== 'current' && (
                  <div className={`export-preview-title export-preview-title-${titlePosition}`}>
                    {titleStyle !== 'logo-only' && (titleText || '')}
                    {titleStyle !== 'title-only' && (
                      <svg
                        className={`export-preview-title-logo${titleStyle === 'logo-only' ? ' export-preview-title-logo-only' : ''}`}
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
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="export-preview-placeholder">Preview will appear here</div>
            )}
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
              <div className="settings-row-label">Timeline Range</div>
              <div className="settings-row-description">
                {`${displayYear(selectedStartYear)} to ${displayYear(selectedEndYear)} (of ${displayYear(rangeMinYear)} to ${displayYear(rangeMaxYear)})`}
              </div>
            </div>
            <div className="settings-row-right">
              <div className="export-range-control">
                <div className="export-range-slider-wrap">
                  <div className="export-range-track" />
                  <div
                    className="export-range-selection"
                    style={{
                      left: `${exportRange.startPercent}%`,
                      width: `${Math.max(0, exportRange.endPercent - exportRange.startPercent)}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={rangeStep}
                    value={exportRange.startPercent}
                    onChange={handleStartRangeChange}
                    className="export-range-slider export-range-slider-start"
                    aria-label="Export start year"
                    disabled={!previewData}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={rangeStep}
                    value={exportRange.endPercent}
                    onChange={handleEndRangeChange}
                    className="export-range-slider export-range-slider-end"
                    aria-label="Export end year"
                    disabled={!previewData}
                  />
                </div>
                <div className="export-range-labels">
                  <span>{displayYear(selectedStartYear)}</span>
                  <span>{displayYear(selectedEndYear)}</span>
                </div>
              </div>
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
              <div className="settings-row-description">
                {resolution === "current"
                  ? "Available for fixed export resolutions."
                  : "Overlay the timeline title on the export."}
              </div>
            </div>
            <div className="settings-row-right">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                  disabled={resolution === "current"}
                />
                <span className="settings-toggle-slider"></span>
              </label>
            </div>
          </div>

          {showTitle && resolution !== "current" && (
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Title Text</div>
                <div className="settings-row-description">Custom text used only for this export.</div>
              </div>
              <div className="settings-row-right">
                <input
                  type="text"
                  className="settings-input"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="Enter export title"
                  maxLength={120}
                  disabled={titleStyle === "logo-only"}
                />
              </div>
            </div>
          )}

          {showTitle && resolution !== "current" && (
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Title Style</div>
                <div className="settings-row-description">Choose what appears in the watermark.</div>
              </div>
              <div className="settings-row-right">
                <select
                  className="settings-select"
                  value={titleStyle}
                  onChange={(e) => setTitleStyle(e.target.value)}
                >
                  <option value="title-logo">Title and Logo</option>
                  <option value="title-only">Title Only</option>
                  <option value="logo-only">Logo Only</option>
                </select>
              </div>
            </div>
          )}

          {showTitle && resolution !== "current" && (
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
