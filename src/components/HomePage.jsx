import { useState, useEffect } from "react";
import { File, FilePlus } from "lucide-react";
import "../styles/09-homepage.css";

export default function HomePage({ onSelectTimeline }) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTimelineList = async () => {
      if (window.electron?.listTimelines) {
        try {
          const files = await window.electron.listTimelines();
          setTimelineFiles(files);
        } catch (error) {
          console.error('Failed to list timelines:', error);
        }
      } else {
        // Fallback to static imports for web version
        const timelineModules = import.meta.glob('../data/*.timeline', { eager: true });

        const files = Object.keys(timelineModules).map(path => {
          const filename = path.split('/').pop().replace('.timeline', '');
          const module = timelineModules[path];
          const data = module.default || module;

          return {
            id: filename,
            name: data.file?.title || filename
          };
        });

        setTimelineFiles(files);
      }
      setLoading(false);
    };

    loadTimelineList();
  }, []);

  const handleNewTimeline = () => {
    // TODO: Implement new timeline creation
    console.log('New timeline');
  };

  if (loading) {
    return (
      <div className="homepage">
        <div className="homepage-container">
          <p>Loading timelines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <h1 className="homepage-title">timelines</h1>
        <p className="homepage-subtitle">Select a timeline to open</p>

        <div className="timeline-grid">
          <button className="timeline-card timeline-card-new" onClick={handleNewTimeline}>
            <FilePlus size={32} strokeWidth={1.5} />
            <span>New Timeline</span>
          </button>

          {timelineFiles.map((file) => (
            <button
              key={file.id}
              className="timeline-card"
              onClick={() => onSelectTimeline(file.id)}
            >
              <File size={32} strokeWidth={1.5} />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        {timelineFiles.length === 0 && (
          <div className="no-timelines">
            <p>No timelines found. Create a new one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
