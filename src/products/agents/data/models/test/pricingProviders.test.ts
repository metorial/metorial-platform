import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { extractData, ExtractionError } from '../src/lib/extraction';
import { loadSource } from '../src/sources/fetch';
import { loadPricingSources, pricingSources } from '../src/sources/providers';

import { publishedRates, requirePrices } from '../src/sources/pricing';
import { readPricingFixture } from './helpers';

let parseJsonPricing = (kind: string, raw: unknown) =>
  pricingSources.find(source => source.kind === kind)!.parse(raw, '2026-11-13T12:00:00.000Z');

let parseDocumentPricing = parseJsonPricing;

let today = '2026-11-13T12:00:00.000Z';
let previousDir: string;

beforeAll(async () => {
  previousDir = await mkdtemp(path.join(os.tmpdir(), 'catalog-provider-prices-'));
  await mkdir(path.join(previousDir, 'sources'));
  for (let { kind } of pricingSources)
    await writeFile(
      path.join(previousDir, 'sources', `${kind}.json`),
      JSON.stringify(await readPricingFixture(kind))
    );
});

afterAll(() => rm(previousDir, { recursive: true, force: true }));

describe('unified extraction', () => {
  it('collects row failures and aborts without returning partial data', () => {
    expect(() =>
      extractData('test', d => {
        d.add('valid');
        d.row('broken', () => {
          throw new Error('bad price');
        });
        d.flag('missing column');
      })
    ).toThrow('test: extraction aborted: broken: bad price; missing column');
  });

  it('supports explicit aborts and reports known exclusions', () => {
    expect(() => extractData('test', d => d.abort('layout changed'))).toThrow(ExtractionError);
    expect(() => extractData('test', () => {})).toThrow('no supported pricing rows');
    expect(
      extractData('test', d => {
        d.skip('negotiated price');
        d.add('valid');
      })
    ).toEqual({ data: ['valid'], issues: ['test: negotiated price'] });
  });

  it('rejects conflicting duplicates and invalid rates', () => {
    let price = {
      model: 'test',
      modality: 'text' as const,
      rates: publishedRates({ input: 1, output: 2, cacheRead: null }),
      contextTiers: null
    };
    expect(requirePrices([price, price], 'test').data).toHaveLength(1);
    expect(() =>
      requirePrices([price, { ...price, rates: { ...price.rates, input: 2 } }], 'test')
    ).toThrow('conflicting duplicate');
    for (let input of [-1, NaN, Infinity])
      expect(() =>
        requirePrices([{ ...price, rates: { ...price.rates, input } }], 'test')
      ).toThrow(ExtractionError);
  });

  it('rejects invalid unit prices and unordered context tiers', () => {
    let price = {
      model: 'test',
      modality: 'text' as const,
      rates: publishedRates({ input: 1, output: 2, cacheRead: null }),
      contextTiers: null
    };
    expect(() =>
      requirePrices(
        [
          {
            ...price,
            units: [{ modality: 'audio', direction: 'input', unit: 'second', price: -1 }]
          }
        ],
        'test'
      )
    ).toThrow(ExtractionError);
    expect(() =>
      requirePrices(
        [
          {
            ...price,
            contextTiers: [200, 100].map(minInputTokens => ({
              minInputTokens,
              input: 2,
              output: 4,
              cacheRead: null
            }))
          }
        ],
        'test'
      )
    ).toThrow('invalid context threshold');
    expect(() =>
      requirePrices(
        [{ ...price, rates: publishedRates({ input: null, output: null, cacheRead: null }) }],
        'test'
      )
    ).toThrow('no billable rates');
  });
});

describe.each(pricingSources)('$kind extraction', source => {
  it('extracts and validates a representative public response', async () => {
    let raw = await readPricingFixture(source.kind);
    let { data } = source.parse(raw, today);
    expect(data.length).toBeGreaterThan(0);
    expect(
      data.every(
        price =>
          price.model &&
          [price.rates.input, price.rates.output, price.rates.cacheRead].every(
            rate => rate === null || (Number.isFinite(rate) && rate >= 0)
          )
      )
    ).toBe(true);
  });

  it('aborts on an invalid document instead of producing an empty success', () => {
    expect(() => source.parse({ wrong: true }, today)).toThrow(ExtractionError);
  });

  it('does not hide extraction failures behind a previous snapshot', async () => {
    await expect(
      loadSource({
        kind: source.kind,
        ref: source.ref,
        offline: false,
        previousDir,
        now: today,
        fetch: async () => ({ wrong: true }),
        parse: raw => source.parse(raw, today)
      })
    ).rejects.toThrow(ExtractionError);
  });
});

it('loads and pins every source without network access', async () => {
  let spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must stay offline'));
  try {
    let results = await loadPricingSources({ offline: true, previousDir, now: today });
    expect(
      results.every(result => result.meta.status === 'fallback' && result.data?.length)
    ).toBe(true);
    let pinned = await loadPricingSources({
      offline: false,
      previousDir: null,
      now: today,
      pinned: {
        dir: previousDir,
        meta: new Map(results.map(result => [result.meta.kind, result.meta]))
      }
    });
    expect(pinned).toEqual(results);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
