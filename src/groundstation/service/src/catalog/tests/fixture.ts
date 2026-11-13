import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import type {
  Catalog,
  Name,
  NameTarget,
  Offering,
  Pricing,
  TargetPeriod
} from '@metorial/model-catalog/src/types';

export let pointerSwitch = '2025-09-29T00:00:00.000Z';

let period = (target: NameTarget, from: string, to: string | null): TargetPeriod => ({
  target,
  from,
  to,
  evidence: 'fixture'
});

let name = (d: {
  namespace: string;
  raw: string;
  target: NameTarget;
  history?: TargetPeriod[];
}) =>
  ({
    id: `${d.namespace}:${d.raw}`,
    namespace: d.namespace,
    raw: d.raw,
    key: normalizeKey(d.raw),
    target: d.target,
    history: d.history ?? [],
    origin: 'observed',
    status: 'live'
  }) as unknown as Name;

let pricing = (
  text: Partial<NonNullable<Pricing['text']>>,
  tiers: Pricing['contextTiers'] = []
) =>
  ({
    currency: 'USD',
    text: {
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: [],
      reasoning: null,
      ...text
    },
    image: null,
    audio: null,
    video: null,
    contextTiers: tiers,
    units: [],
    webSearchPer1k: null
  }) satisfies Pricing;

let offering = (d: {
  id: string;
  vendorId: string;
  vendorModelId: string;
  modelId: string;
  releaseId?: string;
  pricing: Pricing;
  serving?: string;
}) =>
  ({
    id: d.id,
    vendorId: d.vendorId,
    vendorModelId: d.vendorModelId,
    kind: 'model',
    modelId: d.modelId,
    releaseId: d.releaseId ?? null,
    pointerId: null,
    variant: {
      serving: d.serving ?? null,
      reasoning: null,
      quantization: null,
      free: false,
      region: null
    },
    status: 'active',
    pricing: d.pricing
  }) as unknown as Offering;

let sonnet45 = { kind: 'model', modelId: 'claude-sonnet-4-5' } as const;
let sonnet4 = { kind: 'model', modelId: 'claude-sonnet-4' } as const;

export let sonnetPricing = pricing(
  {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: [
      { ttl: '5m', price: 3.75 },
      { ttl: '1h', price: 6 }
    ]
  },
  [{ minInputTokens: 200_000, input: 6, output: 22.5, cacheRead: 0.6 }]
);

export let fixtureCatalog = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  sources: [],
  organizations: [],
  families: [
    {
      id: 'claude-sonnet',
      labId: 'anthropic',
      modelIds: ['claude-sonnet-4', 'claude-sonnet-4-5'],
      latestModelId: 'claude-sonnet-4-5'
    }
  ],
  models: [
    {
      id: 'claude-sonnet-4-5',
      labId: 'anthropic',
      familyId: 'claude-sonnet',
      status: 'active'
    },
    {
      id: 'claude-sonnet-4',
      labId: 'anthropic',
      familyId: 'claude-sonnet',
      status: 'deprecated'
    },
    { id: 'gpt-5', labId: 'openai', familyId: null, status: 'active' }
  ],
  releases: [],
  pointers: [
    {
      id: 'claude-sonnet-latest',
      labId: 'anthropic',
      familyId: null,
      target: sonnet45,
      history: [
        period(sonnet4, '2025-05-22T00:00:00.000Z', pointerSwitch),
        period(sonnet45, pointerSwitch, null)
      ],
      evidence: 'fixture'
    }
  ],
  vendors: [
    { id: 'anthropic', organizationId: 'anthropic', kind: 'first-party' },
    { id: 'aws-bedrock', organizationId: 'amazon', kind: 'cloud' },
    { id: 'openai', organizationId: 'openai', kind: 'first-party' },
    { id: 'github-copilot', organizationId: 'github', kind: 'subscription' }
  ],
  endpoints: [
    {
      id: 'aws-bedrock/default',
      vendorId: 'aws-bedrock',
      baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
      upstreamIds: ['amazon-bedrock']
    }
  ],
  offerings: [
    offering({
      id: 'anthropic:claude-sonnet-4-5',
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-4-5-20250929',
      modelId: 'claude-sonnet-4-5',
      pricing: sonnetPricing
    }),
    offering({
      id: 'anthropic:claude-sonnet-4-5:priority',
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-4-5-priority',
      modelId: 'claude-sonnet-4-5',
      serving: 'priority',
      pricing: pricing({ input: 9, output: 45 })
    }),
    offering({
      id: 'aws-bedrock:claude-sonnet-4-5',
      vendorId: 'aws-bedrock',
      vendorModelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      modelId: 'claude-sonnet-4-5',
      pricing: pricing({ input: 3.3, output: 16.5, cacheRead: 0.33 })
    }),
    offering({
      id: 'github-copilot:claude-sonnet-4-5',
      vendorId: 'github-copilot',
      vendorModelId: 'claude-sonnet-4.5',
      modelId: 'claude-sonnet-4-5',
      pricing: pricing({ input: 1, output: 1 })
    }),
    offering({
      id: 'anthropic:claude-sonnet-4',
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-4-20250514',
      modelId: 'claude-sonnet-4',
      pricing: pricing({ input: 3, output: 15 })
    }),
    offering({
      id: 'openai:gpt-5',
      vendorId: 'openai',
      vendorModelId: 'gpt-5',
      modelId: 'gpt-5',
      pricing: pricing({ input: 1.25, output: 10, cacheRead: 0.125 })
    })
  ],
  names: [
    name({
      namespace: 'vendor:anthropic',
      raw: 'claude-sonnet-4-5-20250929',
      target: sonnet45
    }),
    name({
      namespace: 'vendor:openai',
      raw: 'gpt-5',
      target: { kind: 'model', modelId: 'gpt-5' }
    }),
    name({
      namespace: 'display',
      raw: 'Claude Sonnet Latest',
      target: { kind: 'pointer', pointerId: 'claude-sonnet-latest' }
    }),
    name({ namespace: 'sdk:a', raw: 'sonnet', target: sonnet45 }),
    name({ namespace: 'sdk:b', raw: 'sonnet', target: sonnet4 })
  ],
  agents: [
    {
      id: 'claude-code',
      makerId: 'anthropic',
      aliases: ['claude_code'],
      vendors: [
        { vendorId: 'anthropic', role: 'default' },
        { vendorId: 'aws-bedrock', role: 'supported' }
      ]
    },
    {
      id: 'github-copilot',
      makerId: 'github',
      aliases: ['copilot-cli'],
      vendors: [{ vendorId: 'github-copilot', role: 'subscription' }]
    }
  ]
} as unknown as Catalog;
