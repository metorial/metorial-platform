import {
  createDimensionMaps,
  type DimensionModel
} from '@mtsrc/agent-tracking-module-knowledge';

let model = (id: string, overrides: Partial<DimensionModel> & { labId: string }) => ({
  id,
  familyId: null,
  kind: 'chat',
  status: 'active',
  openWeights: false,
  ...overrides
});

export let testDimensionMaps = () =>
  createDimensionMaps({
    version: 'atks_test',
    models: [
      model('claude-sonnet-4-5', { labId: 'anthropic', familyId: 'claude-sonnet' }),
      model('claude-opus-4-1', {
        labId: 'anthropic',
        familyId: 'claude-opus',
        status: 'deprecated'
      }),
      model('gpt-5', { labId: 'openai' }),
      model('text-embedding-3', { labId: 'openai', kind: 'embedding' }),
      model('llama-4', { labId: 'meta', familyId: 'llama', openWeights: true })
    ],
    families: [
      { id: 'claude-sonnet', latestModelId: 'claude-sonnet-4-5' },
      { id: 'claude-opus', latestModelId: 'claude-opus-4-5' },
      { id: 'llama', latestModelId: 'llama-4' }
    ],
    vendors: [
      { id: 'anthropic', kind: 'first-party' },
      { id: 'openai', kind: 'first-party' },
      { id: 'aws-bedrock', kind: 'cloud' },
      { id: 'openrouter', kind: 'aggregator' }
    ],
    agents: [
      { id: 'legacy-codex', makerId: 'acme', aliasKeys: ['codex'], removed: true },
      { id: 'claude-code', makerId: 'anthropic', aliasKeys: ['claude-code'], removed: false },
      { id: 'codex', makerId: 'openai', aliasKeys: ['codex', 'codex-cli-rs'], removed: false }
    ],
    organizations: [
      { id: 'anthropic', roles: ['lab', 'vendor'], aliases: [] },
      { id: 'openai', roles: ['lab', 'vendor'], aliases: [] },
      { id: 'meta', roles: ['lab'], aliases: ['meta-llama'] },
      { id: 'amazon', roles: ['vendor'], aliases: ['aws'] }
    ]
  });
