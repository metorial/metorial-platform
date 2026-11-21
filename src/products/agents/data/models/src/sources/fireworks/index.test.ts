import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseFireworks } from './index';

let readFixture = async (name: string) =>
  readFile(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

let fixture = async () => readFixture('response.md');

describe('fireworks pricing', () => {
  it('extracts its public response fixture', async () => {
    let raw: unknown = await readFixture('response.md');
    let result = parseFireworks(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('replays the published serverless pricing page without duplicate-price conflicts', async () => {
    let raw: unknown = await readFixture('response-serverless-pricing.md');
    let result = parseFireworks(raw);
    let flash1017 = result.data.filter(
      price => price.model === 'accounts/fireworks/models/deepseek-v4p1-flash-1017'
    );
    expect(flash1017.map(price => [price.serving ?? 'standard', price.rates.input])).toEqual([
      ['standard', 0.3],
      ['priority', 0.375]
    ]);
    expect(result.issues).toContain(
      'fireworks DeepSeek V4.1 Flash 1017 Flex: separate regional/speed/flex variant'
    );
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseFireworks({ wrong: true })).toThrow(ExtractionError);
  });

  it('skips same-id mode variants instead of emitting conflicting duplicates', async () => {
    let result = parseFireworks(await fixture());
    // Fast, Ultra-fast, Flex, and (US) reuse the base model id; only the base
    // row's Standard and Priority rates may become prices for that id.
    expect(result.data.map(price => [price.model, price.serving ?? 'standard'])).toEqual([
      ['accounts/fireworks/models/test-chat', 'standard'],
      ['accounts/fireworks/models/test-chat', 'priority']
    ]);
    expect(result.issues).toContain(
      'fireworks Test Chat Flex: separate regional/speed/flex variant'
    );
    expect(result.issues).toContain(
      'fireworks Test Chat Fast: separate regional/speed/flex variant'
    );
    expect(result.issues).toContain(
      'fireworks Test Chat Ultra-fast (Preview): separate regional/speed/flex variant'
    );
    expect(result.issues).toContain(
      'fireworks Test Chat (US): separate regional/speed/flex variant'
    );
  });
});

it('preserves the published billing rates and scope', async () => {
  expect(
    parseFireworks(await fixture()).data.map(p => [p.serving ?? 'standard', p.rates.input])
  ).toEqual([
    ['standard', 1],
    ['priority', 2]
  ]);
});
