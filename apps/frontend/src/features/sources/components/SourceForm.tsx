import type { FormEvent, ReactNode } from 'react';
import type { DataModelFieldDto, DataSourceDto, DataSourceRequest } from '@/types/api';

export type SourceDraft = DataSourceRequest & { secret: string };

type SourceFormProps = {
  draft: SourceDraft;
  editingSource: DataSourceDto | null;
  nodeFields: DataModelFieldDto[];
  columns: string[];
  onChange: (change: Partial<SourceDraft>) => void;
  onColumnChange: (fieldKey: string, column: string) => void;
  onSubmit: () => void;
  onTest: () => void;
  onClose: () => void;
};

type LabeledProps = { label: string; children: ReactNode };

function Labeled({ label, children }: LabeledProps) {
  return (
    <label className="github-import-search-label">
      <span className="github-import-search-span">{label}</span>
      {children}
    </label>
  );
}

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isRequired?: boolean;
  type?: string;
  list?: string;
  autoComplete?: string;
};

function TextInput({ label, value, onChange, isRequired, type, list, autoComplete }: TextInputProps) {
  return (
    <Labeled label={label}>
      <input
        className="github-import-search-input"
        required={isRequired}
        type={type}
        list={list}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Labeled>
  );
}

export function SourceForm({
  draft,
  editingSource,
  nodeFields,
  columns,
  onChange,
  onColumnChange,
  onSubmit,
  onTest,
  onClose,
}: SourceFormProps) {
  const isMcp = draft.kind === 'MCP';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="github-import-third-party-form" onSubmit={submit}>
      <TextInput label="Name" isRequired value={draft.name} onChange={(name) => onChange({ name })} />
      <Labeled label="Type">
        <select
          className="github-import-search-input"
          value={draft.kind}
          onChange={(event) => onChange({ kind: event.target.value as SourceDraft['kind'] })}
        >
          <option value="API">API (GET, JSON list)</option>
          <option value="MCP">MCP server</option>
        </select>
      </Labeled>
      <TextInput
        label={isMcp ? 'Server URL' : 'Endpoint'}
        isRequired
        type="url"
        value={draft.endpoint}
        onChange={(endpoint) => onChange({ endpoint })}
      />
      {isMcp ? (
        <TextInput label="Tool name" isRequired value={draft.toolName ?? ''} onChange={(toolName) => onChange({ toolName })} />
      ) : null}
      <TextInput
        label="Path to the list (optional, e.g. data.items)"
        value={draft.itemsPath ?? ''}
        onChange={(itemsPath) => onChange({ itemsPath })}
      />
      <Labeled label="Authentication">
        <select
          className="github-import-search-input"
          value={draft.authType}
          onChange={(event) => onChange({ authType: event.target.value as SourceDraft['authType'] })}
        >
          <option value="NONE">None</option>
          <option value="BEARER">Bearer token</option>
          <option value="API_KEY">API key header</option>
          <option value="BASIC">Basic</option>
        </select>
      </Labeled>
      {draft.authType === 'API_KEY' ? (
        <TextInput
          label="Header name"
          value={draft.authHeaderName ?? ''}
          onChange={(authHeaderName) => onChange({ authHeaderName })}
        />
      ) : null}
      {draft.authType === 'BASIC' ? (
        <TextInput
          label="Username"
          value={draft.authUsername ?? ''}
          onChange={(authUsername) => onChange({ authUsername })}
        />
      ) : null}
      {draft.authType !== 'NONE' ? (
        <TextInput
          label={`Secret${editingSource?.secretSet ? ' (set, leave blank to keep; re-enter it if you change the endpoint)' : ''}`}
          type="password"
          autoComplete="new-password"
          value={draft.secret}
          onChange={(secret) => onChange({ secret })}
        />
      ) : null}
      <TextInput
        label="Key column (the application identifier in the source)"
        list="source-columns"
        value={draft.keyColumn ?? ''}
        onChange={(keyColumn) => onChange({ keyColumn })}
      />
      <datalist id="source-columns">
        {columns.map((column) => (
          <option key={column} value={column} />
        ))}
      </datalist>
      {nodeFields.length > 0 ? <p className="source-hint">Column feeding each application attribute</p> : null}
      {nodeFields.map((field) => (
        <TextInput
          key={field.key}
          label={field.label}
          list="source-columns"
          value={draft.columnMap[field.key] ?? ''}
          onChange={(column) => onColumnChange(field.key, column)}
        />
      ))}
      <div className="source-actions">
        <button type="submit" className="github-import-btn">
          Save
        </button>
        <button type="button" className="github-import-btn-secondary" disabled={!editingSource} onClick={onTest}>
          Test connection
        </button>
        <button type="button" className="github-import-btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </form>
  );
}
