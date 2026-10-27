/**
 * Runnable self-check for chat answer indentation and citation placement.
 * Run: npx --yes tsx src/features/map/utils/chatAnswerLayout.check.ts
 */
import assert from 'node:assert/strict';
import type { ChatCitationDto } from '@/types/api';
import { layoutChatAnswer } from './chatAnswerLayout.ts';

const answer = `Connections of Datahub with Daily Frequency

Outbound Connections:
To pnl:
Data: PV
Data: Cashflow
To regulatory:
Data: Trade
Inbound Connections:
From booking:
Data: Cashflow
Data: Trade
To datahub:
Data: leftover`;

const citations: ChatCitationDto[] = [
  { type: 'EDGE', id: 'e1', label: 'datahub → pnl' },
  { type: 'EDGE', id: 'e2', label: 'datahub → pnl' },
  { type: 'EDGE', id: 'e3', label: 'datahub → regulatory' },
  { type: 'EDGE', id: 'e4', label: 'datahub → trading-pricing' },
  { type: 'EDGE', id: 'e5', label: 'booking → datahub' },
  { type: 'EDGE', id: 'e6', label: 'analytics → datahub' },
];

const lines = layoutChatAnswer(answer, citations);
const pnl = lines.find((line) => line.text === 'To pnl:');
const regulatory = lines.find((line) => line.text === 'To regulatory:');
const booking = lines.find((line) => line.text === 'From booking:');
const data = lines.find((line) => line.text === 'Data: PV');

assert.equal(pnl?.depth, 1);
assert.equal(data?.depth, 2);
assert.deepEqual(pnl?.citations.map((citation) => citation.id), ['e1', 'e2']);
assert.deepEqual(regulatory?.citations.map((citation) => citation.id), ['e3']);
assert.deepEqual(booking?.citations.map((citation) => citation.id), ['e5']);
const shown = lines.flatMap((line) => line.citations.map((citation) => citation.id));
assert.deepEqual(shown, ['e1', 'e2', 'e3', 'e5']);
assert.equal(shown.includes('e4'), false);
assert.equal(shown.includes('e6'), false);

console.log('chatAnswerLayout.check: ok');
