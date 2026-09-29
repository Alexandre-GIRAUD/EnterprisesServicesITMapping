import { useEffect, useRef, useState } from 'react';

export type TableFileFormat = 'csv' | 'excel' | 'png' | 'pdf';

type TableExportMenuProps = {
  disabled?: boolean;
  mode?: 'grid' | 'image';
  onExport: (format: TableFileFormat) => void;
};

const GRID_ITEMS: { format: TableFileFormat; label: string }[] = [
  { format: 'csv', label: 'Export CSV' },
  { format: 'excel', label: 'Export Excel' },
];

const IMAGE_ITEMS: { format: TableFileFormat; label: string }[] = [
  { format: 'png', label: 'Export PNG' },
  { format: 'pdf', label: 'Export PDF' },
];

export function TableExportMenu({ disabled = false, mode = 'grid', onExport }: TableExportMenuProps) {
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
  const items = mode === 'image' ? IMAGE_ITEMS : GRID_ITEMS;

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
          {items.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              className="graph-export-menu-item"
              onClick={() => handleExport(item.format)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
