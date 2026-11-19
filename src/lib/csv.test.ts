import { expect, it } from 'vitest';
import { csvTextCell } from './csv';

it('keeps untrusted artifact fields literal in spreadsheet exports', () => {
  expect(csvTextCell('=HYPERLINK("https://example.invalid")')).toBe('"\'=HYPERLINK(""https://example.invalid"")"');
  expect(csvTextCell(' \t+1')).toBe('"\' \t+1"');
  expect(csvTextCell('Bronze "coin"')).toBe('"Bronze ""coin"""');
});
