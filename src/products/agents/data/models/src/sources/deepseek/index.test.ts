import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseDeepSeek } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('deepseek pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseDeepSeek(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseDeepSeek({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves both time-based prices and their scheduling policy', async () => {
  let price = parseDeepSeek(await fixture()).data[0]!;
  expect(price.rates.input).toBeNull();
  expect(
    price.conditions?.map(c => [c.label, c.rates.input, c.rates.output, c.rates.cacheRead])
  ).toEqual([
    ['PEAK', 1, 2, 0.1],
    ['OFF-PEAK', 0.5, 1, 0.05]
  ]);
  expect(price.conditions?.[0]?.description).toContain('excluding public holidays');
});
