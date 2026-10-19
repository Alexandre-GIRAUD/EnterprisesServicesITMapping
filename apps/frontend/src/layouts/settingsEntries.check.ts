/**
 * Runnable self-check for who sees the admin entry in Settings.
 * Run: npx --yes tsx src/layouts/settingsEntries.check.ts
 */
import assert from 'node:assert/strict';
import { settingsMenuItems } from './settingsEntries.ts';

const adminItems = settingsMenuItems(true);
assert.deepEqual(adminItems, [{ label: 'Admin', to: '/admin/users' }]);

const userItems = settingsMenuItems(false);
assert.deepEqual(userItems, []);

console.log('settingsEntries.check: ok');
