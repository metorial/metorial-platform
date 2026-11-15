import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseXai } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('xai pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseXai(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseXai({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  expect(parseXai(await fixture()).data[0]?.contextTiers?.[0]?.minInputTokens).toBe(200000);
});
