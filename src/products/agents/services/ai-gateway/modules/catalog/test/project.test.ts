import type { Catalog } from '@mtsrc/ai-gateway-spec';
import { describe, expect, it } from 'vitest';
import { diffRows } from '../src/lib/diff';
import { pricingHash, projectCatalog } from '../src/lib/project';
import { stableStringify } from '../src/lib/stable';

let capabilities = {
  tools: true,
  toolChoice: null,
  structuredOutput: true,
  reasoning: null,
  temperature: true,
  promptCaching: null,
  attachments: false
};

let variant = {
  serving: null,
  reasoning: null,
  quantization: null,
  free: false,
  region: null
};

let pricing = {
  currency: 'USD' as const,
  text: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: [], reasoning: null },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
};

let organization = (id: string) => ({
  id,
  name: id,
  roles: ['lab' as const],
  aliases: [],
  description: null,
  website: null,
  logo: null,
  country: null,
  status: 'active' as const
});

let model = (id: string, labId: string) => ({
  id,
  labId,
  familyId: null,
  name: id,
  description: null,
  kind: 'chat' as const,
  version: null,
  versionSort: [],
  size: null,
  derivedFrom: null,
  status: 'active' as const,
  releaseDate: '2026-01-15',
  knowledgeCutoff: null,
  openWeights: false,
  license: null,
  links: [],
  modalities: { input: ['text' as const], output: ['text' as const] },
  capabilities,
  limits: { contextTokens: 200_000, inputTokens: null, outputTokens: 64_000 },
  releaseIds: [],
  latestReleaseId: null,
  offeringCount: 1,
  origin: 'lab-file' as const
});

let offering = (d: {
  vendorId: string;
  vendorModelId: string;
  modelId?: string | null;
  pointerId?: string | null;
  kind?: 'model' | 'pointer' | 'router';
}) => ({
  id: `${d.vendorId}:${d.vendorModelId}`,
  vendorId: d.vendorId,
  endpointIds: [],
  vendorModelId: d.vendorModelId,
  name: d.vendorModelId,
  kind: d.kind ?? ('model' as const),
  modelId: d.modelId ?? null,
  releaseId: null,
  pointerId: d.pointerId ?? null,
  variant,
  status: 'active' as const,
  pricing,
  limits: { contextTokens: null, inputTokens: 100_000, outputTokens: 8_000 },
  capabilities,
  modalities: { input: ['text' as const], output: ['text' as const] },
  apis: ['messages'],
  resolution: { method: 'first-party' as const, upstreamCanonicalId: null, overrideId: null },
  sources: [],
  firstSeenAt: '2026-01-01T00:00:00Z',
  lastSeenAt: '2026-01-01T00:00:00Z'
});

let vendor = (id: string) => ({
  id,
  organizationId: id,
  name: id.toUpperCase(),
  kind: 'first-party' as const,
  website: null,
  docs: null,
  logo: null,
  endpointIds: [],
  status: 'active' as const
});

let name = (d: {
  id: string;
  namespace: string;
  raw: string;
  target: Catalog['names'][number]['target'];
  status?: 'live' | 'gone';
}) =>
  ({
    id: d.id,
    namespace: d.namespace,
    raw: d.raw,
    key: d.raw.toLowerCase(),
    target: d.target,
    status: d.status ?? 'live'
  }) as unknown as Catalog['names'][number];

let catalog = {
  schemaVersion: 1,
  generatedAt: '2026-11-20T00:00:00Z',
  sources: [],
  organizations: [organization('anthropic'), organization('openai')],
  families: [],
  models: [
    model('anthropic/claude-sonnet-5', 'anthropic'),
    model('openai/gpt-6', 'openai'),
    model('orphan/model', 'missing-lab')
  ],
  releases: [],
  pointers: [
    {
      id: 'anthropic/claude-sonnet-latest',
      labId: 'anthropic',
      familyId: null,
      target: { kind: 'model', modelId: 'anthropic/claude-sonnet-5' },
      history: [],
      evidence: ''
    }
  ],
  vendors: [vendor('anthropic'), vendor('openai'), vendor('openrouter')],
  endpoints: [],
  offerings: [
    offering({
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-5',
      modelId: 'anthropic/claude-sonnet-5'
    }),
    offering({
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-latest',
      pointerId: 'anthropic/claude-sonnet-latest',
      kind: 'pointer'
    }),
    offering({ vendorId: 'openai', vendorModelId: 'auto', kind: 'router' }),
    offering({
      vendorId: 'openrouter',
      vendorModelId: 'openai/gpt-6',
      modelId: 'openai/gpt-6'
    })
  ],
  names: [
    name({
      id: 'n1',
      namespace: 'metorial',
      raw: 'anthropic/claude-sonnet-5',
      target: { kind: 'model', modelId: 'anthropic/claude-sonnet-5' }
    }),
    name({
      id: 'n2',
      namespace: 'metorial',
      raw: 'anthropic/claude-sonnet-latest',
      target: { kind: 'pointer', pointerId: 'anthropic/claude-sonnet-latest' }
    }),
    name({
      id: 'n3',
      namespace: 'display',
      raw: 'Claude Sonnet 5',
      target: { kind: 'model', modelId: 'anthropic/claude-sonnet-5' }
    }),
    name({
      id: 'n4',
      namespace: 'vendor:openrouter',
      raw: 'openai/gpt-6',
      target: { kind: 'model', modelId: 'openai/gpt-6' }
    }),
    name({
      id: 'n5',
      namespace: 'vendor:openai',
      raw: 'gpt-6-old',
      target: { kind: 'model', modelId: 'openai/gpt-6' },
      status: 'gone'
    }),
    name({ id: 'n6', namespace: 'metorial', raw: 'mystery', target: { kind: 'unresolved' } }),
    name({
      id: 'n7',
      namespace: 'vendor:some-reseller',
      raw: 'gpt6',
      target: { kind: 'model', modelId: 'openai/gpt-6' }
    })
  ],
  agents: []
} as unknown as Catalog;

describe('projectCatalog', () => {
  let projection = projectCatalog({
    catalog,
    supportedProviderSlugs: ['anthropic', 'openai']
  });

  it('always includes the metorial provider and only supported vendors', () => {
    expect(projection.providers.map(provider => provider.slug)).toEqual([
      'metorial',
      'anthropic',
      'openai'
    ]);
    expect(projection.providers[1]!.kind).toBe('first_party');
  });

  it('adds decision providers as their own kind, ahead of colliding vendors', () => {
    let withDecisions = projectCatalog({
      catalog,
      supportedProviderSlugs: ['anthropic', 'openai'],
      decisionProviders: [
        { slug: 'typesafe', name: 'TypeSafe', website: 'https://typesafe.ai' },
        { slug: 'openai', name: 'Not OpenAI' }
      ]
    });

    expect(
      withDecisions.providers.map(provider => [provider.slug, provider.kind, provider.name])
    ).toEqual([
      ['metorial', 'metorial', 'Metorial'],
      ['typesafe', 'decision', 'TypeSafe'],
      ['openai', 'decision', 'Not OpenAI'],
      ['anthropic', 'first_party', 'ANTHROPIC']
    ]);
  });

  it('drops models whose lab is missing and only keeps labs with models', () => {
    expect(projection.models.map(model => model.slug)).toEqual([
      'anthropic/claude-sonnet-5',
      'openai/gpt-6'
    ]);
    expect(projection.labs.map(lab => lab.slug)).toEqual(['anthropic', 'openai']);
  });

  it('stores release dates as UTC dates', () => {
    expect(projection.models[0]!.releaseDate?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('keeps offerings of supported providers, resolving pointers and skipping routers', () => {
    expect(
      projection.offerings.map(offering => [offering.catalogId, offering.modelSlug])
    ).toEqual([
      ['anthropic:claude-sonnet-5', 'anthropic/claude-sonnet-5'],
      ['anthropic:claude-sonnet-latest', 'anthropic/claude-sonnet-5']
    ]);
  });

  it('falls back to the input limit when an offering has no context limit', () => {
    expect(projection.offerings[0]!.contextTokens).toBe(100_000);
    expect(projection.models[0]!.contextTokens).toBe(200_000);
  });

  it('keeps live, resolvable aliases from callable namespaces only', () => {
    expect(projection.aliases.map(alias => [alias.raw, alias.modelSlug])).toEqual([
      ['anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-5'],
      ['anthropic/claude-sonnet-latest', 'anthropic/claude-sonnet-5'],
      ['openai/gpt-6', 'openai/gpt-6']
    ]);
  });
});

describe('pricingHash', () => {
  it('ignores key order and is null without pricing', () => {
    let reverseKeys = (value: object) => Object.fromEntries(Object.entries(value).reverse());
    let reordered = {
      ...reverseKeys(pricing),
      text: reverseKeys(pricing.text)
    } as typeof pricing;

    expect(pricingHash(reordered)).toBe(pricingHash(pricing));
    expect(pricingHash(null)).toBeNull();
  });
});

describe('stableStringify', () => {
  it('sorts nested object keys but keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}'
    );
  });
});

describe('diffRows', () => {
  type Row = { slug: string; name: string; meta: Record<string, number> };
  type Stored = Row & { removedAt: Date | null };

  let run = (desired: Row[], stored: Stored[]) =>
    diffRows({
      desired,
      stored,
      key: row => row.slug,
      storedKey: row => row.slug,
      storedRow: ({ removedAt: _, ...row }) => row
    });

  it('creates, updates, removes and leaves unchanged rows alone', () => {
    let diff = run(
      [
        { slug: 'same', name: 'Same', meta: { a: 1, b: 2 } },
        { slug: 'changed', name: 'New', meta: {} },
        { slug: 'new', name: 'New', meta: {} }
      ],
      [
        { slug: 'same', name: 'Same', meta: { b: 2, a: 1 }, removedAt: null },
        { slug: 'changed', name: 'Old', meta: {}, removedAt: null },
        { slug: 'gone', name: 'Gone', meta: {}, removedAt: null }
      ]
    );

    expect(diff.create.map(row => row.slug)).toEqual(['new']);
    expect(diff.update.map(({ row }) => row.slug)).toEqual(['changed']);
    expect(diff.remove.map(row => row.slug)).toEqual(['gone']);
    expect(diff.unchanged).toBe(1);
  });

  it('restores rows that come back after being removed', () => {
    let diff = run(
      [{ slug: 'back', name: 'Back', meta: {} }],
      [{ slug: 'back', name: 'Back', meta: {}, removedAt: new Date() }]
    );

    expect(diff.update).toHaveLength(1);
  });

  it('does not remove rows that are already removed', () => {
    let diff = run([], [{ slug: 'old', name: 'Old', meta: {}, removedAt: new Date() }]);

    expect(diff.remove).toHaveLength(0);
  });

  it('ignores duplicate desired keys', () => {
    let diff = run(
      [
        { slug: 'dup', name: 'One', meta: {} },
        { slug: 'dup', name: 'Two', meta: {} }
      ],
      []
    );

    expect(diff.create).toHaveLength(1);
  });
});
