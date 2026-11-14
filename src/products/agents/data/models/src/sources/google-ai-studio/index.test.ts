import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseGoogle } from './index';

let today = '2026-11-13T12:00:00.000Z';
let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('google-ai-studio pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseGoogle(raw, '2026-11-13T12:00:00.000Z');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseGoogle({ wrong: true })).toThrow(ExtractionError);
  });
});

it('selects Google paid Standard prices by date and retains cache storage units', async () => {
  let raw = await fixture();
  let price = parseGoogle(raw, today).data[0]!;
  expect(price.rates).toMatchObject({ input: 1, output: 2, cacheRead: 0.1 });
  expect(price.validUntil).toBe('2026-11-30');
  expect(price.units).toEqual([
    { modality: 'text', direction: 'input', unit: 'token-hour', price: 0.000001 }
  ]);
  expect(parseGoogle(raw, '2026-12-01T00:00:00.000Z').data[0]?.rates).toMatchObject({
    input: 2,
    output: 4,
    cacheRead: 0.2
  });
  expect(() =>
    parseGoogle(
      (raw as string).replace(/\$[\d.]+ starting December 1, 2026\./g, ''),
      '2026-12-01T00:00:00.000Z'
    )
  ).toThrow('no currently applicable');
});

it('keeps Google modality prices separate and respects exclusive context thresholds', async () => {
  let raw = (await fixture()) as string;
  let replace = (input: string, output: string, cache: string) =>
    raw
      .replace(/\$1 through November 30, 2026\.\n\$2 starting December 1, 2026\./, input)
      .replace(/\$2 through November 30, 2026\.\n\$4 starting December 1, 2026\./, output)
      .replace(/\$0.1 through November 30, 2026\.\n\$0.2 starting December 1, 2026\./, cache);
  let modalities = parseGoogle(
    replace(
      '$1 (text / image / video)\n$3 (audio)',
      '$2 (text)\n$12 (audio)',
      '$0.1 (text / image / video)\n$0.3 (audio)'
    ),
    today
  ).data;
  expect(modalities.find(price => price.modality === 'audio')?.rates).toMatchObject({
    input: 3,
    output: 12,
    cacheRead: 0.3
  });
  expect(modalities.find(price => price.modality === 'text')?.rates).toMatchObject({
    input: 1,
    output: 2,
    cacheRead: 0.1
  });

  let contextual = parseGoogle(
    replace(
      '$1, prompts <= 200,000 tokens\n$2, prompts > 200,000 tokens',
      '$2, prompts <= 200k tokens\n$4, prompts > 200k',
      '$0.1, prompts <= 200k tokens\n$0.2, prompts > 200k'
    ),
    today
  ).data[0]!;
  expect(contextual.contextTiers).toEqual([
    { minInputTokens: 200001, input: 2, output: 4, cacheRead: 0.2 }
  ]);
  expect(() => parseGoogle(replace('$1 per request', '$2', '$0.1'), today)).toThrow(
    'unrecognized billing unit'
  );
});
