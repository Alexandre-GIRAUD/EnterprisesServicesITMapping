import { useEffect, useRef, useState } from 'react';
import { AboutContactForm } from '@/features/about/AboutContactForm';
import { HELP_TOPICS } from './helpTopics';

const HELP_PANEL_WIDTH = 352;

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePointer(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  function toggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(rect.left, window.innerWidth - HELP_PANEL_WIDTH - 12);
      setAnchor({ top: rect.bottom + 8, left: Math.max(12, left) });
    }
    setIsOpen(true);
  }

  return (
    <div className="layout-help" ref={rootRef}>
      <button
        type="button"
        className="layout-help-toggle"
        aria-label="Help"
        aria-expanded={isOpen}
        aria-controls="layout-help-panel"
        onClick={toggle}
      >
        <QuestionGlyph />
      </button>
      {isOpen && anchor ? (
        <div
          id="layout-help-panel"
          className="layout-help-panel"
          role="dialog"
          aria-label="Help"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {HELP_TOPICS.map((topic) => (
            <section key={topic.title} className="layout-help-section">
              <h3>{topic.title}</h3>
              <p>{topic.text}</p>
            </section>
          ))}
          <AboutContactForm />
        </div>
      ) : null}
    </div>
  );
}

function QuestionGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.15 6.2a1.85 1.85 0 1 1 2.55 1.72c-.55.25-.75.55-.75 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.35" r="0.7" fill="currentColor" />
    </svg>
  );
}
