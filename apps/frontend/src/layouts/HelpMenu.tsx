import { useEffect, useRef, useState } from 'react';
import { AboutContactForm } from '@/features/about/AboutContactForm';
import { HELP_TOPICS } from './helpTopics';

const HELP_PANEL_WIDTH = 352;
const HELP_PANEL_GAP = 8;
const HELP_VIEWPORT_GUTTER = 12;

function helpAnchor(buttonBounds: DOMRect): { top: number; left: number } {
  const left = Math.min(buttonBounds.left, window.innerWidth - HELP_PANEL_WIDTH - HELP_VIEWPORT_GUTTER);
  return {
    top: buttonBounds.bottom + HELP_PANEL_GAP,
    left: Math.max(HELP_VIEWPORT_GUTTER, left),
  };
}

function useDismissHelp(
  isOpen: boolean,
  rootRef: { current: HTMLElement | null },
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePointer(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closeRef.current();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
    }
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, rootRef]);
}

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useDismissHelp(isOpen, rootRef, () => setIsOpen(false));

  function toggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const buttonBounds = rootRef.current?.getBoundingClientRect();
    if (buttonBounds) setAnchor(helpAnchor(buttonBounds));
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
      {isOpen && anchor ? <HelpPanel top={anchor.top} left={anchor.left} /> : null}
    </div>
  );
}

function HelpPanel({ top, left }: { top: number; left: number }) {
  return (
    <div
      id="layout-help-panel"
      className="layout-help-panel"
      role="dialog"
      aria-label="Help"
      style={{ top, left, width: HELP_PANEL_WIDTH }}
    >
      {HELP_TOPICS.map((topic) => (
        <section key={topic.title} className="layout-help-section">
          <h3>{topic.title}</h3>
          <p>{topic.text}</p>
        </section>
      ))}
      <AboutContactForm />
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
