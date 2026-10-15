import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

export function useMenuOpenState(shouldCloseOnEscape: boolean) {
  const [isOpen, setIsOpen] = useState(false);
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
    if (shouldCloseOnEscape) document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      if (shouldCloseOnEscape) document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, shouldCloseOnEscape]);

  return { isOpen, setIsOpen, rootRef };
}

export function MenuToggleButton({
  label,
  isOpen,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className="graph-views-actions-btn"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <MenuDots />
    </button>
  );
}

function MenuDots() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="10" cy="4.5" r="1.3" fill="currentColor" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function MenuChoiceList({
  labels,
  isDanger,
  onPick,
}: {
  labels: readonly string[];
  isDanger: (label: string) => boolean;
  onPick: (label: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="graph-views-actions-menu" role="menu">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          className={isDanger(label) ? 'quiet-danger' : undefined}
          onClick={(event) => onPick(label, event)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
