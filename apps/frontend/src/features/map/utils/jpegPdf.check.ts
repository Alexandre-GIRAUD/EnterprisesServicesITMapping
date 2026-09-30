/**
 * Runnable self-check for wrapping a JPEG in a one-page PDF.
 * Run: npx --yes tsx src/features/map/utils/jpegPdf.check.ts
 */
import assert from 'node:assert/strict';
import { jpegToPdf } from './jpegPdf.ts';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const pdf = jpegToPdf(jpeg, 10, 20);
const text = new TextDecoder().decode(pdf);

assert.ok(text.startsWith('%PDF-1.3'));
assert.ok(text.includes('/MediaBox [0 0 10 20]'));
assert.ok(text.includes('%%EOF'));
assert.ok(pdf[0] === 0x25);
const jpegStart = pdf.indexOf(0xff);
assert.ok(jpegStart >= 0 && pdf[jpegStart + 1] === 0xd8);

console.log('jpegPdf.check: ok');
