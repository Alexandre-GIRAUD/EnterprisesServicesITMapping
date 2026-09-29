import { useEffect, useRef, useState } from 'react';

export type TableFileFormat = 'csv' | 'excel';

type TableExportMenuProps = {
  disabled?: boolean;
  onExport: (format: TableFileFormat) => void;
};

export function TableExportMenu({ disabled = false, onExport }: TableExportMenuProps) {
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

  const handleExport = (format: TableFileFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div className="graph-export-menu" ref={rootRef}>
      <button
        type="button"
        className="graph-export-menu-trigger"
        aria-label="Export table"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export table"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </button>
      {open ? (
        <div className="graph-export-menu-popover" role="menu" aria-label="Export format">
          <button type="button" role="menuitem" className="graph-export-menu-item" onClick={() => handleExport('csv')}>
            Export CSV
          </button>
          <button type="button" role="menuitem" className="graph-export-menu-item" onClick={() => handleExport('excel')}>
            Export Excel
          </button>
        </div>
      ) : null}
    </div>
  );
}
