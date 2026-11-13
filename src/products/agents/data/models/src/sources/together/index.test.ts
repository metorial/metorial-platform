import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseTogether } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('together pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseTogether(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseTogether({ wrong: true })).toThrow(ExtractionError);
  });
});

it('extracts input, output and cache rates', async () => {
  expect(parseTogether(await fixture()).data[0]?.rates).toMatchObject({
    input: 1,
    output: 2,
    cacheRead: 0.1
  });
});
