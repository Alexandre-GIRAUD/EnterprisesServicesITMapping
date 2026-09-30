/**
 * Runnable self-check for table file export.
 * Run: npx --yes tsx src/features/map/utils/tableFile.check.ts
 */
import assert from 'node:assert/strict';
import { tableToCsv, tableToExcelXml } from './tableFile.ts';

const headers = ['Name', 'Note'];
const rows = [['Acme', 'say "hi", there'], ['North', 'a&b']];

assert.equal(
  tableToCsv(headers, rows),
  '\uFEFFName,Note\r\nAcme,"say ""hi"", there"\r\nNorth,a&b',
);

const excel = tableToExcelXml(headers, rows);
assert.equal(excel.includes('say &quot;hi&quot;, there'), true);
assert.equal(excel.includes('a&amp;b'), true);
assert.equal(excel.includes('<Cell><Data ss:Type="String">Name</Data></Cell>'), true);

console.log('tableFile.check: ok');
