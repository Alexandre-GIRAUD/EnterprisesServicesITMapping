import { useEffect, useRef, useState } from 'react';
import type { GraphImageFormat } from '../utils/exportGraphImage';

type GraphExportMenuProps = {
  disabled?: boolean;
  busy?: boolean;
  onExport: (format: GraphImageFormat) => void | Promise<void>;
};

export function GraphExportMenu({ disabled = false, busy = false, onExport }: GraphExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const handleExport = async (format: GraphImageFormat) => {
    setOpen(false);
    await onExport(format);
  };

  return (
    <div className="graph-export-menu" ref={rootRef}>
      <button
        type="button"
        className="graph-export-menu-trigger"
        aria-label="Export diagram"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export diagram"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? 'Exporting…' : 'Export'}
      </button>

      {open ? (
        <div className="graph-export-menu-popover" role="menu" aria-label="Export format">
          <button
            type="button"
            role="menuitem"
            className="graph-export-menu-item"
            onClick={() => void handleExport('png')}
          >
            Export PNG
          </button>
          <button
            type="button"
            role="menuitem"
            className="graph-export-menu-item"
            onClick={() => void handleExport('jpeg')}
          >
            Export JPEG
          </button>
        </div>
      ) : null}
    </div>
  );
}
