import { useEffect } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { BreachResults } from '../components/BreachResults';
import { BreachRuleEditor } from '../components/BreachRuleEditor';
import { BreachEmptyState, BreachRuleList } from '../components/BreachRuleList';
import { useBreachRuleEditor } from '../useBreachRuleEditor';

function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);
}

function formatUpdate(updatedAt: string, updatedBy: string | null): string {
  const date = new Date(updatedAt).toLocaleDateString();
  return updatedBy ? `Updated on ${date} by ${updatedBy}` : `Updated on ${date}`;
}

function BreachDetail({ editor, isAdmin }: { editor: ReturnType<typeof useBreachRuleEditor>; isAdmin: boolean }) {
  const { draft, fields, issue, status, selectedRule, isNew, isDirty, isSaving, result, isEvaluating } = editor;
  if (!draft) return null;
  return (
    <div className="breach-detail">
      <BreachRuleEditor draft={draft} fields={fields} isReadOnly={!isAdmin} issue={issue} onChange={editor.changeDraft} />
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
            onClick={() => void editor.saveAndEvaluate()}
          >
            {isSaving ? 'Saving…' : 'Save and evaluate'}
          </button>
          {selectedRule ? (
            <span className="data-model-meta">{formatUpdate(selectedRule.updatedAt, selectedRule.updatedBy)}</span>
          ) : null}
          <button type="button" className="data-model-remove-btn" onClick={() => void editor.removeRule()}>
            <DataModelIcon name="trash" />
            {isNew ? 'Discard' : 'Delete rule'}
          </button>
        </div>
      ) : null}
      {isNew ? null : <BreachResults result={result} isLoading={isEvaluating} />}
    </div>
  );
}

export function BreachPage() {
  const { isAdmin } = useAuth();
  const editor = useBreachRuleEditor(isAdmin);
  useUnsavedChangesWarning(isAdmin && editor.isDirty);

  if (editor.loadError) {
    return (
      <div className="data-model-page breach-page">
        <p className="data-model-error">{editor.loadError}</p>
      </div>
    );
  }

  const hasNothingToShow = editor.rules.length === 0 && !editor.isNew;

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
          <button type="button" className="data-model-primary-btn data-model-add-btn" onClick={editor.startNewRule}>
            <DataModelIcon name="plus" />
            New rule
          </button>
        ) : null}
      </header>

      {!isAdmin ? <p className="data-model-readonly">Read-only view. Only administrators can edit breach rules.</p> : null}

      {hasNothingToShow ? (
        <BreachEmptyState isAdmin={isAdmin} onCreate={editor.startNewRule} />
      ) : (
        <div className="breach-layout">
          <BreachRuleList
            rules={editor.rules}
            selectedId={editor.selectedId}
            newRuleName={editor.isNew ? (editor.draft?.name.trim() ?? '') : null}
            onSelect={editor.selectRule}
          />
          <BreachDetail editor={editor} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
