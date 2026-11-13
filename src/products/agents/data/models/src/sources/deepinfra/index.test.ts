import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseDeepInfra } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('deepinfra pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseDeepInfra(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseDeepInfra({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  let data = parseDeepInfra(await fixture()).data;
  expect(data[0]?.rates).toMatchObject({ input: 1, output: 2, cacheRead: 0.1 });
  expect(data[1]?.units?.[0]?.price).toBe(0.00001);
});
