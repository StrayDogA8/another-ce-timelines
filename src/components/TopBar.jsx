import { Minus, Square, X } from "lucide-react";

export default function TopBar({ title = "Timelines" }) {
  const isElectron = window.electron !== undefined;

  const handleMinimize = () => {
    if (isElectron) window.electron.minimizeWindow();
  };

  const handleMaximize = () => {
    if (isElectron) window.electron.maximizeWindow();
  };

  const handleClose = () => {
    if (isElectron) window.electron.closeWindow();
  };

  if (!isElectron) {
    return null; // Don't show title bar in web version
  }

  return (
    <div className="custom-title-bar">
      <div className="title-bar-drag-region">
        <img src="/favicon/favicon-light-96x96.png" alt="" className="title-bar-icon" />
        <span className="title-bar-title">{title}</span>
      </div>
      <div className="title-bar-controls">
        <button className="title-bar-button" onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="title-bar-button" onClick={handleMaximize} title="Maximize">
          <Square size={12} />
        </button>
        <button className="title-bar-button title-bar-close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
