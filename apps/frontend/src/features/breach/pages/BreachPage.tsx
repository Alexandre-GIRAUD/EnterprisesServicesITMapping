import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import type { BreachResultDto, BreachRuleDto, BreachRuleRequest, DataModelFieldDto } from '@/types/api';
import { deleteBreachRule, evaluateBreachRule, listBreachRules, saveBreachRule } from '../api/breachApi';
import { draftIssue, isDraftDirty, newRuleDraft, SUBJECT_LABELS } from '../breachRules';
import { BreachResults } from '../components/BreachResults';
import { BreachRuleEditor } from '../components/BreachRuleEditor';
import { FlameIcon } from '../components/FlameIcon';

const NEW_RULE_ID = 'new';

type StatusMessage = { isError: boolean; text: string };

function toRequest(rule: BreachRuleDto): BreachRuleRequest {
  return { name: rule.name, subject: rule.subject, definition: rule.definition };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);
}

export function BreachPage() {
  const { isAdmin } = useAuth();
  const [rules, setRules] = useState<BreachRuleDto[]>([]);
  const [fields, setFields] = useState<DataModelFieldDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BreachRuleRequest | null>(null);
  const [result, setResult] = useState<BreachResultDto | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedRule = rules.find((rule) => rule.id === selectedId) ?? null;
  const savedDraft = selectedRule ? toRequest(selectedRule) : null;
  const isDirty = draft !== null && isDraftDirty(draft, savedDraft);
  useUnsavedChangesWarning(isAdmin && isDirty);

  const showRule = useCallback(async (rule: BreachRuleDto) => {
    setSelectedId(rule.id);
    setDraft(toRequest(rule));
    setResult(null);
    setIsEvaluating(true);
    try {
      setResult(await evaluateBreachRule(rule.id));
    } catch (error) {
      setStatus({ isError: true, text: errorText(error, 'Unable to evaluate the rule.') });
    } finally {
      setIsEvaluating(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedRules, model] = await Promise.all([listBreachRules(), getDataModelRequest()]);
        if (cancelled) return;
        setRules(loadedRules);
        setFields(model.fields);
        if (loadedRules.length > 0) void showRule(loadedRules[0]);
      } catch (error) {
        if (!cancelled) setLoadError(errorText(error, 'Unable to load the breach rules.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRule]);

  function confirmLeavingDraft(): boolean {
    return !isAdmin || !isDirty || window.confirm('Discard the unsaved changes of this rule?');
  }

  function selectRule(rule: BreachRuleDto) {
    if (rule.id === selectedId || !confirmLeavingDraft()) return;
    setStatus(null);
    void showRule(rule);
  }

  function startNewRule() {
    if (!confirmLeavingDraft()) return;
    setStatus(null);
    setSelectedId(NEW_RULE_ID);
    setDraft(newRuleDraft('APPLICATION', fields));
    setResult(null);
  }

  async function saveAndEvaluate() {
    if (!draft) return;
    const issue = draftIssue(draft);
    if (issue) {
      setStatus({ isError: true, text: issue });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const saved = await saveBreachRule(draft, selectedRule?.id ?? null);
      setRules((current) =>
        [...current.filter((rule) => rule.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      setStatus({ isError: false, text: 'Rule saved.' });
      await showRule(saved);
    } catch (error) {
      setStatus({ isError: true, text: errorText(error, 'Unable to save the rule.') });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRule() {
    if (!selectedRule) {
      setSelectedId(null);
      setDraft(null);
      return;
    }
    if (!window.confirm(`Delete rule "${selectedRule.name}"?`)) return;
    try {
      await deleteBreachRule(selectedRule.id);
      const remaining = rules.filter((rule) => rule.id !== selectedRule.id);
      setRules(remaining);
      setStatus({ isError: false, text: 'Rule deleted.' });
      if (remaining.length > 0) {
        void showRule(remaining[0]);
      } else {
        setSelectedId(null);
        setDraft(null);
        setResult(null);
      }
    } catch (error) {
      setStatus({ isError: true, text: errorText(error, 'Unable to delete the rule.') });
    }
  }

  if (loadError) {
    return (
      <div className="data-model-page breach-page">
        <p className="data-model-error">{loadError}</p>
      </div>
    );
  }

  const isNew = selectedId === NEW_RULE_ID;

  return (
    <div className="data-model-page breach-page">
      <header className="data-model-header">
        <div>
          <h1>Breach</h1>
          <p className="data-model-lead">
            Rules on your IT system. Applications and flows that match a rule are flagged as in breach.
          </p>
        </div>
        {isAdmin ? (
          <button type="button" className="data-model-primary-btn data-model-add-btn" onClick={startNewRule}>
            <DataModelIcon name="plus" />
            New rule
          </button>
        ) : null}
      </header>

      {!isAdmin ? (
        <p className="data-model-readonly">Read-only view. Only administrators can edit breach rules.</p>
      ) : null}

      {rules.length === 0 && !isNew ? (
        <div className="breach-empty" role="status">
          <span className="breach-empty-mark" aria-hidden="true">
            <FlameIcon size={22} />
          </span>
          <div>
            <p className="breach-empty-title">No rule yet.</p>
            <p className="data-model-lead">
              A rule flags what breaks your standards, for example every application whose cost is over 100k.
            </p>
          </div>
          {isAdmin ? (
            <button type="button" className="data-model-primary-btn" onClick={startNewRule}>
              Create your first rule
            </button>
          ) : null}
        </div>
      ) : (
        <div className="breach-layout">
          <nav className="breach-rule-list" aria-label="Breach rules">
            {rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className={`breach-rule-item${rule.id === selectedId ? ' is-selected' : ''}`}
                aria-current={rule.id === selectedId ? 'true' : undefined}
                onClick={() => selectRule(rule)}
              >
                <span className="breach-rule-item-name">{rule.name}</span>
                <span className="breach-rule-item-meta">
                  <span className="data-model-chip">{SUBJECT_LABELS[rule.subject]}</span>
                  <span className={`breach-count${rule.breachCount > 0 ? ' is-active' : ''}`}>
                    <FlameIcon size={13} />
                    {rule.breachCount}
                  </span>
                  {rule.unknownCount > 0 ? (
                    <span className="breach-unknown-count" title="Not evaluable">
                      ? {rule.unknownCount}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
            {isNew ? (
              <span className="breach-rule-item is-selected" aria-current="true">
                <span className="breach-rule-item-name">{draft?.name.trim() || 'New rule'}</span>
                <span className="breach-rule-item-meta">
                  <span className="data-model-chip is-unsaved">Unsaved</span>
                </span>
              </span>
            ) : null}
          </nav>

          {draft ? (
            <div className="breach-detail">
              <BreachRuleEditor draft={draft} fields={fields} isReadOnly={!isAdmin} onChange={setDraft} />
              {status ? (
                <p className={status.isError ? 'data-model-error' : 'data-model-success'} role="status">
                  {status.text}
                </p>
              ) : null}
              {isAdmin ? (
                <div className="breach-actions">
                  <button
                    type="button"
                    className="data-model-primary-btn"
                    disabled={isSaving || (!isNew && !isDirty)}
                    onClick={() => void saveAndEvaluate()}
                  >
                    {isSaving ? 'Saving…' : 'Save and evaluate'}
                  </button>
                  <button type="button" className="data-model-remove-btn" onClick={() => void removeRule()}>
                    <DataModelIcon name="trash" />
                    {isNew ? 'Discard' : 'Delete rule'}
                  </button>
                </div>
              ) : null}
              {isNew ? null : <BreachResults result={result} isLoading={isEvaluating} />}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
