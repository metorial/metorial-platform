import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildCatalog,
  createNameLookup,
  emitCatalog,
  type Agent,
  type BuildResult,
  type Catalog
} from '../src';
import { evaluateDeployGate } from '../src/pipeline/gate';
import { buildSite } from '../src/publish/site';
import { fixturePath, noOverrides, now } from './helpers';

let snapshots = {
  openrouter: {
    data: [
      {
        id: 'anthropic/claude-opus-4.5',
        pricing: { prompt: '0.000004', completion: '0.000025' }
      },
      {
        id: 'google/gemini-2.5-pro',
        name: 'Google: Gemini 2.5 Pro',
        pricing: { prompt: '0.00000125' }
      },
      { id: 'anthropic/claude-4-sonnet', hugging_face_id: null },
      { id: 'openrouter/auto' }
    ]
  },
  'ai-gateway': {
    data: [{ id: 'openai/gpt-4o', pricing: { input: '0.0000025', output: '0.00001' } }]
  },
  litellm: {
    sample_spec: {},
    'claude-opus-4-5-20251101': { litellm_provider: 'anthropic', mode: 'chat' },
    'bedrock/us-east-1/anthropic.claude-sonnet-4-5-20250929-v1:0': {
      litellm_provider: 'bedrock',
      mode: 'chat'
    }
  },
  'ai-sdk': {
    packages: [
      {
        name: '@ai-sdk/anthropic',
        version: '1.0.0',
        modelIds: ['claude-opus-4-5', 'claude-3-5-haiku-latest']
      }
    ]
  }
};

let previousDir: string;
let outDir: string;
let result: BuildResult;
let emitted: Catalog;

beforeAll(async () => {
  let root = await mkdtemp(path.join(os.tmpdir(), 'model-catalog-'));
  previousDir = path.join(root, 'previous');
  outDir = path.join(root, 'out');

  await mkdir(path.join(previousDir, 'sources'), { recursive: true });
  for (let [kind, raw] of Object.entries(snapshots))
    await writeFile(path.join(previousDir, 'sources', `${kind}.json`), JSON.stringify(raw));

  result = await buildCatalog({
    modelsDevPath: fixturePath,
    previousDir,
    offline: true,
    now,
    overrides: noOverrides
  });
  await emitCatalog(outDir, result);
  emitted = JSON.parse(await readFile(path.join(outDir, 'catalog.json'), 'utf8'));
});

let offering = (id: string) => result.catalog.offerings.find(candidate => candidate.id === id);

describe('buildCatalog', () => {
  it('falls back to stored source snapshots when offline', () => {
    expect(result.catalog.sources.map(source => [source.kind, source.status])).toEqual([
      ['models.dev', 'fresh'],
      ['openrouter', 'fallback'],
      ['ai-gateway', 'fallback'],
      ['litellm', 'fallback'],
      ['ai-sdk', 'fallback']
    ]);
  });

  it('produces a valid catalog', () => {
    expect(result.validation.errors).toEqual([]);
  });

  it('lets a vendor listing update prices, add offerings and delist the rest', () => {
    expect(offering('openrouter:anthropic/claude-opus-4.5')?.pricing?.text?.input).toBe(4);
    expect(offering('openrouter:google/gemini-2.5-pro')).toMatchObject({
      modelId: 'google/gemini-2.5-pro',
      status: 'active',
      sources: ['openrouter']
    });
    expect(offering('openrouter:google/gemini-2.5-flash')?.status).toBe('retired');
    expect(result.merges.find(merge => merge.source === 'openrouter')).toMatchObject({
      matched: 3,
      added: 1
    });
  });

  it('counts offerings per model', () => {
    let opus = result.catalog.models.find(model => model.id === 'anthropic/claude-opus-4.5');
    expect(opus?.offeringCount).toBe(2);
  });

  it('records names from every namespace', () => {
    let lookup = createNameLookup(result.catalog);

    expect(lookup('anthropic/claude-opus-4.5', 'metorial')).toEqual({
      kind: 'model',
      modelId: 'anthropic/claude-opus-4.5'
    });
    expect(lookup('claude-opus-4-5', 'sdk:@ai-sdk/anthropic')).toEqual({
      kind: 'model',
      modelId: 'anthropic/claude-opus-4.5'
    });
    expect(
      lookup('bedrock/us-east-1/anthropic.claude-sonnet-4-5-20250929-v1:0', 'catalog:litellm')
    ).toMatchObject({
      kind: 'release',
      modelId: 'anthropic/claude-sonnet-4.5'
    });
    expect(lookup('Claude Opus 4.5', 'display')).toMatchObject({
      modelId: 'anthropic/claude-opus-4.5'
    });
    expect(lookup('claude-3-5-haiku-latest')).toEqual({
      kind: 'pointer',
      pointerId: 'anthropic/claude-3.5-haiku-latest'
    });
  });

  it('rejects overrides that point at unknown models', async () => {
    let overrides = {
      ...noOverrides,
      merges: [{ into: 'acme/missing', from: ['acme/other'], reason: 'test' }]
    };

    await expect(
      buildCatalog({
        modelsDevPath: fixturePath,
        previousDir: null,
        offline: true,
        now,
        overrides
      })
    ).rejects.toThrow('overrides reference unknown models: acme/missing');
  });

  it('sorts every entity list by id', () => {
    for (let list of [
      result.catalog.models,
      result.catalog.offerings,
      result.catalog.names,
      result.catalog.agents
    ]) {
      let ids = list.map(item => item.id);
      expect(ids).toEqual([...ids].sort());
    }
  });
});

describe('emitCatalog', () => {
  it('writes the catalog, per-entity files, report and source snapshots', () => {
    expect(emitted.models.length).toBe(result.catalog.models.length);

    for (let file of [
      'models/anthropic/claude-opus-4.5.json',
      'families/anthropic/claude-opus.json',
      'vendors/openrouter.json',
      'organizations/anthropic.json',
      'names.json',
      'agents.json',
      'agents/claude-code.json',
      'unresolved.json',
      'report.md',
      'sources/openrouter.json'
    ])
      expect(existsSync(path.join(outDir, file)), file).toBe(true);
  });

  it('writes agents with their maker and vendors expanded', async () => {
    let agents: Agent[] = JSON.parse(await readFile(path.join(outDir, 'agents.json'), 'utf8'));
    let claudeCode = JSON.parse(
      await readFile(path.join(outDir, 'agents', 'claude-code.json'), 'utf8')
    );

    expect(agents.map(agent => agent.id)).toEqual(
      result.catalog.agents.map(agent => agent.id)
    );
    expect(emitted.agents).toEqual(result.catalog.agents);
    expect(claudeCode).toMatchObject({
      id: 'claude-code',
      maker: { id: 'anthropic', roles: expect.arrayContaining(['agent-maker', 'lab']) },
      vendors: [
        { vendorId: 'anthropic', role: 'default', vendor: { id: 'anthropic' } },
        { vendorId: 'aws-bedrock', role: 'supported', vendor: { id: 'aws-bedrock' } }
      ]
    });
  });

  it('publishes agents on the site', async () => {
    let siteDir = path.join(path.dirname(outDir), 'site');
    await mkdir(path.join(outDir, 'logos'), { recursive: true });
    await buildSite({
      outDir,
      siteDir,
      assetsDir: path.join(import.meta.dirname, '..', 'site-assets'),
      now
    });

    expect(existsSync(path.join(siteDir, 'agents.json'))).toBe(true);
    expect(existsSync(path.join(siteDir, 'agents', 'codex.json'))).toBe(true);
  });

  it('carries ids and first-seen times into the next build', async () => {
    let later = '2026-01-01T01:00:00.000Z';
    let next = await buildCatalog({
      modelsDevPath: fixturePath,
      previousDir: outDir,
      offline: true,
      now: later,
      overrides: noOverrides
    });

    expect(next.diff.hasPrevious).toBe(true);
    expect(next.diff.newModels).toEqual([]);
    expect(
      next.catalog.offerings.find(item => item.id === 'anthropic:claude-opus-4-1')?.firstSeenAt
    ).toBe(now);
    expect(next.newPriceOutliers).toEqual([]);
    expect(evaluateDeployGate(next, { allowUnsafe: false })).toMatchObject({
      passed: true,
      deploy: true
    });
  });

  it('puts the deploy gate in the report', async () => {
    let gatedDir = path.join(path.dirname(outDir), 'gated');
    await emitCatalog(gatedDir, result, evaluateDeployGate(result, { allowUnsafe: true }));

    let report = await readFile(path.join(gatedDir, 'report.md'), 'utf8');

    expect(report).toContain('## Deploy gate');
    expect(report).toContain('`allow-unsafe` is set; the catalog may deploy');
    expect(report).toContain(
      '| Previous catalog | missing | not in the Actions cache or on the live site | required | fail (overridden by allow-unsafe) |'
    );
    expect(report).toContain(
      '| Priced offerings with changed text rates | n/a | nothing to compare with | at most 10.0% | pass |'
    );
  });
});
