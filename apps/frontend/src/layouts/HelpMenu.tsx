import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AboutContactForm } from '@/features/about/AboutContactForm';
import { HELP_TOPICS } from './helpTopics';
import { NavigationIcon } from './NavigationIcon';
import { SidebarNavItem } from './SidebarNavItem';

const HELP_PANEL_WIDTH = 352;
const HELP_PANEL_GAP = 8;
const HELP_VIEWPORT_GUTTER = 12;

function placeHelpPanel(buttonBounds: DOMRect): { top?: number; bottom?: number; left: number } {
  const left = Math.max(
    HELP_VIEWPORT_GUTTER,
    Math.min(buttonBounds.left, window.innerWidth - HELP_PANEL_WIDTH - HELP_VIEWPORT_GUTTER),
  );
  const spaceBelow = window.innerHeight - buttonBounds.bottom;
  const spaceAbove = buttonBounds.top;
  if (spaceBelow < spaceAbove) {
    return { bottom: window.innerHeight - buttonBounds.top + HELP_PANEL_GAP, left };
  }
  return { top: buttonBounds.bottom + HELP_PANEL_GAP, left };
}

function useDismissHelp(
  isOpen: boolean,
  rootRef: { current: HTMLElement | null },
  panelRef: { current: HTMLElement | null },
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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
  }, [isOpen, rootRef, panelRef]);
}

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDismissHelp(isOpen, rootRef, panelRef, () => setIsOpen(false));

  function toggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const buttonBounds = rootRef.current?.getBoundingClientRect();
    if (buttonBounds) setAnchor(placeHelpPanel(buttonBounds));
    setIsOpen(true);
  }

  return (
    <div className="layout-help" ref={rootRef}>
      <SidebarNavItem
        label="Help"
        icon={<NavigationIcon name="circleHelp" />}
        isActive={isOpen}
        ariaLabel="Help"
        ariaExpanded={isOpen}
        ariaControls="layout-help-panel"
        onClick={toggle}
      />
      {isOpen && anchor ? (
        <HelpPanel top={anchor.top} bottom={anchor.bottom} left={anchor.left} panelRef={panelRef} />
      ) : null}
    </div>
  );
}

function HelpPanel({
  top,
  bottom,
  left,
  panelRef,
}: {
  top?: number;
  bottom?: number;
  left: number;
  panelRef: { current: HTMLDivElement | null };
}) {
  return createPortal(
    <div
      id="layout-help-panel"
      className="layout-help-panel"
      role="dialog"
      aria-label="Help"
      ref={panelRef}
      style={{ top, bottom, left, width: HELP_PANEL_WIDTH }}
    >
      {HELP_TOPICS.map((topic) => (
        <section key={topic.title} className="layout-help-section">
          <h3>{topic.title}</h3>
          <p>{topic.text}</p>
        </section>
      ))}
      <AboutContactForm />
    </div>,
    document.body,
  );
}

