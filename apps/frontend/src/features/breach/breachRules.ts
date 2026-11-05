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
type AttributeOption = { key: string; label: string };

/** Where an editor problem shows: under the name, or under one condition. */
export type ConditionPosition = { groupIndex: number; conditionIndex: number };
export type DraftIssue = { message: string; at: 'name' | ConditionPosition };

const NUMBER_PATTERN = /^(-?\d+(?:[.,]\d+)?)([kKmM]?)$/;
const UNIT_FACTORS: Record<string, number> = { '': 1, k: 1_000, m: 1_000_000 };
const EXAMPLE_ATTRIBUTE = 'cost';
const EXAMPLE_THRESHOLD = '100k';
const EDGE_TARGET: DataModelFieldDto['target'] = 'EDGE';
const NODE_TARGET: DataModelFieldDto['target'] = 'NODE';
const PENDING_STATUS: ChangeDetectionItemDto['status'] = 'PENDING';
const MODULE_KIND: ChangeDetectionItemDto['kind'] = 'MODULE';

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
const VALUELESS_OPERATORS = new Set<BreachOperator>(['IS_EMPTY', 'IS_NOT_EMPTY']);

export const SUBJECT_LABELS: Record<BreachSubject, string> = { APPLICATION: 'Applications', FLOW: 'Flows' };
export const FIRST_SUBJECT: BreachSubject = 'APPLICATION';

/** Map filter selector meaning every rule; the server reads the same word. */
export const ANY_BREACH_RULE = 'any';
const FILTER_LABELS = { off: 'Off', anyRule: 'Any rule', oneRule: '1 rule' } as const;
const BREACH_HINT_PREFIX = 'In breach: ';

export function scopeOptions(subject: BreachSubject): Option<BreachScope>[] {
  return SCOPES[subject];
}

export function scopeLabel(scope: BreachScope): string {
  return [...SCOPES.APPLICATION, ...SCOPES.FLOW].find((option) => option.value === scope)?.label ?? scope;
}

export function isValueRequired(operator: BreachOperator): boolean {
  return !VALUELESS_OPERATORS.has(operator);
}

/** Mirrors the server: `120 000`, `120k`, `1,2M`. Null when the text is not a number. */
export function parseBreachNumber(raw: string): number | null {
  const match = NUMBER_PATTERN.exec(raw.replace(/\s/g, ''));
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount.replace(',', '.')) * UNIT_FACTORS[unit.toLowerCase()];
}

/** Flow scopes read EDGE attributes; application scopes read NODE and NODE_REF ones. */
export function attributeOptions(fields: DataModelFieldDto[], scope: BreachScope): AttributeOption[] {
  const isFlowScope = FLOW_SCOPES.has(scope);
  return fields
    .filter((field) => (field.target === EDGE_TARGET) === isFlowScope)
    .map((field) => ({ key: field.key, label: field.label || field.key }));
}

/** The brief's example (cost > 100k) when it fits, else the first plain attribute of the scope. */
export function emptyCondition(subject: BreachSubject, fields: DataModelFieldDto[]): BreachConditionDto {
  const scope = SCOPES[subject][0].value;
  const options = attributeOptions(fields, scope);
  const hasExample = subject === FIRST_SUBJECT && options.some((option) => option.key === EXAMPLE_ATTRIBUTE);
  if (hasExample) {
    return { scope, attribute: EXAMPLE_ATTRIBUTE, operator: 'GREATER_THAN', value: EXAMPLE_THRESHOLD };
  }
  const plainKeys = new Set(fields.filter((field) => field.target === NODE_TARGET).map((field) => field.key));
  const first = options.find((option) => plainKeys.has(option.key)) ?? options[0];
  return { scope, attribute: first?.key ?? '', operator: 'EQUALS', value: '' };
}

export function newRuleDraft(subject: BreachSubject, fields: DataModelFieldDto[]): BreachRuleRequest {
  return {
    name: '',
    subject,
    definition: { combinator: 'OR', groups: [{ combinator: 'AND', conditions: [emptyCondition(subject, fields)] }] },
  };
}

/** Keeps the conditions whose scope fits the new subject; an emptied rule restarts with one condition. */
export function changeSubject(
  draft: BreachRuleRequest,
  subject: BreachSubject,
  fields: DataModelFieldDto[]
): { draft: BreachRuleRequest; removed: number } {
  const allowed = new Set(SCOPES[subject].map((option) => option.value));
  const groups = draft.definition.groups
    .map((group) => ({ ...group, conditions: group.conditions.filter((condition) => allowed.has(condition.scope)) }))
    .filter((group) => group.conditions.length > 0);
  const countConditions = (rule: BreachRuleRequest['definition']['groups']) =>
    rule.reduce((count, group) => count + group.conditions.length, 0);
  const removed = countConditions(draft.definition.groups) - countConditions(groups);
  const nextGroups = groups.length > 0 ? groups : newRuleDraft(subject, fields).definition.groups;
  return { draft: { ...draft, subject, definition: { ...draft.definition, groups: nextGroups } }, removed };
}

function findConditionIssue(condition: BreachConditionDto): string | null {
  if (!condition.attribute) return 'Pick an attribute.';
  if (!isValueRequired(condition.operator)) return null;
  const label = `The condition on "${condition.attribute}"`;
  if (!condition.value.trim()) return `${label} needs a value.`;
  const isNumberExpected = NUMERIC_OPERATORS.has(condition.operator);
  if (isNumberExpected && parseBreachNumber(condition.value) === null) {
    return `${label} needs a number, like ${EXAMPLE_THRESHOLD}.`;
  }
  return null;
}

/** The first problem the server would refuse, and where to show it; null when the draft can be saved. */
export function findDraftIssue(draft: BreachRuleRequest): DraftIssue | null {
  if (!draft.name.trim()) return { message: 'Give the rule a name.', at: 'name' };
  for (const [groupIndex, group] of draft.definition.groups.entries()) {
    for (const [conditionIndex, condition] of group.conditions.entries()) {
      const message = findConditionIssue(condition);
      if (message) return { message, at: { groupIndex, conditionIndex } };
    }
  }
  return null;
}

export function isDraftDirty(draft: BreachRuleRequest, saved: BreachRuleRequest | null): boolean {
  if (!saved) return true;
  const serialize = (rule: BreachRuleRequest) =>
    JSON.stringify({ name: rule.name, subject: rule.subject, definition: rule.definition });
  return serialize(draft) !== serialize(saved);
}

/** "Any rule" and single rules exclude each other. */
export function toggleBreachSelector(selected: string[], selector: string): string[] {
  if (selected.includes(selector)) return selected.filter((value) => value !== selector);
  if (selector === ANY_BREACH_RULE) return [ANY_BREACH_RULE];
  return [...selected.filter((value) => value !== ANY_BREACH_RULE), selector];
}

/** Drops selected rules that no longer exist, so a hidden stale selection cannot empty the map. */
export function pruneBreachSelection(selected: string[], rules: { id: string }[]): string[] {
  return selected.filter(
    (selector) => rules.length > 0 && (selector === ANY_BREACH_RULE || rules.some((rule) => rule.id === selector))
  );
}

export function breachFilterLabel(selected: string[], rules: { id: string; name: string }[]): string {
  if (selected.length === 0) return FILTER_LABELS.off;
  if (selected.includes(ANY_BREACH_RULE)) return FILTER_LABELS.anyRule;
  if (selected.length === 1) return rules.find((rule) => rule.id === selected[0])?.name ?? FILTER_LABELS.oneRule;
  return `${selected.length} rules`;
}

/** The hint shown on a flagged box or flow. */
export function describeBreachRules(ruleNames: string[]): string {
  return `${BREACH_HINT_PREFIX}${ruleNames.join(', ')}`;
}

/** Accepting a pending attribute or flow can change breaches; a module never does. */
export function canHaveBreachImpact(item: Pick<ChangeDetectionItemDto, 'kind' | 'status'>): boolean {
  return item.status === PENDING_STATUS && item.kind !== MODULE_KIND;
}

export function elementTitle(element: BreachElementDto): string {
  if (element.source && element.target) return `${element.source.label} → ${element.target.label}`;
  return element.label;
}
