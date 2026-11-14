import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergePublishedPrices } from '../src/pipeline/pricing';
import { loadAnthropic, parseAnthropic } from '../src/sources/anthropic';
import { loadOpenAi, parseOpenAi } from '../src/sources/openai';
import { buildFixture, now } from './helpers';

let fixture = (kind: string) =>
  readFile(
    path.join(import.meta.dirname, '..', 'src', 'sources', kind, 'fixtures', 'response.md'),
    'utf8'
  );

afterEach(() => vi.restoreAllMocks());

describe('official pricing sources', () => {
  it.each([parseOpenAi, parseAnthropic])(
    'rejects non-documents and changed page layouts',
    parse => {
      expect(() => parse({ data: [] })).toThrow();
      expect(() => parse('<html>Access denied</html>')).toThrow('no supported pricing rows');
    }
  );

  it.each([
    ['openai', loadOpenAi],
    ['anthropic', loadAnthropic]
  ] as const)(
    'fetches %s and aborts invalid extraction and falls back on network failure',
    async (kind, load) => {
      let raw = await fixture(kind);
      let previousDir = await mkdtemp(path.join(os.tmpdir(), 'catalog-pricing-'));
      let fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(raw));

      try {
        let options = { now, offline: false, previousDir };
        let fresh = await load(options);
        expect(fresh.meta.status).toBe('fresh');
        expect(fresh.raw).toBe(raw);
        expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^https:\/\//);

        await mkdir(path.join(previousDir, 'sources'));
        await writeFile(
          path.join(previousDir, 'sources', `${kind}.json`),
          JSON.stringify(fresh.raw)
        );
        fetchMock.mockResolvedValue(new Response('changed layout'));

        await expect(load(options)).rejects.toThrow('extraction aborted');
        fetchMock.mockRejectedValue(new Error('network unavailable'));

        let fallback = await load(options);
        expect(fallback.meta).toMatchObject({
          status: 'fallback',
          error: 'network unavailable'
        });
        expect(fallback.data).toEqual(fresh.data);

        let pinned = await load({
          ...options,
          pinned: { dir: previousDir, meta: new Map([[kind, fresh.meta]]) }
        });
        expect(pinned.data).toEqual(fresh.data);
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } finally {
        await rm(previousDir, { recursive: true, force: true });
      }
    }
  );
});

describe('official pricing merge', () => {
  it('updates cache-only changes, preserves unknown prices, and leaves inventory intact', async () => {
    let { offerings } = await buildFixture();
    let offering = offerings.get('anthropic:claude-opus-4-5-20251101')!;
    offering.pricing!.text!.cacheRead = 99;
    offering.pricing!.webSearchPer1k = 10;
    let before = offerings.size;
    let stats = mergePublishedPrices({
      source: 'anthropic',
      prices: parseAnthropic(await fixture('anthropic')).data,
      offerings
    });

    expect(offering.pricing?.text?.cacheRead).toBe(0.5);
    expect(offering.pricing?.webSearchPer1k).toBe(10);
    expect(stats.priceChanges.map(change => change.offeringId)).toContain(offering.id);
    expect(stats.delisted).toEqual([]);
    expect(offerings.size).toBe(before);
    expect(offerings.get('anthropic:claude-opus-4-1')?.status).toBe('active');
  });

  it('matches OpenAI API IDs without assigning current alias prices to older snapshots', async () => {
    let { offerings } = await buildFixture();
    let snapshot = offerings.get('openai:gpt-4o-2024-08-06')!;
    let alias = { ...structuredClone(snapshot), id: 'openai:gpt-4o', vendorModelId: 'gpt-4o' };
    let variant = {
      ...structuredClone(alias),
      id: 'openai:gpt-4o:batch',
      variant: { ...alias.variant, serving: 'batch' }
    };
    offerings.set(alias.id, alias);
    offerings.set(variant.id, variant);

    let stats = mergePublishedPrices({
      source: 'openai',
      prices: parseOpenAi(await fixture('openai')).data,
      offerings
    });
    expect(stats.matched).toBe(1);
    expect(alias.pricing?.text?.cacheRead).toBe(1.25);
    expect(snapshot.sources).not.toContain('openai');
    expect(variant.sources).not.toContain('openai');
  });
});
