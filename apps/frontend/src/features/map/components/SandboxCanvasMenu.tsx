import type { KeyboardEvent } from 'react';
import { sandboxIconLabel } from '../utils/sandboxDocuments';
import { SandboxIconGlyph } from './SandboxIconGlyph';

type SandboxCanvasMenuProps = {
  sharing: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  onSubmitShare: () => void;
  onCancelShare: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onSave: () => void;
  onStartShare: () => void;
  onClose: () => void;
  onNewSandbox: () => void;
  onAddNode: () => void;
  onAddEdge: () => void;
  onAddText: (() => void) | null;
  recentIcons: string[];
  onPickRecentIcon: (iconKey: string) => void;
};

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="sandbox-pane__ctx-item" onClick={onClick}>
      {label}
    </button>
  );
}

/** Canvas right-click actions. Share replaces the list with a username field. */
export function SandboxCanvasMenu({
  sharing,
  username,
  onUsernameChange,
  onSubmitShare,
  onCancelShare,
  onDuplicate,
  onRename,
  onSave,
  onStartShare,
  onClose,
  onNewSandbox,
  onAddNode,
  onAddEdge,
  onAddText,
  recentIcons,
  onPickRecentIcon,
}: SandboxCanvasMenuProps) {
  if (sharing) {
    return (
      <>
        <input
          className="graph-drawer-input"
          aria-label="Username"
          placeholder="Username"
          value={username}
          autoFocus
          onChange={(event) => onUsernameChange(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmitShare();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelShare();
            }
          }}
        />
        <button
          type="button"
          className="sandbox-pane__ctx-item"
          disabled={!username.trim()}
          onClick={onSubmitShare}
        >
          Send
        </button>
      </>
    );
  }

  return (
    <>
      <MenuItem label="Duplicate" onClick={onDuplicate} />
      <MenuItem label="Rename" onClick={onRename} />
      <MenuItem label="Save" onClick={onSave} />
      <MenuItem label="Share" onClick={onStartShare} />
      <MenuItem label="Close" onClick={onClose} />
      <MenuItem label="New sandbox" onClick={onNewSandbox} />
      <div className="sandbox-pane__ctx-sep" role="separator" />
      <MenuItem label="Add node" onClick={onAddNode} />
      <MenuItem label="Add edge" onClick={onAddEdge} />
      {onAddText ? <MenuItem label="Add text" onClick={onAddText} /> : null}
      {recentIcons.length > 0 ? (
        <>
          <div className="sandbox-pane__ctx-sep" role="separator" />
          {recentIcons.map((iconKey) => (
            <button
              key={iconKey}
              type="button"
              className="sandbox-pane__ctx-item sandbox-pane__ctx-item--icon"
              onClick={() => onPickRecentIcon(iconKey)}
            >
              <SandboxIconGlyph iconKey={iconKey} />
              <span>{sandboxIconLabel(iconKey)}</span>
            </button>
          ))}
        </>
      ) : null}
    </>
  );
}
