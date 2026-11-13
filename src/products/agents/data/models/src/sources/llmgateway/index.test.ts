import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseLlmGateway } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('llmgateway pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseLlmGateway(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseLlmGateway({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  let price = parseLlmGateway(await fixture()).data[0]!;
  expect(price.rates.input).toBe(1);
  expect(price.contextTiers?.[0]).toMatchObject({ minInputTokens: 101, input: 2, output: 4 });
});
