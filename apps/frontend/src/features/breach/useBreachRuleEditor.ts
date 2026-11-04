import { useCallback, useEffect, useState } from 'react';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import type { BreachResultDto, BreachRuleDto, BreachRuleRequest, DataModelFieldDto } from '@/types/api';
import { deleteBreachRule, evaluateBreachRule, listBreachRules, saveBreachRule } from './api/breachApi';
import { FIRST_SUBJECT, findDraftIssue, isDraftDirty, newRuleDraft, type DraftIssue } from './breachRules';

const NEW_RULE_ID = 'new';

type StatusMessage = { isError: boolean; text: string };

function toRequest(rule: BreachRuleDto): BreachRuleRequest {
  return { name: rule.name, subject: rule.subject, definition: rule.definition };
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sortByName(rules: BreachRuleDto[]): BreachRuleDto[] {
  return [...rules].sort((left, right) => left.name.localeCompare(right.name));
}

/** Rules, the selected draft and its results, with every action of the Breach page. */
export function useBreachRuleEditor(isAdmin: boolean) {
  const [rules, setRules] = useState<BreachRuleDto[]>([]);
  const [fields, setFields] = useState<DataModelFieldDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BreachRuleRequest | null>(null);
  const [issue, setIssue] = useState<DraftIssue | null>(null);
  const [result, setResult] = useState<BreachResultDto | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedRule = rules.find((rule) => rule.id === selectedId) ?? null;
  const isNew = selectedId === NEW_RULE_ID;
  const isDirty = draft !== null && isDraftDirty(draft, selectedRule ? toRequest(selectedRule) : null);

  const showRule = useCallback(async (rule: BreachRuleDto) => {
    setSelectedId(rule.id);
    setDraft(toRequest(rule));
    setIssue(null);
    setResult(null);
    setIsEvaluating(true);
    try {
      setResult(await evaluateBreachRule(rule.id));
    } catch (error) {
      setStatus({ isError: true, text: describeError(error, 'Unable to evaluate the rule.') });
    } finally {
      setIsEvaluating(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    Promise.all([listBreachRules(), getDataModelRequest()])
      .then(([loadedRules, model]) => {
        if (isCancelled) return;
        setRules(loadedRules);
        setFields(model.fields);
        if (loadedRules.length > 0) void showRule(loadedRules[0]);
      })
      .catch((error: unknown) => {
        if (!isCancelled) setLoadError(describeError(error, 'Unable to load the breach rules.'));
      });
    return () => {
      isCancelled = true;
    };
  }, [showRule]);

  function canLeaveDraft(): boolean {
    return !isAdmin || !isDirty || window.confirm('Discard the unsaved changes of this rule?');
  }

  function selectRule(rule: BreachRuleDto) {
    if (rule.id === selectedId || !canLeaveDraft()) return;
    setStatus(null);
    void showRule(rule);
  }

  function startNewRule() {
    if (!canLeaveDraft()) return;
    setStatus(null);
    setIssue(null);
    setSelectedId(NEW_RULE_ID);
    setDraft(newRuleDraft(FIRST_SUBJECT, fields));
    setResult(null);
  }

  function changeDraft(next: BreachRuleRequest) {
    setDraft(next);
    if (issue) setIssue(findDraftIssue(next));
  }

  async function saveAndEvaluate() {
    if (!draft) return;
    const found = findDraftIssue(draft);
    setIssue(found);
    if (found) return;
    setIsSaving(true);
    setStatus(null);
    try {
      const saved = await saveBreachRule(draft, selectedRule?.id ?? null);
      setRules((current) => sortByName([...current.filter((rule) => rule.id !== saved.id), saved]));
      setStatus({ isError: false, text: 'Rule saved.' });
      await showRule(saved);
    } catch (error) {
      setStatus({ isError: true, text: describeError(error, 'Unable to save the rule.') });
    } finally {
      setIsSaving(false);
    }
  }

  function clearSelection() {
    setSelectedId(null);
    setDraft(null);
    setResult(null);
  }

  async function removeRule() {
    if (!selectedRule) {
      clearSelection();
      return;
    }
    if (!window.confirm(`Delete rule "${selectedRule.name}"?`)) return;
    try {
      await deleteBreachRule(selectedRule.id);
      const remaining = rules.filter((rule) => rule.id !== selectedRule.id);
      setRules(remaining);
      setStatus({ isError: false, text: 'Rule deleted.' });
      if (remaining.length > 0) void showRule(remaining[0]);
      else clearSelection();
    } catch (error) {
      setStatus({ isError: true, text: describeError(error, 'Unable to delete the rule.') });
    }
  }

  return {
    rules,
    fields,
    selectedId,
    selectedRule,
    draft,
    issue,
    result,
    status,
    loadError,
    isNew,
    isDirty,
    isEvaluating,
    isSaving,
    selectRule,
    startNewRule,
    changeDraft,
    saveAndEvaluate,
    removeRule,
  };
}
