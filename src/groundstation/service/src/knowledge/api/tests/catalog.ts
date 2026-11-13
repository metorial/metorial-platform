import type { Catalog, Model, Pricing } from '@metorial/model-catalog/src/types';
import { name, offering, textPricing } from '../../tests/fixture';

export let apiFixture = {
  lab: 'mistral',
  family: 'mistral-large',
  latestModel: 'mistral-large-3',
  models: ['mistral-large-2', 'mistral-large-2-1', 'mistral-large-3', 'mistral-small-3'],
  pointer: 'mistral-large-latest',
  pointerRetargetedAt: '2025-11-01T00:00:00.000Z',
  names: {
    pointer: 'vendor:mistral:mistral-large-latest',
    display: 'display:Mistral Large 3',
    release: 'vendor:mistral:mistral-large-2601'
  },
  releases: ['mistral-large-3@2025-11-01', 'mistral-large-3@2026-01-15'],
  vendors: { firstParty: 'mistral', inference: 'together-ai' },
  endpoints: ['mistral-api', 'together-api'],
  offerings: {
    firstParty: 'mistral:mistral-large-3',
    inference: 'together-ai:mistralai/mistral-large-3',
    free: 'together-ai:mistralai/mistral-large-3:free',
    unpriced: 'aws-bedrock:mistral.mistral-large-3',
    small: 'mistral:mistral-small-3'
  },
  agent: 'le-chat-cli'
};

let pricing = (input: number, output: number): Pricing => ({
  ...textPricing(input),
  text: { input, output, cacheRead: null, cacheWrite: [], reasoning: null }
});

export let addApiFixtures = (
  catalog: Catalog,
  d: { largeInput?: number; withSmall?: boolean } = {}
) => {
  let template = catalog.models.find(model => model.id == 'claude-sonnet-4-5')!;

  let model = (id: string, name: string, overrides: Partial<Model> = {}): Model => ({
    ...template,
    id,
    name,
    labId: 'mistral',
    familyId: 'mistral-large',
    ...overrides
  });

  catalog.organizations.push(
    { ...catalog.organizations[0]!, id: 'mistral', name: 'Mistral AI', country: 'FR' },
    { ...catalog.organizations[0]!, id: 'together', name: 'Together', roles: ['vendor'] }
  );

  catalog.families.push({
    ...catalog.families[0]!,
    id: 'mistral-large',
    labId: 'mistral',
    name: 'Mistral Large',
    line: 'large',
    modelIds: ['mistral-large-2', 'mistral-large-2-1', 'mistral-large-3'],
    latestModelId: 'mistral-large-3'
  });

  catalog.models.push(
    model('mistral-large-2', 'Mistral Large 2', {
      versionSort: [2],
      releaseDate: '2024-07-24'
    }),
    model('mistral-large-2-1', 'Mistral Large 2.1', {
      versionSort: [2, 1],
      releaseDate: '2024-11-18'
    }),
    model('mistral-large-3', 'Mistral Large 3', {
      versionSort: [3],
      releaseDate: '2025-11-01',
      limits: { contextTokens: 256_000, inputTokens: null, outputTokens: null },
      releaseIds: ['mistral-large-3@2025-11-01', 'mistral-large-3@2026-01-15'],
      latestReleaseId: 'mistral-large-3@2026-01-15'
    }),
    ...(d.withSmall === false
      ? []
      : [
          model('mistral-small-3', 'Mistral Small 3', {
            familyId: null,
            openWeights: true,
            license: 'apache-2.0',
            modalities: { input: ['text'], output: ['text'] },
            capabilities: {
              ...template.capabilities,
              reasoning: { toggle: true, effort: null }
            },
            limits: { contextTokens: 32_000, inputTokens: null, outputTokens: null }
          })
        ])
  );

  catalog.releases.push(
    {
      id: 'mistral-large-3@2025-11-01',
      modelId: 'mistral-large-3',
      date: '2025-11-01',
      status: 'active'
    },
    {
      id: 'mistral-large-3@2026-01-15',
      modelId: 'mistral-large-3',
      date: '2026-01-15',
      status: 'active'
    }
  );

  let target = { kind: 'model' as const, modelId: 'mistral-large-3' };
  catalog.pointers.push({
    id: 'mistral-large-latest',
    labId: 'mistral',
    familyId: 'mistral-large',
    target,
    history: [
      {
        target: { kind: 'model', modelId: 'mistral-large-2-1' },
        from: '2024-11-18T00:00:00.000Z',
        to: '2025-11-01T00:00:00.000Z',
        evidence: 'fixture'
      },
      { target, from: '2025-11-01T00:00:00.000Z', to: null, evidence: 'fixture' }
    ],
    evidence: 'fixture'
  });

  catalog.names.push(
    name('vendor:mistral', 'mistral-large-latest', {
      kind: 'pointer',
      pointerId: 'mistral-large-latest'
    }) as never,
    name('display', 'Mistral Large 3', target) as never,
    name('vendor:mistral', 'mistral-large-2601', {
      kind: 'release',
      modelId: 'mistral-large-3',
      releaseId: 'mistral-large-3@2026-01-15'
    }) as never
  );

  catalog.vendors.push(
    { ...catalog.vendors[0]!, id: 'mistral', organizationId: 'mistral', name: 'Mistral' },
    {
      ...catalog.vendors[0]!,
      id: 'together-ai',
      organizationId: 'together',
      name: 'Together AI',
      kind: 'inference'
    }
  );

  catalog.endpoints.push(
    {
      ...catalog.endpoints[0]!,
      id: 'mistral-api',
      vendorId: 'mistral',
      name: 'Mistral API',
      baseUrl: 'https://api.mistral.ai/v1'
    },
    {
      ...catalog.endpoints[0]!,
      id: 'together-api',
      vendorId: 'together-ai',
      name: 'Together API',
      baseUrl: 'https://api.together.xyz/v1'
    }
  );

  let free = offering({
    vendorId: 'together-ai',
    vendorModelId: 'mistralai/mistral-large-3:free',
    modelId: 'mistral-large-3',
    pricing: pricing(0, 0)
  });

  catalog.offerings.push(
    offering({
      vendorId: 'mistral',
      vendorModelId: 'mistral-large-3',
      modelId: 'mistral-large-3',
      pricing: pricing(d.largeInput ?? 2, 6)
    }) as never,
    offering({
      vendorId: 'together-ai',
      vendorModelId: 'mistralai/mistral-large-3',
      modelId: 'mistral-large-3',
      pricing: pricing(1.5, 9)
    }) as never,
    { ...free, variant: { ...free.variant, free: true } } as never,
    offering({
      vendorId: 'aws-bedrock',
      vendorModelId: 'mistral.mistral-large-3',
      modelId: 'mistral-large-3',
      pricing: null
    }) as never,
    ...(d.withSmall === false
      ? []
      : [
          offering({
            vendorId: 'mistral',
            vendorModelId: 'mistral-small-3',
            modelId: 'mistral-small-3',
            pricing: pricing(0.1, 0.3)
          }) as never
        ])
  );

  catalog.agents.push({
    ...catalog.agents[0]!,
    id: 'le-chat-cli',
    name: 'Le Chat CLI',
    makerId: 'mistral',
    openSource: true,
    license: 'apache-2.0',
    surfaces: ['cli', 'ide'],
    aliases: ['le_chat'],
    vendors: [
      { vendorId: 'mistral', role: 'default' },
      { vendorId: 'together-ai', role: 'subscription' }
    ]
  });

  return catalog;
};
