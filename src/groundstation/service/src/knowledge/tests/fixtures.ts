import type {
  Agent,
  Catalog,
  Endpoint,
  Model,
  Name,
  NameTarget,
  Offering,
  Organization,
  Pointer,
  Pricing,
  Release,
  TargetPeriod,
  Vendor
} from '@metorial/model-catalog/src/types';
import {
  buildEntityRows,
  emptyStoredState,
  vendorModelKey,
  type StoredRow,
  type StoredState
} from '../rows';

export let seenAt = '2025-01-01T00:00:00.000Z';

let oidCounter = 0n;

let nextOid = () => ++oidCounter;

export let pricing = (input: number, output = input * 5) =>
  ({
    currency: 'USD',
    text: { input, output, cacheRead: null, cacheWrite: [], reasoning: null },
    image: null,
    audio: null,
    video: null,
    contextTiers: [],
    units: [],
    webSearchPer1k: null
  }) satisfies Pricing;

export let modelTarget = (modelId: string): NameTarget => ({ kind: 'model', modelId });

export let pointerTarget = (pointerId: string): NameTarget => ({ kind: 'pointer', pointerId });

export let period = (
  target: NameTarget,
  from: string,
  to: string | null = null
): TargetPeriod => ({
  target,
  from,
  to,
  evidence: 'test'
});

export let organization = (id: string, extra: Partial<Organization> = {}) =>
  ({ id, name: id, roles: ['lab'], aliases: [], status: 'active', ...extra }) as Organization;

export let model = (id: string, extra: Partial<Model> = {}) =>
  ({
    id,
    labId: 'lab',
    familyId: null,
    name: id,
    kind: 'chat',
    status: 'active',
    releaseDate: null,
    openWeights: false,
    modalities: { input: ['text'], output: ['text'] },
    capabilities: {
      tools: true,
      toolChoice: null,
      structuredOutput: false,
      reasoning: null,
      temperature: true,
      promptCaching: null,
      attachments: false
    },
    limits: { contextTokens: 200_000, inputTokens: null, outputTokens: null },
    ...extra
  }) as unknown as Model;

export let release = (id: string, extra: Partial<Release> = {}) =>
  ({ id, modelId: 'model', date: '2025-01-01', status: 'active', ...extra }) as Release;

export let pointer = (id: string, extra: Partial<Pointer> = {}) =>
  ({
    id,
    labId: 'lab',
    familyId: null,
    target: modelTarget('model'),
    history: [],
    evidence: 'test',
    ...extra
  }) as Pointer;

export let vendor = (id: string, extra: Partial<Vendor> = {}) =>
  ({
    id,
    organizationId: 'lab',
    name: id,
    kind: 'first-party',
    endpointIds: [],
    status: 'active',
    ...extra
  }) as unknown as Vendor;

export let endpoint = (id: string, extra: Partial<Endpoint> = {}) =>
  ({
    id,
    vendorId: 'vendor',
    name: id,
    region: null,
    plan: 'pay-as-you-go',
    baseUrl: null,
    status: 'active',
    ...extra
  }) as unknown as Endpoint;

export let offering = (id: string, extra: Partial<Offering> = {}) =>
  ({
    id,
    vendorId: 'vendor',
    vendorModelId: id,
    name: id,
    kind: 'model',
    modelId: 'model',
    releaseId: null,
    pointerId: null,
    variant: { serving: null, reasoning: null, quantization: null, free: false, region: null },
    status: 'active',
    pricing: pricing(1),
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    ...extra
  }) as unknown as Offering;

export let name = (id: string, extra: Partial<Name> = {}) =>
  ({
    id,
    namespace: 'display',
    raw: id,
    key: id,
    target: modelTarget('model'),
    history: [],
    origin: 'observed',
    status: 'live',
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    ...extra
  }) as unknown as Name;

export let agent = (id: string, extra: Partial<Agent> = {}) =>
  ({
    id,
    name: id,
    makerId: 'lab',
    openSource: false,
    surfaces: ['cli'],
    aliases: [],
    vendors: [],
    derivedFrom: null,
    status: 'active',
    ...extra
  }) as unknown as Agent;

export let catalog = (parts: Partial<Catalog> = {}) =>
  ({
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    sources: [],
    organizations: [organization('lab')],
    families: [],
    models: [model('model')],
    releases: [],
    pointers: [],
    vendors: [vendor('vendor')],
    endpoints: [],
    offerings: [],
    names: [],
    agents: [],
    ...parts
  }) as Catalog;

let historyFromOf = (history: TargetPeriod[] | undefined) =>
  [...(history ?? [])].map(item => item.from).sort()[0] ?? null;

// Mirrors what `loadStoredState` reads back after `catalog` was applied on top of `previous`.
export let storeCatalog = (applied: Catalog, previous: StoredState = emptyStoredState()) => {
  let { diffs } = buildEntityRows({ catalog: applied, stored: previous });
  let state = emptyStoredState();

  for (let diff of diffs) {
    let entity = diff.spec.entity;
    let before = previous[entity];
    let target = state[entity];

    for (let [id, row] of before) {
      if (!diff.rows.has(id)) target.set(id, { ...row, removed: true });
    }

    for (let row of diff.rows.values()) {
      let data = row.data as { firstSeenAt?: string; history?: TargetPeriod[] };
      let stored: StoredRow = {
        oid: before.get(row.id)?.oid ?? nextOid(),
        contentHash: row.contentHash,
        removed: false
      };

      if (entity == 'offering') {
        stored.pricingHash = row.columns.pricingHash as string | null;
        stored.vendorModelKey = vendorModelKey(row.columns.vendorId, row.columns.modelId);
        stored.firstSeenAt = data.firstSeenAt ?? null;
      }

      if (entity == 'name') {
        stored.firstSeenAt = data.firstSeenAt ?? null;
        stored.historyFrom = historyFromOf(data.history);
      }

      target.set(row.id, stored);
    }
  }

  return state;
};

export let range = (count: number) => Array.from({ length: count }, (_, index) => index);
