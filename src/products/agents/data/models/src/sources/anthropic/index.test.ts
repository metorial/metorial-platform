import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseAnthropic } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('anthropic pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseAnthropic(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseAnthropic({ wrong: true })).toThrow(ExtractionError);
  });
});

it('reads Anthropic cache prices without applying the batch discount', async () => {
  let { data } = parseAnthropic(await fixture());
  expect(data).toHaveLength(2);
  expect(data[0]).toMatchObject({
    model: 'claude-opus-4.5',
    rates: {
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite: [
        { ttl: '5m', price: 6.25 },
        { ttl: '1h', price: 10 }
      ]
    }
  });
});

it('removes annotations and reads Anthropic prompt length tiers', () => {
  let { data } =
    parseAnthropic(`| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |
| --- | --- | --- | --- | --- | --- |
| Claude Test 1 ([limited availability](https://example.com)) (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok<sup>1</sup> | $0.50 / MTok |
| Claude Test 1 (for prompts over 100,000 tokens) | $0.50 / MTok | $0.625 / MTok | $1 / MTok | $0.05 / MTok | $2.50 / MTok |`);

  expect(data).toHaveLength(1);
  expect(data[0]).toMatchObject({
    model: 'claude-test-1',
    rates: { input: 0.1, cacheRead: 0.01 },
    contextTiers: [{ minInputTokens: 100001, input: 0.5, output: 2.5, cacheRead: 0.05 }]
  });
});

it('rejects invalid prices instead of silently interpreting them as free', async () => {
  let raw = await fixture();
  expect(() => parseAnthropic(raw.replace('$5 / MTok', '$-5 / MTok'))).toThrow(
    'unsupported token price'
  );
  expect(() => parseAnthropic(raw.replace('$5 / MTok', 'Contact sales'))).toThrow(
    'unsupported token price'
  );
});
