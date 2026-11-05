/**
 * Runnable self-check for the Breach rule draft helpers.
 * Run: npx --yes tsx src/features/breach/breachRules.check.ts
 */
import assert from 'node:assert/strict';
import type { BreachRuleRequest, DataModelFieldDto } from '@/types/api';
import {
  ANY_BREACH_RULE,
  attributeOptions,
  breachFilterLabel,
  canHaveBreachImpact,
  changeSubject,
  describeBreachRules,
  toggleBreachSelector,
  findDraftIssue,
  elementTitle,
  isDraftDirty,
  newRuleDraft,
  parseBreachNumber,
  scopeOptions,
} from './breachRules.ts';

function field(key: string, target: DataModelFieldDto['target']): DataModelFieldDto {
  return { key, label: key.toUpperCase(), enforceEnum: false, required: false, target };
}

const fields = [field('owner', 'NODE'), field('cost', 'NODE'), field('domain', 'NODE_REF'), field('protocol', 'EDGE')];

// Numbers people type, the same way the server reads them.
assert.equal(parseBreachNumber('120 000'), 120000);
assert.equal(parseBreachNumber('120k'), 120000);
assert.equal(parseBreachNumber('1,2M'), 1200000);
assert.equal(parseBreachNumber('high'), null);
assert.equal(parseBreachNumber(''), null);

// Scopes depend on the subject; attributes on the scope.
assert.deepEqual(
  scopeOptions('APPLICATION').map((option) => option.value),
  ['SELF', 'ANY_FLOW_IN', 'ANY_FLOW_OUT', 'ANY_FLOW']
);
assert.deepEqual(
  scopeOptions('FLOW').map((option) => option.value),
  ['FLOW', 'SOURCE', 'TARGET', 'SOURCE_OR_TARGET']
);
assert.deepEqual(
  attributeOptions(fields, 'SELF').map((option) => option.key),
  ['owner', 'cost', 'domain']
);
assert.deepEqual(
  attributeOptions(fields, 'ANY_FLOW_OUT').map((option) => option.key),
  ['protocol']
);

// The first draft is the example of the brief when a cost attribute exists.
const first = newRuleDraft('APPLICATION', fields);
assert.deepEqual(first.definition.groups[0].conditions[0], {
  scope: 'SELF',
  attribute: 'cost',
  operator: 'GREATER_THAN',
  value: '100k',
});
const flowDraft = newRuleDraft('FLOW', fields);
assert.equal(flowDraft.definition.groups[0].conditions[0].scope, 'FLOW');
assert.equal(flowDraft.definition.groups[0].conditions[0].attribute, 'protocol');

// Switching the subject drops the conditions that no longer fit, and counts them.
const mixed: BreachRuleRequest = {
  name: 'Mixed',
  subject: 'FLOW',
  definition: {
    combinator: 'OR',
    groups: [
      {
        combinator: 'AND',
        conditions: [
          { scope: 'FLOW', attribute: 'protocol', operator: 'EQUALS', value: 'FTP' },
          { scope: 'SOURCE', attribute: 'cost', operator: 'GREATER_THAN', value: '1' },
        ],
      },
      { combinator: 'AND', conditions: [{ scope: 'TARGET', attribute: 'cost', operator: 'IS_EMPTY', value: '' }] },
    ],
  },
};
const switched = changeSubject(mixed, 'APPLICATION', fields);
assert.equal(switched.removed, 3);
assert.equal(switched.draft.subject, 'APPLICATION');
assert.equal(switched.draft.definition.groups.length, 1);
assert.equal(switched.draft.definition.groups[0].conditions[0].scope, 'SELF');

// Without a cost attribute, the first draft reads the first plain application attribute.
const noCost = [field('domain', 'NODE_REF'), field('owner', 'NODE')];
assert.equal(newRuleDraft('APPLICATION', noCost).definition.groups[0].conditions[0].attribute, 'owner');

// Client hints mirror the server checks and say where the problem is.
assert.deepEqual(findDraftIssue({ ...first, name: ' ' }), { message: 'Give the rule a name.', at: 'name' });
const noValue = structuredClone(first);
noValue.name = 'Expensive';
noValue.definition.groups[0].conditions[0].value = '';
assert.deepEqual(findDraftIssue(noValue), {
  message: 'The condition on "cost" needs a value.',
  at: { groupIndex: 0, conditionIndex: 0 },
});
const notNumber = structuredClone(noValue);
notNumber.definition.groups[0].conditions[0].value = 'a lot';
assert.equal(findDraftIssue(notNumber)?.message, 'The condition on "cost" needs a number, like 100k.');
const emptyOperator = structuredClone(noValue);
emptyOperator.definition.groups[0].conditions[0].operator = 'IS_EMPTY';
assert.equal(findDraftIssue(emptyOperator), null);

// One wording for every "in breach" hint on the map.
assert.equal(describeBreachRules(['Over budget', 'No owner']), 'In breach: Over budget, No owner');

// Dirty tracking compares content, not identity.
assert.equal(isDraftDirty(structuredClone(first), first), false);
assert.equal(isDraftDirty({ ...first, name: 'Other' }, first), true);
assert.equal(isDraftDirty(first, null), true);

// Flows read source → target.
assert.equal(
  elementTitle({
    kind: 'FLOW',
    id: 'e',
    label: 'a → b',
    source: { id: 'a', label: 'Billing' },
    target: { id: 'b', label: 'CRM' },
    values: [],
  }),
  'Billing → CRM'
);
assert.equal(elementTitle({ kind: 'APPLICATION', id: 'a', label: 'Billing', values: [] }), 'Billing');

// Map filter: "any rule" and single rules exclude each other; the row says what is on.
const ruleNames = [
  { id: 'r1', name: 'Over budget' },
  { id: 'r2', name: 'FTP flows' },
];
assert.deepEqual(toggleBreachSelector([], ANY_BREACH_RULE), [ANY_BREACH_RULE]);
assert.deepEqual(toggleBreachSelector([ANY_BREACH_RULE], 'r1'), ['r1']);
assert.deepEqual(toggleBreachSelector(['r1'], ANY_BREACH_RULE), [ANY_BREACH_RULE]);
assert.deepEqual(toggleBreachSelector(['r1', 'r2'], 'r1'), ['r2']);
assert.equal(breachFilterLabel([], ruleNames), 'Off');
assert.equal(breachFilterLabel([ANY_BREACH_RULE], ruleNames), 'Any rule');
assert.equal(breachFilterLabel(['r2'], ruleNames), 'FTP flows');
assert.equal(breachFilterLabel(['r1', 'r2'], ruleNames), '2 rules');

// A Change shows its breach impact only while an attribute or a flow is still pending.
assert.equal(canHaveBreachImpact({ kind: 'NODE_ATTRIBUTE', status: 'PENDING' }), true);
assert.equal(canHaveBreachImpact({ kind: 'CONNECTION', status: 'PENDING' }), true);
assert.equal(canHaveBreachImpact({ kind: 'MODULE', status: 'PENDING' }), false);
assert.equal(canHaveBreachImpact({ kind: 'CONNECTION', status: 'ACCEPTED' }), false);

console.log('breachRules.check.ts passed');
