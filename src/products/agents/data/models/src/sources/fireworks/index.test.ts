import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseFireworks } from './index';

let fixture = async () => {
  let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
  return text;
};

describe('fireworks pricing', () => {
  it('extracts its public response fixture', async () => {
    let text = await readFile(path.join(import.meta.dirname, 'fixtures/response.md'), 'utf8');
    let raw: unknown = text;
    let result = parseFireworks(raw);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('aborts when the response shape changes', () => {
    expect(() => parseFireworks({ wrong: true })).toThrow(ExtractionError);
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
