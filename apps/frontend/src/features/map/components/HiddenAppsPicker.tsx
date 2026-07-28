import { useEffect, useMemo, useRef, useState } from 'react';

type HiddenAppOption = {
  id: string;
  label: string;
};

type HiddenAppsPickerProps = {
  hiddenIds: string[];
  options: HiddenAppOption[];
  onShow: (ids: string[]) => void;
};

export function HiddenAppsPicker({ hiddenIds, options, onShow }: HiddenAppsPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(hiddenIds));
    setFilter('');
  }, [open, hiddenIds]);

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

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q)
    );
  }, [options, filter]);

  const showFilter = options.length > 8;

  const toggleId = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShowSelected = () => {
    const ids = [...selected].filter((id) => hiddenIds.includes(id));
    if (ids.length === 0) return;
    onShow(ids);
    setOpen(false);
  };

  const handleShowAll = () => {
    onShow([...hiddenIds]);
    setOpen(false);
  };

  if (hiddenIds.length === 0) return null;

  return (
    <div className="hidden-apps-picker" ref={rootRef}>
      <button
        type="button"
        className="hidden-apps-picker-trigger"
        aria-label="Show hidden applications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>

      {open ? (
        <div className="hidden-apps-picker-popover" role="dialog" aria-label="Hidden applications">
          <div className="hidden-apps-picker-header">
            <span className="hidden-apps-picker-title">Hidden applications</span>
            <span className="hidden-apps-picker-count">{hiddenIds.length}</span>
          </div>

          {showFilter ? (
            <input
              type="search"
              className="hidden-apps-picker-filter"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
          ) : null}

          <ul className="hidden-apps-picker-list">
            {filtered.length === 0 ? (
              <li className="hidden-apps-picker-empty">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <label className="hidden-apps-picker-item">
                    <input
                      type="checkbox"
                      checked={selected.has(opt.id)}
                      onChange={() => toggleId(opt.id)}
                    />
                    <span className="hidden-apps-picker-item-text">
                      <span className="hidden-apps-picker-item-label">{opt.label}</span>
                      <span className="hidden-apps-picker-item-id">{opt.id}</span>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>

          <div className="hidden-apps-picker-actions">
            <button
              type="button"
              className="hidden-apps-picker-btn hidden-apps-picker-btn--ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="hidden-apps-picker-btn hidden-apps-picker-btn--ghost"
              onClick={handleShowAll}
            >
              Show all
            </button>
            <button
              type="button"
              className="hidden-apps-picker-btn hidden-apps-picker-btn--primary"
              onClick={handleShowSelected}
              disabled={selected.size === 0}
            >
              Show selected
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
