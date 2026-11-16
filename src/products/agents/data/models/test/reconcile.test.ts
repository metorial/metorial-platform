import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog, emitCatalog } from '../src';
import {
  compileOverrides,
  parseDecision,
  readOverrideFiles,
  writeOverrideFiles,
  type OfferingDecision,
  type OverrideFiles
} from '../src/overrides';
import type { CatalogIssue } from '../src/pipeline/issues';
import { reviewDecisions } from '../src/reconcile/decisions';
import { huggingFaceRepo } from '../src/reconcile/evidence';
import { createWebSearch, searchQuery } from '../src/reconcile/webSearch';
import { fixturePath, now } from './helpers';

let newModelKey = 'openrouter/acme/brand-new-9';

let emptyFiles = (): OverrideFiles => ({
  merges: {},
  models: {},
  families: {},
  offerings: {}
});

let withDecision = (decision: OfferingDecision): OverrideFiles => ({
  ...emptyFiles(),
  offerings: { openrouter: { 'acme/brand-new-9': decision } }
});

let previousDir: string;
let root: string;

let build = (files: OverrideFiles, extra: { sourcesDir?: string } = {}) =>
  buildCatalog({
    modelsDevPath: fixturePath,
    previousDir,
    offline: true,
    now,
    overrides: compileOverrides(files),
    ...extra
  });

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'model-catalog-reconcile-'));
  previousDir = path.join(root, 'previous');

  await mkdir(path.join(previousDir, 'sources'), { recursive: true });
  await writeFile(
    path.join(previousDir, 'sources', 'openrouter.json'),
    JSON.stringify({
      data: [
        { id: 'acme/brand-new-9', name: 'Acme: Brand New 9', pricing: { prompt: '0.000001' } },
        { id: 'anthropic/claude-opus-4.5', pricing: { prompt: '0.000004' } }
      ]
    })
  );
});

describe('catalog issues', () => {
  it('raises an unlinked offering as an issue keyed like its override entry', async () => {
    let result = await build(emptyFiles());

    expect(result.issues.find(issue => issue.key === newModelKey)).toMatchObject({
      kind: 'unresolved-offering',
      vendorId: 'openrouter',
      vendorModelId: 'acme/brand-new-9'
    });
  });

  it('closes the issue with an exclude or an active defer', async () => {
    for (let decision of [
      { decision: 'exclude', category: 'test', reason: 'test' },
      { decision: 'defer', until: '2026-02-01', reason: 'test' }
    ] as OfferingDecision[]) {
      let result = await build(withDecision(decision));
      expect(result.issues.map(issue => issue.key)).not.toContain(newModelKey);
    }
  });

  it('raises the offering again once its deferral runs out', async () => {
    let result = await build(
      withDecision({ decision: 'defer', until: now.slice(0, 10), reason: 'test' })
    );

    expect(result.issues.map(issue => issue.key)).toContain(newModelKey);
  });

  it('turns a link to a vanished model into an issue instead of failing', async () => {
    let result = await build(
      withDecision({ decision: 'link', model: 'acme/gone', reason: 'test' })
    );

    expect(result.issues.find(issue => issue.key === newModelKey)?.kind).toBe(
      'stale-override'
    );
  });

  it('rebuilds from pinned snapshots with the original source states', async () => {
    let first = await build(emptyFiles());
    let pinnedDir = path.join(root, 'pinned');
    await emitCatalog(pinnedDir, first);

    let pinned = await build(emptyFiles(), { sourcesDir: pinnedDir });

    expect(pinned.catalog.sources).toEqual(first.catalog.sources);
    expect(pinned.catalog.offerings.map(offering => offering.id)).toEqual(
      first.catalog.offerings.map(offering => offering.id)
    );
    expect(JSON.parse(await readFile(path.join(pinnedDir, 'issues.json'), 'utf8'))).toEqual(
      first.issues
    );
  });
});

describe('override files', () => {
  it('round-trips through disk unchanged', async () => {
    let dir = path.join(root, 'overrides');
    let files: OverrideFiles = {
      merges: { 'acme/one': { from: ['acme/uno'], reason: 'same model', by: 'human' } },
      models: {},
      families: {},
      offerings: {
        openrouter: {
          'b/model': { decision: 'router', reason: 'routes' },
          'a/model': { decision: 'link', model: 'acme/one', reason: 'same', by: 'agent' }
        }
      }
    };

    await writeOverrideFiles(files, dir);
    let text = await readFile(path.join(dir, 'offerings', 'openrouter.json'), 'utf8');

    expect(await readOverrideFiles(dir)).toEqual(files);
    expect(text.indexOf('a/model')).toBeLessThan(text.indexOf('b/model'));
    expect(await readFile(path.join(dir, 'merges.json'), 'utf8')).toContain(
      '"from": ["acme/uno"]'
    );
  });

  it('removes vendor files that no longer hold decisions', async () => {
    let dir = path.join(root, 'pruned');
    await writeOverrideFiles(withDecision({ decision: 'router', reason: 'x' }), dir);
    await writeOverrideFiles(emptyFiles(), dir);

    expect((await readOverrideFiles(dir)).offerings).toEqual({});
  });

  it('names the allowed decisions when one is unknown', () => {
    expect(() => parseDecision({ decision: 'maybe', reason: 'x' }, 'x.json key')).toThrow(
      'x.json key: decision must be one of link, router, exclude, defer'
    );
  });
});

describe('reviewDecisions', () => {
  let batch = [
    { key: 'openrouter/a', vendorId: 'openrouter', vendorModelId: 'a' },
    { key: 'openrouter/b', vendorId: 'openrouter', vendorModelId: 'b' },
    { key: 'openrouter/c', vendorId: 'openrouter', vendorModelId: 'c' },
    { key: 'openrouter/d', vendorId: 'openrouter', vendorModelId: 'd' }
  ] as CatalogIssue[];

  let before: OverrideFiles = {
    ...emptyFiles(),
    offerings: { openrouter: { kept: { decision: 'router', reason: 'human', by: 'human' } } }
  };

  let review = (after: OverrideFiles) =>
    reviewDecisions({
      before,
      after,
      batch,
      modelIds: new Set(['acme/one']),
      today: '2026-01-01',
      secrets: ['super-secret-token']
    });

  it('keeps batch decisions, stamps them, and puts everything else back', () => {
    let result = review({
      ...emptyFiles(),
      merges: { 'acme/one': { from: ['acme/x'], reason: 'agent merge' } },
      offerings: {
        openrouter: {
          a: { decision: 'link', model: 'acme/one', reason: 'same', by: 'human' },
          outside: { decision: 'router', reason: 'not in batch' }
        }
      }
    });

    expect(result.accepted.map(entry => entry.key)).toEqual(['openrouter/a']);
    expect(result.files.offerings.openrouter).toEqual({
      kept: before.offerings.openrouter!.kept,
      a: { decision: 'link', model: 'acme/one', reason: 'same', by: 'agent', at: '2026-01-01' }
    });
    expect(result.files.merges).toEqual({});
    expect(result.reverted.sort()).toEqual([
      'merges.json',
      'openrouter/kept',
      'openrouter/outside'
    ]);
  });

  it('rejects invented models, out-of-range deferrals and leaked credentials', () => {
    let result = review({
      ...before,
      offerings: {
        openrouter: {
          ...before.offerings.openrouter,
          a: { decision: 'link', model: 'acme/invented', reason: 'guess' },
          b: { decision: 'defer', until: '2026-01-01', reason: 'today' },
          c: { decision: 'defer', until: '2026-03-01', reason: 'too far' },
          d: { decision: 'exclude', category: 'other', reason: 'super-secret-token' }
        }
      }
    });

    expect(result.accepted).toEqual([]);
    expect(result.rejected.map(entry => entry.key)).toEqual([
      'openrouter/a',
      'openrouter/b',
      'openrouter/c',
      'openrouter/d'
    ]);
    expect(result.rejected[0]!.reason).toContain('acme/invented does not exist');
    expect(result.files).toEqual(before);
  });
});

describe('huggingFaceRepo', () => {
  it('derives a repo from vendor ids that look like one', () => {
    expect(huggingFaceRepo('@cf/meta/llama-3.1-8b-instruct', null)).toBe(
      'meta/llama-3.1-8b-instruct'
    );
    expect(huggingFaceRepo('deepseek-ai/DeepSeek-V3.1:free', null)).toBe(
      'deepseek-ai/DeepSeek-V3.1'
    );
    expect(huggingFaceRepo('gpt-4o', null)).toBeNull();
    expect(huggingFaceRepo('x', 'org/listed')).toBe('org/listed');
  });
});

describe('web search', () => {
  let stubFetch = (respond: (call: number) => Response) => {
    let original = globalThis.fetch;
    let calls: { url: string; body: any }[] = [];

    globalThis.fetch = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return respond(calls.length);
    }) as unknown as typeof fetch;

    return { calls, restore: () => (globalThis.fetch = original) };
  };

  let options = { accountId: 'acct', apiToken: 'token', provider: 'linkup' as const };

  it('builds a query from the vendor id and name', () => {
    expect(searchQuery('@cf/acme/brand-new-9', 'Brand New 9')).toBe(
      'acme/brand-new-9 Brand New 9 AI model'
    );
    expect(searchQuery('gpt-x', 'GPT-X')).toBe('gpt-x AI model');
    expect(searchQuery('x', null)).toBe('x AI model');
  });

  it('returns trimmed results and answers repeated queries from memory', async () => {
    let stub = stubFetch(() =>
      Response.json({
        items: [
          { url: 'https://a.example', title: 'A', description: `${'word '.repeat(300)}` },
          { title: 'no url' }
        ]
      })
    );

    try {
      let search = createWebSearch(options);
      let first = await search('q');
      let second = await search('q');

      expect(first).toEqual(second);
      expect(first).toHaveLength(1);
      expect(first![0]!.snippet.length).toBeLessThanOrEqual(501);
      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0]!.body).toMatchObject({
        query: 'q',
        provider: 'linkup',
        options: { gateway: { id: 'default' } }
      });
      expect(search.stats.searches).toBe(1);
    } finally {
      stub.restore();
    }
  });

  it('stops for the run after a billing or auth error', async () => {
    let stub = stubFetch(() =>
      Response.json({ error: { code: 'web_search_payment_required' } }, { status: 402 })
    );

    try {
      let search = createWebSearch(options);

      expect(await search('a')).toBeNull();
      expect(await search('b')).toBeNull();
      expect(stub.calls).toHaveLength(1);
      expect(search.stats.stoppedBecause).toBe('HTTP 402 web_search_payment_required');
    } finally {
      stub.restore();
    }
  });

  it('retries a server error once and stops at the search limit', async () => {
    let stub = stubFetch(call =>
      call === 1 ? new Response('boom', { status: 502 }) : Response.json({ items: [] })
    );

    try {
      let search = createWebSearch({ ...options, maxSearches: 1 });

      expect(await search('a')).toEqual([]);
      expect(stub.calls).toHaveLength(2);
      expect(await search('b')).toBeNull();
      expect(search.stats.stoppedBecause).toBe('search limit of 1 reached');
    } finally {
      stub.restore();
    }
  });
});
