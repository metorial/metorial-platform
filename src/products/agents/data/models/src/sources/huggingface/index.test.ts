import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseHuggingFace } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('huggingface pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseHuggingFace(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseHuggingFace({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  let data = parseHuggingFace(await fixture()).data;
  expect(data.find(p => p.model === 'test/chat')?.rates.input).toBeNull();
  expect(data.find(p => p.model === 'test/chat')?.conditions?.map(c => c.rates.input)).toEqual(
    [1, 3]
  );
});
