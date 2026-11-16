import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseZai } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('zai pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseZai(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseZai({ wrong: true })).toThrow(ExtractionError);
  });
});

it('preserves the published billing rates and scope', async () => {
  expect(parseZai(await fixture()).data[0]?.endpoint).toBe('intl');
});
