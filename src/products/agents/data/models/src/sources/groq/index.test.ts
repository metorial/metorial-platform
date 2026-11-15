import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseGroq } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('groq pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseGroq(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseGroq({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves token and hourly audio billing units', async () => {
  let data = parseGroq(await fixture()).data;
  expect(data[0]).toMatchObject({ model: 'test-chat', rates: { input: 1, output: 2 } });
  expect(data[1]?.units?.[0]).toMatchObject({ unit: 'hour', price: 0.1 });
});
