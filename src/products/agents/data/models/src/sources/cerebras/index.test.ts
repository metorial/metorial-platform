import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseCerebras } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('cerebras pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseCerebras(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseCerebras({ wrong: true })).toThrow(ExtractionError);
  });
});

it('normalizes USD per token into USD per million tokens', async () => {
  expect(parseCerebras(await fixture()).data[0]?.rates).toMatchObject({
    input: 0.35,
    output: 0.75,
    cacheRead: null
  });
});
