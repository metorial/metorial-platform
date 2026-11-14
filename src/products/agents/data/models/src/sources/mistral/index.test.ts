import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseMistral } from './index';

let today = '2026-11-13T12:00:00.000Z';
let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('mistral pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseMistral(raw, '2026-11-13T12:00:00.000Z');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseMistral({ wrong: true })).toThrow(ExtractionError);
  });
});

it('extracts Mistral token and duration prices and detects missing child documents', async () => {
  let raw = (await fixture()) as { index: string; pages: unknown[] };
  let result = parseMistral(raw, today);
  expect(result.data[0]?.rates).toMatchObject({ input: 1, output: 2, cacheRead: 0.1 });
  expect(result.data[1]?.units?.[0]).toMatchObject({ unit: 'minute', price: 0.003 });
  expect(() => parseMistral({ ...raw, pages: raw.pages.slice(0, 1) }, today)).toThrow(
    'model page missing'
  );
});
