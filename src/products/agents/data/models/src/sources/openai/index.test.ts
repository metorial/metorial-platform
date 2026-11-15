import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseOpenAi } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('openai pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseOpenAi(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseOpenAi({ wrong: true })).toThrow(ExtractionError);
  });
});

it('selects standard OpenAI rates and separates modalities', async () => {
  let { data } = parseOpenAi(await fixture());
  expect(data).toHaveLength(4);
  expect(data.find(price => price.model === 'gpt-4o')?.rates).toMatchObject({
    input: 2.5,
    output: 10,
    cacheRead: 1.25
  });
  expect(data.find(price => price.model === 'gpt-5-pro')?.rates.cacheRead).toBeNull();
  expect(
    data
      .filter(price => price.model === 'gpt-image-2')
      .map(price => [price.modality, price.rates.input])
  ).toEqual([
    ['image', 8],
    ['text', 5]
  ]);
});

it('reads OpenAI cache writes and the published long context boundary', () => {
  let { data } = parseOpenAi(`### Standard pricing data
| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| test-model (<100K context length) | $2 | $10 | $0.10 | $2.50 | $5 | $4 | $15 | $0.20 |
Long context: >100K input tokens.`);

  expect(data[0]).toMatchObject({
    model: 'test-model',
    rates: {
      cacheWrite: [
        { ttl: '30m', price: 2.5 },
        { ttl: '12h', price: 5 }
      ]
    },
    contextTiers: [{ minInputTokens: 100001, input: 4, output: 15, cacheRead: 0.2 }]
  });
});
