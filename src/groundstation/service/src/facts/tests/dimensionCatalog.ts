import {
  agent,
  family,
  model,
  name,
  offering,
  textPricing,
  type knowledgeCatalog
} from '../../knowledge/tests/fixture';

type CatalogOptions = NonNullable<Parameters<typeof knowledgeCatalog>[0]>;

export let haikuRaw = 'claude-haiku-4-5-20251001';

export let dimensionCatalogOptions = (
  d: { haikuFamilyId?: string; codexMakerId?: string } = {}
): CatalogOptions => ({
  extraFamilies: [
    family({ id: 'claude-haiku', labId: 'anthropic', modelIds: ['claude-haiku-4-5'] })
  ],
  extraModels: [model('claude-haiku-4-5', 'anthropic', d.haikuFamilyId ?? 'claude-haiku')],
  extraOfferings: [
    offering({
      vendorId: 'anthropic',
      vendorModelId: haikuRaw,
      modelId: 'claude-haiku-4-5',
      pricing: textPricing(1)
    })
  ],
  extraNames: [
    name('vendor:anthropic', haikuRaw, { kind: 'model', modelId: 'claude-haiku-4-5' })
  ],
  extraAgents: [
    agent({
      id: 'codex',
      makerId: d.codexMakerId ?? 'openai',
      aliases: ['codex_cli_rs'],
      vendorId: 'openai'
    })
  ]
});
