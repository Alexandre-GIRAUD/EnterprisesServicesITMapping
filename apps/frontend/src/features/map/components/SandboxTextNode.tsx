import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import type { SandboxTextAlign, SandboxTextFontSize } from '../utils/sandboxDocuments';
import { DEFAULT_SANDBOX_TEXT_PLACEHOLDER } from '../utils/sandboxDocuments';

export type SandboxTextNodeData = {
  text: string;
  fontSize: SandboxTextFontSize;
  align: SandboxTextAlign;
  width: number;
  onChangeText?: (text: string) => void;
  onChangeFontSize?: (fontSize: SandboxTextFontSize) => void;
  onChangeAlign?: (align: SandboxTextAlign) => void;
  onChangeWidth?: (width: number) => void;
  onDelete?: () => void;
  startEditing?: boolean;
  onStartedEditing?: () => void;
};

export type SandboxTextNodeType = Node<SandboxTextNodeData, 'sandboxText'>;

const FONT_OPTIONS: { value: SandboxTextFontSize; label: string }[] = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'title', label: 'T' },
];

export function SandboxTextNode({ id, data, selected }: NodeProps<SandboxTextNodeType>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(data.text);
  }, [data.text, editing]);

  useEffect(() => {
    if (!data.startEditing) return;
    setEditing(true);
    data.onStartedEditing?.();
    // Intentionally depend only on the start flag; callbacks are stable per render from doc.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-trigger on data object identity
  }, [data.startEditing]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== data.text) data.onChangeText?.(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(data.text);
      setEditing(false);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  function onDoubleClick(e: ReactMouseEvent) {
    e.stopPropagation();
    setEditing(true);
  }

  function onResizePointerDown(e: React.PointerEvent<HTMLSpanElement>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = data.width;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const next = Math.min(640, Math.max(120, Math.round(startW + (ev.clientX - startX))));
      data.onChangeWidth?.(next);
    }
    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  const display =
    data.text.trim().length > 0 ? data.text : DEFAULT_SANDBOX_TEXT_PLACEHOLDER;
  const isPlaceholder = data.text.trim().length === 0;

  return (
    <div
      className={`sandbox-text-node sandbox-text-node--${data.fontSize}${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`}
      style={{ width: data.width, textAlign: data.align }}
      onDoubleClick={onDoubleClick}
    >
      {selected && !editing ? (
        <div
          className="sandbox-text-node__toolbar nodrag nopan"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sandbox-text-node__size${data.fontSize === opt.value ? ' is-active' : ''}`}
              title={`Size ${opt.label}`}
              aria-label={`Font size ${opt.label}`}
              onClick={() => data.onChangeFontSize?.(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            className={`sandbox-text-node__align${data.align === 'left' ? ' is-active' : ''}`}
            title="Align left"
            aria-label="Align left"
            onClick={() => data.onChangeAlign?.('left')}
          >
            L
          </button>
          <button
            type="button"
            className={`sandbox-text-node__align${data.align === 'center' ? ' is-active' : ''}`}
            title="Align center"
            aria-label="Align center"
            onClick={() => data.onChangeAlign?.('center')}
          >
            C
          </button>
          {data.onDelete ? (
            <button
              type="button"
              className="sandbox-text-node__delete"
              aria-label="Remove text"
              title="Remove text"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.();
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      {editing ? (
        <textarea
          ref={textareaRef}
          className="sandbox-text-node__editor nodrag nopan"
          value={draft}
          rows={Math.max(2, draft.split('\n').length)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={DEFAULT_SANDBOX_TEXT_PLACEHOLDER}
          aria-label="Edit text box"
        />
      ) : (
        <div
          className={`sandbox-text-node__body${isPlaceholder ? ' is-placeholder' : ''}`}
          data-id={id}
        >
          {display.split('\n').map((line, i) => (
            <span key={i}>
              {i > 0 ? <br /> : null}
              {line || '\u00A0'}
            </span>
          ))}
        </div>
      )}
      {selected && !editing ? (
        <span
          className="sandbox-text-node__resize nodrag nopan"
          onPointerDown={onResizePointerDown}
          title="Resize width"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
