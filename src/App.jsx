import { useState, useRef, useEffect } from "react";
import TimelineView from "./components/TimelineView";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import { sampleData } from "./data/sampleData";
import { saveTimelineToFile } from "./utils/api";
import { updateElementWithNewId } from "./utils/idUtils";
import { generateIdFromTitle } from "./utils/idUtils";
import "./index.css";

function App() {
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 455;
  const COLLAPSED_WIDTH = 44;
  const DEFAULT_LEFT_WIDTH = 350;
  const DEFAULT_RIGHT_WIDTH = 385;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

  const [selectedId, setSelectedId] = useState(null);

  const [timelineData, setTimelineData] = useState(() => {
    try {
      const saved = localStorage.getItem('timelineData');
      return saved ? JSON.parse(saved) : sampleData;
    } catch (error) {
      console.error('Failed to parse saved timeline data:', error);
      return sampleData;
    }
  });

  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  useEffect(() => {
    function handleMouseMove(e) {
      if (isDraggingLeft.current && !isLeftCollapsed) {
        e.preventDefault();
        const next = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
        setSidebarWidth(next);
      } else if (isDraggingRight.current) {
        e.preventDefault();
        const windowWidth = window.innerWidth;
        const distanceFromRight = windowWidth - e.clientX;
        const next = Math.min(
          Math.max(distanceFromRight, MIN_WIDTH),
          MAX_WIDTH
        );
        setRightWidth(next);
      }
    }

    function handleMouseUp() {
      if (isDraggingLeft.current || isDraggingRight.current) {
        isDraggingLeft.current = false;
        isDraggingRight.current = false;
        document.body.classList.remove("dragging");
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isLeftCollapsed]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();

        const element = timelineData.elements.find(el => el.id === selectedId);
        if (!element) return;

        const confirmMessage = `Are you sure you want to delete this ${element.type}?\n\nTitle: ${element.title}\nID: ${element.id}\n\nThis action cannot be undone.`;

        if (window.confirm(confirmMessage)) {
          handleDelete(selectedId);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, timelineData]);

  const currentLeftWidth = isLeftCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleUpdate = async (updatedElement) => {
    const originalId = updatedElement.id;

    setTimelineData((prevData) => {
      const updatedData = updateElementWithNewId(prevData, updatedElement, originalId);

      const newId = updatedData.elements.find(el =>
        el.title === updatedElement.title && el.type === updatedElement.type
      )?.id;

      if (newId && newId !== originalId) {
        setSelectedId(newId);
      }

      localStorage.setItem('timelineData', JSON.stringify(updatedData));

      saveTimelineToFile(updatedData, 'sampleData')
        .then(() => {
          console.log('Timeline saved to file successfully');
        })
        .catch((error) => {
          console.error('Failed to save timeline to file:', error);
        });

      return updatedData;
    });
  };

  const handleAddEvent = () => {
    const newEvent = {
      id: generateIdFromTitle("New Event", "event"),
      type: "event",
      title: "New Event",
      date: timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2),
      parents: [],
      color: "#EDE6DA",
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newEvent],
      };

      localStorage.setItem('timelineData', JSON.stringify(updatedData));
      saveTimelineToFile(updatedData, 'sampleData').catch(console.error);

      return updatedData;
    });

    setSelectedId(newEvent.id);
  };

  const handleAddSpan = () => {
    const midpoint = timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const duration = Math.floor((timelineData.file.end - timelineData.file.start) / 4);

    const newSpan = {
      id: generateIdFromTitle("New Span", "span"),
      type: "span",
      title: "New Span",
      start: midpoint - duration / 2,
      end: midpoint + duration / 2,
      color: "#A6977E",
      branches: [],
      forks: [],
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newSpan],
      };

      localStorage.setItem('timelineData', JSON.stringify(updatedData));
      saveTimelineToFile(updatedData, 'sampleData').catch(console.error);

      return updatedData;
    });

    setSelectedId(newSpan.id);
  };

  const handleAddEra = () => {
    const midpoint = timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const duration = Math.floor((timelineData.file.end - timelineData.file.start) / 3);

    const newEra = {
      id: generateIdFromTitle("New Era", "era"),
      type: "era",
      title: "New Era",
      start: midpoint - duration / 2,
      end: midpoint + duration / 2,
      color: "#F4D05A",
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newEra],
      };

      localStorage.setItem('timelineData', JSON.stringify(updatedData));
      saveTimelineToFile(updatedData, 'sampleData').catch(console.error);

      return updatedData;
    });

    setSelectedId(newEra.id);
  };

  const handleDelete = (elementId) => {
    setTimelineData((prevData) => {
      const filteredElements = prevData.elements.filter(el => el.id !== elementId);

      const cleanedElements = filteredElements.map(el => {
        if (el.type === "event" && el.parents?.includes(elementId)) {
          return {
            ...el,
            parents: el.parents.filter(id => id !== elementId),
          };
        }

        if (el.type === "span" && el.branches?.includes(elementId)) {
          return {
            ...el,
            branches: el.branches.filter(id => id !== elementId),
          };
        }

        if (el.type === "span" && el.forks?.includes(elementId)) {
          return {
            ...el,
            forks: el.forks.filter(id => id !== elementId),
          };
        }

        return el;
      });

      const updatedData = {
        ...prevData,
        elements: cleanedElements,
      };

      localStorage.setItem('timelineData', JSON.stringify(updatedData));
      saveTimelineToFile(updatedData, 'sampleData').catch(console.error);

      return updatedData;
    });

    setSelectedId(null);
  };

  const selectedElement = timelineData.elements.find((el) => el.id === selectedId);

  return (
    <div className="app-shell">
      <aside
        className="app-sidebar overlay-sidebar"
        style={{ width: currentLeftWidth }}
      >
        <Sidebar
          isCollapsed={isLeftCollapsed}
          onToggle={() => setIsLeftCollapsed((v) => !v)}
          selectedId={selectedId}
          onSelect={handleSelect}
          timelineData={timelineData}
          onAddEvent={handleAddEvent}
          onAddSpan={handleAddSpan}
          onAddEra={handleAddEra}
        />
      </aside>

      {!isLeftCollapsed && (
        <div
          className="sidebar-resizer overlay-resizer"
          style={{ left: `${currentLeftWidth - 3}px` }}
          onMouseDown={(e) => {
            e.preventDefault();
            isDraggingLeft.current = true;
            document.body.classList.add("dragging");
          }}
        />
      )}

      <main className="app-content">
        <TimelineView
          selectedId={selectedId}
          onSelect={handleSelect}
          timelineData={timelineData}
          onAddEvent={handleAddEvent}
          onAddSpan={handleAddSpan}
          onAddEra={handleAddEra}
        />
      </main>

      {selectedId && (
        <>
          <div
            className="right-resizer overlay-resizer"
            style={{ right: `${Math.max(rightWidth, MIN_WIDTH) - 3}px` }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingRight.current = true;
              document.body.classList.add("dragging");
            }}
          />

          <aside
            className="app-right overlay-right"
            style={{ width: rightWidth }}
          >
            <RightPanel
              onSelect={handleSelect}
              selectedElement={selectedElement}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              timelineData={timelineData}
            />
          </aside>
        </>
      )}
    </div>
  );
}

export default App;