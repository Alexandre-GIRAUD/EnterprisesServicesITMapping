/**
 * Flow creation tells the user the two application names, not ids or relation types.
 * Run: npx --yes tsx src/features/map/utils/flowCreationMessage.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createdFlowMessage, flowCreationErrorMessage } from './flowCreationMessage.ts';

assert.equal(
  createdFlowMessage('Billing', 'Ledger', false),
  'The flow between Billing and Ledger has been created.',
);
assert.equal(
  createdFlowMessage('Billing', 'Ledger', true),
  'The flow between Billing and Ledger has been added. It is not saved yet.',
);

assert.equal(
  flowCreationErrorMessage(
    'Create edge API 409 Conflict: {"message":"Une relation identique existe deja."}',
  ),
  'A flow between these applications already exists.',
);
assert.equal(
  flowCreationErrorMessage(
    '{"message":"Source application introuvable: 5540a295-7d5b-44b2-ac24-af0e1887033c"}',
  ),
  'One of the applications could not be found.',
);
assert.equal(flowCreationErrorMessage(''), 'Unable to create the flow.');

const drawer = readFileSync(new URL('../components/WorkspaceDrawer.tsx', import.meta.url), 'utf8');
assert.match(drawer, /createdFlowMessage\(sourceName, targetName, sandboxMode\)/);
assert.doesNotMatch(drawer, /created\.sourceId/);
assert.match(drawer, /Choose two different applications\./);

console.log('flowCreationMessage.check: ok');
