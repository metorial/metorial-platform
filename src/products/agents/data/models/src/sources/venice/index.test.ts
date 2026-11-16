import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseVenice } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.json'), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('venice pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(
      path.join(import.meta.dirname, 'fixtures/response.json'),
      'utf8'
    );
    let raw: unknown = JSON.parse(text);
    let result = parseVenice(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseVenice({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  expect(parseVenice(await fixture()).data[0]?.rates).toMatchObject({
    input: 1,
    output: 2,
    cacheRead: 0.1
  });
});
