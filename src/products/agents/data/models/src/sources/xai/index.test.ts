import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractionError } from '../../lib/extraction';
import { parseXai } from './index';

let fixture = async (name = 'response') =>
  readFile(path.join(import.meta.dirname, 'fixtures', `${name}.md`), 'utf8');

describe('xai pricing', () => {
  it('extracts the US regional endpoint rates the pricing page still publishes', async () => {
    let result = parseXai(await fixture());
    expect(result.data).toHaveLength(1);
    let price = result.data[0]!;
    expect(price.model).toBe('grok-4.7');
    expect(price.modality).toBe('text');
    expect(price.endpoint).toBe('us');
    expect(price.rates).toMatchObject({ input: 2.2, output: 6.6, cacheRead: 0.55 });
    expect(price.contextTiers).toEqual([
      { minInputTokens: 200001, input: 4.4, output: 13.2, cacheRead: 1.1 }
    ]);
  });

  it('reports the missing model table and the non-public fast variant as known exclusions', async () => {
    let { issues } = parseXai(await fixture());
    expect(issues).toContain(
      'xai: model pricing table unavailable on the pricing page; per-model details are published on the models page'
    );
    expect(issues).toContain(
      'xai: Grok 4.7 Fast pricing is excluded (Cursor and Grok Build only, not available on the public xAI API)'
    );
  });

  it('keeps extracting the standard model pricing table when the page publishes it', async () => {
    let result = parseXai(await fixture('legacy'));
    let standard = result.data.find(price => price.model === 'test-chat');
    expect(standard?.endpoint).toBeUndefined();
    expect(standard?.rates).toMatchObject({ input: 1, output: 2, cacheRead: 0.1 });
    expect(standard?.contextTiers?.[0]?.minInputTokens).toBe(200000);
    let regional = result.data.find(price => price.model === 'grok-4.7');
    expect(regional?.endpoint).toBe('us');
    expect(regional?.rates.input).toBe(2.2);
  });

  it('aborts when the response shape changes or no published rates remain', () => {
    expect(() => parseXai({ wrong: true })).toThrow(ExtractionError);
    expect(() => parseXai('# Pricing\n\nNo published rates.')).toThrow('no supported pricing rows');
  });

  it('aborts on a per-model rate table that is not marked as a non-public variant', () => {
    let raw = [
      '# Pricing',
      '',
      '## Public fast pricing',
      '',
      '| Prompt tokens | Input | Cached input | Output |',
      '|---|---|---|---|',
      '| Below 200k | $4.00 / 1M | $1.00 / 1M | $12.00 / 1M |'
    ].join('\n');
    expect(() => parseXai(raw)).toThrow('unsupported per-model rate table');
  });
});
