import { useState, type DragEvent } from 'react';
import type { TableColumnDef } from '../utils/tableColumns';
import type { TableContentKind } from '../utils/tableColumns';

type Props = {
  table: TableContentKind;
  displayed: TableColumnDef[];
  hidden: TableColumnDef[];
  onHide: (columnId: string) => void;
  onShow: (columnId: string) => void;
  onShowAt: (columnId: string, toIndex: number) => void;
  onMoveInDisplay: (columnId: string, toIndex: number) => void;
};

type DragPayload = {
  columnId: string;
  from: 'display' | 'hidden';
};

function parsePayload(raw: string): DragPayload | null {
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (
      parsed &&
      typeof parsed.columnId === 'string' &&
      (parsed.from === 'display' || parsed.from === 'hidden')
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function TableColumnsPicker({
  table,
  displayed,
  hidden,
  onHide,
  onShow,
  onShowAt,
  onMoveInDisplay,
}: Props) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function onDragStart(columnId: string, from: 'display' | 'hidden', event: DragEvent) {
    event.dataTransfer.setData('application/x-table-column', JSON.stringify({ columnId, from }));
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDisplayDrop(index: number, event: DragEvent) {
    event.preventDefault();
    setDragOverIndex(null);
    const payload = parsePayload(event.dataTransfer.getData('application/x-table-column'));
    if (!payload) return;
    if (payload.from === 'hidden') {
      onShowAt(payload.columnId, index);
      return;
    }
    onMoveInDisplay(payload.columnId, index);
  }

  function onHiddenDrop(event: DragEvent) {
    event.preventDefault();
    const payload = parsePayload(event.dataTransfer.getData('application/x-table-column'));
    if (!payload) return;
    onHide(payload.columnId);
  }

  const subtitle = table === 'apps' ? 'Apps' : 'Flows';

  return (
    <div className="table-columns-picker" aria-label={`Columns for ${subtitle}`}>
      <p className="table-columns-picker__subtitle">{subtitle}</p>

      <section
        className="table-columns-picker__zone"
        aria-label="Display columns"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => onDisplayDrop(displayed.length, e)}
      >
        <h4 className="table-columns-picker__zone-title">Display</h4>
        {displayed.length === 0 ? (
          <p className="table-columns-picker__empty">Drag columns here to show them.</p>
        ) : (
          <ul className="table-columns-picker__list">
            {displayed.map((col, index) => (
              <li
                key={col.id}
                className={`table-columns-picker__item${dragOverIndex === index ? ' is-drop-target' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(col.id, 'display', e)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
                onDrop={(e) => {
                  e.stopPropagation();
                  onDisplayDrop(index, e);
                }}
              >
                <span className="table-columns-picker__label">{col.label}</span>
                <span className="table-columns-picker__actions">
                  <button
                    type="button"
                    aria-label={`Move ${col.label} up`}
                    disabled={index === 0}
                    onClick={() => onMoveInDisplay(col.id, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${col.label} down`}
                    disabled={index >= displayed.length - 1}
                    onClick={() => onMoveInDisplay(col.id, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Hide ${col.label}`}
                    onClick={() => onHide(col.id)}
                  >
                    Hide
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="table-columns-picker__zone"
        aria-label="Hidden columns"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={onHiddenDrop}
      >
        <h4 className="table-columns-picker__zone-title">Hidden</h4>
        {hidden.length === 0 ? (
          <p className="table-columns-picker__empty">All columns are displayed.</p>
        ) : (
          <ul className="table-columns-picker__list">
            {hidden.map((col) => (
              <li
                key={col.id}
                className="table-columns-picker__item"
                draggable
                onDragStart={(e) => onDragStart(col.id, 'hidden', e)}
              >
                <span className="table-columns-picker__label">{col.label}</span>
                <span className="table-columns-picker__actions">
                  <button
                    type="button"
                    aria-label={`Show ${col.label}`}
                    onClick={() => onShow(col.id)}
                  >
                    Show
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
