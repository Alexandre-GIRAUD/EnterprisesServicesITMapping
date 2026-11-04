import type {
  BreachConditionDto,
  BreachElementDto,
  BreachOperator,
  BreachRuleRequest,
  BreachScope,
  BreachSubject,
  ChangeDetectionItemDto,
  DataModelFieldDto,
} from '@/types/api';

type Option<T extends string> = { value: T; label: string };
export type AttributeOption = { key: string; label: string };

const NUMBER_PATTERN = /^(-?\d+(?:[.,]\d+)?)([kKmM]?)$/;
const UNIT_FACTORS: Record<string, number> = { '': 1, k: 1_000, m: 1_000_000 };
const EXAMPLE_ATTRIBUTE = 'cost';
const EXAMPLE_THRESHOLD = '100k';

const SCOPES: Record<BreachSubject, Option<BreachScope>[]> = {
  APPLICATION: [
    { value: 'SELF', label: 'Application' },
    { value: 'ANY_FLOW_IN', label: 'Any incoming flow' },
    { value: 'ANY_FLOW_OUT', label: 'Any outgoing flow' },
    { value: 'ANY_FLOW', label: 'Any flow' },
  ],
  FLOW: [
    { value: 'FLOW', label: 'Flow' },
    { value: 'SOURCE', label: 'Source' },
    { value: 'TARGET', label: 'Target' },
    { value: 'SOURCE_OR_TARGET', label: 'Source or target' },
  ],
};

const FLOW_SCOPES = new Set<BreachScope>(['ANY_FLOW_IN', 'ANY_FLOW_OUT', 'ANY_FLOW', 'FLOW']);

export const OPERATOR_OPTIONS: Option<BreachOperator>[] = [
  { value: 'EQUALS', label: '=' },
  { value: 'NOT_EQUALS', label: '≠' },
  { value: 'GREATER_THAN', label: '>' },
  { value: 'GREATER_OR_EQUAL', label: '≥' },
  { value: 'LESS_THAN', label: '<' },
  { value: 'LESS_OR_EQUAL', label: '≤' },
  { value: 'CONTAINS', label: 'contains' },
  { value: 'IS_EMPTY', label: 'is empty' },
  { value: 'IS_NOT_EMPTY', label: 'is not empty' },
];

const NUMERIC_OPERATORS = new Set<BreachOperator>(['GREATER_THAN', 'GREATER_OR_EQUAL', 'LESS_THAN', 'LESS_OR_EQUAL']);

export const SUBJECT_LABELS: Record<BreachSubject, string> = { APPLICATION: 'Applications', FLOW: 'Flows' };

export function scopeOptions(subject: BreachSubject): Option<BreachScope>[] {
  return SCOPES[subject];
}

export function scopeLabel(scope: BreachScope): string {
  return [...SCOPES.APPLICATION, ...SCOPES.FLOW].find((option) => option.value === scope)?.label ?? scope;
}

export function needsValue(operator: BreachOperator): boolean {
  return operator !== 'IS_EMPTY' && operator !== 'IS_NOT_EMPTY';
}

/** Mirrors the server: `120 000`, `120k`, `1,2M`. Null when the text is not a number. */
export function parseBreachNumber(raw: string): number | null {
  const match = NUMBER_PATTERN.exec(raw.replace(/\s/g, ''));
  if (!match) return null;
  return Number(match[1].replace(',', '.')) * UNIT_FACTORS[match[2].toLowerCase()];
}

/** Flow scopes read EDGE attributes; application scopes read NODE and NODE_REF ones. */
export function attributeOptions(fields: DataModelFieldDto[], scope: BreachScope): AttributeOption[] {
  const readsFlow = FLOW_SCOPES.has(scope);
  return fields
    .filter((field) => (field.target === 'EDGE') === readsFlow)
    .map((field) => ({ key: field.key, label: field.label || field.key }));
}

export function emptyCondition(subject: BreachSubject, fields: DataModelFieldDto[]): BreachConditionDto {
  const scope = SCOPES[subject][0].value;
  const options = attributeOptions(fields, scope);
  const example = subject === 'APPLICATION' ? options.find((option) => option.key === EXAMPLE_ATTRIBUTE) : undefined;
  if (example) {
    return { scope, attribute: example.key, operator: 'GREATER_THAN', value: EXAMPLE_THRESHOLD };
  }
  return { scope, attribute: options[0]?.key ?? '', operator: 'EQUALS', value: '' };
}

export function newRuleDraft(subject: BreachSubject, fields: DataModelFieldDto[]): BreachRuleRequest {
  return {
    name: '',
    subject,
    definition: {
      combinator: 'OR',
      groups: [{ combinator: 'AND', conditions: [emptyCondition(subject, fields)] }],
    },
  };
}

/** Keeps the conditions whose scope fits the new subject; an emptied rule restarts with one condition. */
export function changeSubject(
  draft: BreachRuleRequest,
  subject: BreachSubject,
  fields: DataModelFieldDto[]
): { draft: BreachRuleRequest; removed: number } {
  const allowed = new Set(SCOPES[subject].map((option) => option.value));
  let removed = 0;
  const groups = draft.definition.groups
    .map((group) => {
      const conditions = group.conditions.filter((condition) => allowed.has(condition.scope));
      removed += group.conditions.length - conditions.length;
      return { ...group, conditions };
    })
    .filter((group) => group.conditions.length > 0);
  const definition =
    groups.length > 0
      ? { ...draft.definition, groups }
      : { ...draft.definition, groups: [{ combinator: 'AND' as const, conditions: [emptyCondition(subject, fields)] }] };
  return { draft: { ...draft, subject, definition }, removed };
}

/** The first problem the server would refuse, phrased for the editor; null when the draft can be saved. */
export function draftIssue(draft: BreachRuleRequest): string | null {
  if (!draft.name.trim()) return 'Give the rule a name.';
  for (const group of draft.definition.groups) {
    for (const condition of group.conditions) {
      if (!condition.attribute) return 'Pick an attribute for every condition.';
      if (!needsValue(condition.operator)) continue;
      const label = `The condition on "${condition.attribute}"`;
      if (!condition.value.trim()) return `${label} needs a value.`;
      if (NUMERIC_OPERATORS.has(condition.operator) && parseBreachNumber(condition.value) === null) {
        return `${label} needs a number, like 100k.`;
      }
    }
  }
  return null;
}

export function isDraftDirty(draft: BreachRuleRequest, saved: BreachRuleRequest | null): boolean {
  if (!saved) return true;
  const comparable = (rule: BreachRuleRequest) =>
    JSON.stringify({ name: rule.name, subject: rule.subject, definition: rule.definition });
  return comparable(draft) !== comparable(saved);
}

/** Map filter selector meaning every rule; the server reads the same word. */
export const ANY_BREACH_RULE = 'any';

/** "Any rule" and single rules exclude each other. */
export function toggleBreachSelector(selected: string[], selector: string): string[] {
  if (selected.includes(selector)) return selected.filter((value) => value !== selector);
  if (selector === ANY_BREACH_RULE) return [ANY_BREACH_RULE];
  return [...selected.filter((value) => value !== ANY_BREACH_RULE), selector];
}

export function breachFilterLabel(selected: string[], rules: { id: string; name: string }[]): string {
  if (selected.length === 0) return 'Off';
  if (selected.includes(ANY_BREACH_RULE)) return 'Any rule';
  if (selected.length === 1) return rules.find((rule) => rule.id === selected[0])?.name ?? '1 rule';
  return `${selected.length} rules`;
}

/** Accepting a pending attribute or flow can change breaches; a module never does. */
export function canHaveBreachImpact(item: Pick<ChangeDetectionItemDto, 'kind' | 'status'>): boolean {
  return item.status === 'PENDING' && item.kind !== 'MODULE';
}

export function elementTitle(element: BreachElementDto): string {
  if (element.kind === 'FLOW') return `${element.sourceLabel ?? element.sourceId} → ${element.targetLabel ?? element.targetId}`;
  return element.label;
}
