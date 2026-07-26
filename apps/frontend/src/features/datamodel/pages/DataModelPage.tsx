import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getDataModelPromptPreviewRequest,
  getDataModelRequest,
  putDataModelRequest,
} from '@/features/datamodel/api/dataModelApi';
import type { DataModelDetection, DataModelFieldDto, DataModelTarget } from '@/types/api';

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const RESERVED_KEYS = new Set([
  'id',
  'name',
  'description',
  'year',
  'connection_kind',
  'channel',
  'direction',
  'confidence',
  'discovered_from_application_id',
]);

function emptyField(): DataModelFieldDto {
  return {
    key: '',
    label: '',
    description: '',
    promptHint: '',
    allowedValues: [],
    enforceEnum: false,
    required: false,
    detection: 'AUTOMATIC_DETECTION',
    target: 'EDGE',
  };
}

function normalizeDetection(detection?: DataModelDetection): DataModelDetection {
  return detection === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC_DETECTION';
}

function normalizeTarget(target?: DataModelTarget): DataModelTarget {
  return target === 'NODE' ? 'NODE' : 'EDGE';
}

function validateFields(fields: DataModelFieldDto[]): string | null {
  const seen = new Set<string>();
  for (const field of fields) {
    const key = field.key.trim().toLowerCase();
    if (!KEY_PATTERN.test(key)) {
      return `Invalid key: ${field.key || '(empty)'}`;
    }
    if (RESERVED_KEYS.has(key)) {
      return `Reserved key: ${key}`;
    }
    if (seen.has(key)) {
      return `Duplicate key: ${key}`;
    }
    seen.add(key);
    if (!field.label.trim()) {
      return `Label required for key: ${key}`;
    }
    if (field.enforceEnum && (!field.allowedValues || field.allowedValues.length === 0)) {
      return `Allowed values required when enforce enum is on (${key})`;
    }
  }
  return null;
}

export function DataModelPage() {
  const { isAdmin } = useAuth();
  const [fields, setFields] = useState<DataModelFieldDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [promptPreview, setPromptPreview] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await getDataModelRequest();
    setFields(
      data.fields.length > 0
        ? data.fields.map((f) => ({
            ...f,
            detection: normalizeDetection(f.detection),
            target: normalizeTarget(f.target),
          }))
        : [emptyField()]
    );
    setUpdatedAt(data.updatedAt);
    const preview = await getDataModelPromptPreviewRequest();
    setPromptPreview(preview);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        if (!cancelled) setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Unable to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const clientValidationError = useMemo(() => {
    const meaningful = fields.filter((f) => f.key.trim() || f.label.trim());
    return validateFields(meaningful);
  }, [fields]);

  function updateField(index: number, patch: Partial<DataModelFieldDto>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => (prev.length <= 1 ? [emptyField()] : prev.filter((_, i) => i !== index)));
  }

  function addField() {
    setFields((prev) => [...prev, emptyField()]);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    const payload = fields
      .filter((f) => f.key.trim() || f.label.trim())
      .map((f) => ({
        ...f,
        key: f.key.trim().toLowerCase(),
        label: f.label.trim(),
        description: f.description?.trim() ?? '',
        promptHint: f.promptHint?.trim() ?? '',
        allowedValues: (f.allowedValues ?? []).map((v) => v.trim()).filter(Boolean),
        detection: normalizeDetection(f.detection),
        target: normalizeTarget(f.target),
      }));

    const validationError = validateFields(payload);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaveBusy(true);
    try {
      const saved = await putDataModelRequest({ fields: payload });
      setFields(
        saved.fields.length > 0
          ? saved.fields.map((f) => ({
              ...f,
              detection: normalizeDetection(f.detection),
              target: normalizeTarget(f.target),
            }))
          : [emptyField()]
      );
      setUpdatedAt(saved.updatedAt);
      setPromptPreview(await getDataModelPromptPreviewRequest());
      setSaveMessage('Data Model saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setSaveBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="data-model-page">
        <p className="data-model-error">{loadError}</p>
        <Link to="/map" className="auth-link">
          Back to map
        </Link>
      </div>
    );
  }

  const activeFieldCount = fields.filter((f) => f.key.trim()).length;
  const automaticFieldCount = fields.filter(
    (f) => f.key.trim() && normalizeDetection(f.detection) === 'AUTOMATIC_DETECTION'
  ).length;

  return (
    <div className="data-model-page">
      <header className="data-model-header">
        <h1>Data Model</h1>
        <p className="data-model-lead">
          Define dynamic fields for connection flows (edges) and for the analyzed Application
          (node). Automatic fields enrich the connection-discovery AI prompt and are persisted on
          Neo4j <code>DEPENDS_ON</code> relationships or the <code>Application</code> node.
        </p>
        {updatedAt ? (
          <p className="data-model-meta">Last updated: {new Date(updatedAt).toLocaleString()}</p>
        ) : null}
      </header>

      {activeFieldCount === 0 || automaticFieldCount === 0 ? (
        <div className="data-model-banner" role="status">
          {activeFieldCount === 0
            ? 'No fields configured — connection suggestion will discover technical topology only (peer, direction, connection_kind, channel).'
            : 'No automatic-detection fields — connection suggestion will discover technical topology only. Manual fields are not searched by AI.'}
        </div>
      ) : null}

      {!isAdmin ? (
        <p className="data-model-readonly">
          Read-only view. Only administrators can edit the Data Model.
        </p>
      ) : null}

      <form className="data-model-form" onSubmit={onSave}>
        <div className="data-model-fields">
          {fields.map((field, index) => {
            const detection = normalizeDetection(field.detection);
            const target = normalizeTarget(field.target);
            return (
              <section key={index} className="data-model-field-card">
                <div className="data-model-field-row">
                  <label className="data-model-label">
                    Key
                    <input
                      className="data-model-input"
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      placeholder="product_line"
                      disabled={!isAdmin}
                      spellCheck={false}
                    />
                  </label>
                  <label className="data-model-label">
                    Label
                    <input
                      className="data-model-input"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Product line"
                      disabled={!isAdmin}
                    />
                  </label>
                </div>

                <label className="data-model-label">
                  Target
                  <select
                    className="data-model-input"
                    value={target}
                    onChange={(e) =>
                      updateField(index, {
                        target: e.target.value as DataModelTarget,
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <option value="EDGE">Edge (connection)</option>
                    <option value="NODE">Application (node)</option>
                  </select>
                </label>
                {target === 'NODE' ? (
                  <p className="data-model-field-hint" role="note">
                    Applied to the analyzed Application during connection suggestion (AI).
                  </p>
                ) : null}

                <label className="data-model-label">
                  Detection
                  <select
                    className="data-model-input"
                    value={detection}
                    onChange={(e) =>
                      updateField(index, {
                        detection: e.target.value as DataModelDetection,
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <option value="AUTOMATIC_DETECTION">Automatic detection</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </label>
                {detection === 'MANUAL' ? (
                  <p className="data-model-field-hint" role="note">
                    Not searched by AI connection suggestion. Required is ignored for AI when
                    Manual.
                  </p>
                ) : null}

                <label className="data-model-label">
                  Description
                  <textarea
                    className="data-model-textarea"
                    value={field.description ?? ''}
                    onChange={(e) => updateField(index, { description: e.target.value })}
                    rows={2}
                    disabled={!isAdmin}
                  />
                </label>

                <label className="data-model-label">
                  Detection hint (prompt)
                  <textarea
                    className="data-model-textarea"
                    value={field.promptHint ?? ''}
                    onChange={(e) => updateField(index, { promptHint: e.target.value })}
                    rows={2}
                    disabled={!isAdmin || detection === 'MANUAL'}
                  />
                </label>

                <label className="data-model-label">
                  Allowed values (comma-separated)
                  <input
                    className="data-model-input"
                    value={(field.allowedValues ?? []).join(', ')}
                    onChange={(e) =>
                      updateField(index, {
                        allowedValues: e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="VALUE_A, VALUE_B"
                    disabled={!isAdmin}
                  />
                </label>

                <div className="data-model-checks">
                  <label className="data-model-check">
                    <input
                      type="checkbox"
                      checked={field.enforceEnum}
                      onChange={(e) => updateField(index, { enforceEnum: e.target.checked })}
                      disabled={!isAdmin}
                    />
                    Enforce enum (strict)
                  </label>
                  <label className="data-model-check">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                      disabled={!isAdmin || detection === 'MANUAL'}
                    />
                    Required
                    {detection === 'MANUAL' ? ' (ignored when Manual)' : ''}
                  </label>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    className="data-model-remove-btn"
                    onClick={() => removeField(index)}
                  >
                    Remove field
                  </button>
                ) : null}
              </section>
            );
          })}
        </div>

        {isAdmin ? (
          <div className="data-model-actions">
            <button type="button" className="data-model-secondary-btn" onClick={addField}>
              Add field
            </button>
            <button
              type="submit"
              className="data-model-primary-btn"
              disabled={saveBusy || Boolean(clientValidationError)}
            >
              {saveBusy ? 'Saving…' : 'Save Data Model'}
            </button>
          </div>
        ) : null}

        {clientValidationError && isAdmin ? (
          <p className="data-model-error">{clientValidationError}</p>
        ) : null}
        {saveError ? <p className="data-model-error">{saveError}</p> : null}
        {saveMessage ? <p className="data-model-success">{saveMessage}</p> : null}
      </form>

      <section className="data-model-panel">
        <h2>Prompt preview</h2>
        <p className="data-model-lead">
          Section(s) injected into the connection-discovery user message when automatic fields are
          configured (manual fields are excluded). Edge and Application (node) fields appear in
          separate sections.
        </p>
        <pre className="data-model-preview">
          {promptPreview.trim() || '(empty — topology-only mode)'}
        </pre>
      </section>
    </div>
  );
}
