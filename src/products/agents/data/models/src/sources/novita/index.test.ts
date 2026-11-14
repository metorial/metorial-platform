import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseNovita } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('novita pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseNovita(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseNovita({ wrong: true })).toThrow(ExtractionError);
  });
});

it('extracts the selected Novita price and its context tiers', async () => {
  let price = parseNovita(await fixture()).data[0]!;
  expect(price.rates.input).toBe(0.3);
  expect(price.contextTiers).toEqual([
    { minInputTokens: 100, input: 0.6, output: 2.4, cacheRead: null }
  ]);
});
