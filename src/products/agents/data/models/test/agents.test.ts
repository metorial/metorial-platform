import { describe, expect, it } from 'vitest';
import { buildCatalog, createAgentLookup, normalizeAgentKey, type Agent } from '../src';
import { buildAgents } from '../src/pipeline/agents';
import { buildOrganizations } from '../src/pipeline/organizations';
import { validateCatalog } from '../src/pipeline/validate';
import { buildVendors } from '../src/pipeline/vendors';
import { agentSeeds } from '../src/registry/agents';
import { organizationSeeds } from '../src/registry/organizations';
import { vendorKindHints, vendorSeeds } from '../src/registry/vendors';
import { readModelsDev } from '../src/sources/modelsDev';
import { fixturePath, noOverrides, now } from './helpers';

let fixtureIndexes = async () => {
  let snapshot = await readModelsDev(fixturePath);
  let orgs = buildOrganizations(snapshot);
  let vendors = buildVendors(snapshot, orgs);
  return { orgs, vendors: vendors.vendors };
};

let fixtureCatalog = () =>
  buildCatalog({
    modelsDevPath: fixturePath,
    previousDir: null,
    offline: true,
    now,
    overrides: noOverrides
  });

describe('agent registry', () => {
  it('never gives two agents the same id or alias', () => {
    let owners = new Map<string, Set<string>>();

    for (let seed of agentSeeds)
      for (let key of [seed.id, ...(seed.aliases ?? [])].map(normalizeAgentKey))
        owners.set(key, new Set([...(owners.get(key) ?? []), seed.id]));

    let shared = [...owners].filter(([, ids]) => ids.size > 1).map(([key]) => key);

    expect(shared).toEqual([]);
    expect(new Set(agentSeeds.map(seed => seed.id)).size).toBe(agentSeeds.length);
  });

  it('only references seeded makers, known vendors and other agents', () => {
    let organizations = new Set(organizationSeeds.map(seed => seed.id));
    let vendors = new Set([
      ...vendorSeeds.map(seed => seed.id),
      ...Object.keys(vendorKindHints)
    ]);
    let agents = new Set(agentSeeds.map(seed => seed.id));

    for (let seed of agentSeeds) {
      expect(organizations.has(seed.makerId), `${seed.id} maker ${seed.makerId}`).toBe(true);
      if (seed.derivedFrom) expect(agents.has(seed.derivedFrom), seed.id).toBe(true);
      for (let link of seed.vendors ?? [])
        expect(vendors.has(link.vendorId), `${seed.id} vendor ${link.vendorId}`).toBe(true);
    }
  });

  it('describes every agent consistently', () => {
    for (let seed of agentSeeds) {
      expect(seed.surfaces.length, seed.id).toBeGreaterThan(0);
      expect(seed.description.length, seed.id).toBeGreaterThan(0);
      expect(seed.id, seed.id).toBe(normalizeAgentKey(seed.id));
      if (seed.license) expect(seed.openSource, seed.id).toBe(true);
      expect(
        (seed.vendors ?? []).filter(link => link.role === 'default').length,
        seed.id
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildAgents', () => {
  it('marks makers and keeps only vendors the catalog has', async () => {
    let { orgs, vendors } = await fixtureIndexes();
    let { agents, issues } = buildAgents({ orgs, vendors });
    let claudeCode = agents.find(agent => agent.id === 'claude-code');

    expect(agents.length).toBe(agentSeeds.length);
    expect(orgs.organizations.get('anthropic')?.roles).toContain('agent-maker');
    expect(orgs.organizations.get('anysphere')?.roles).toEqual(['agent-maker']);
    expect(claudeCode?.vendors).toEqual([
      { vendorId: 'anthropic', role: 'default' },
      { vendorId: 'aws-bedrock', role: 'supported' }
    ]);
    expect(issues).toContain(
      'agent claude-code links vendor google-vertex, which is not in the catalog'
    );
    expect(issues).toContain(
      'agent github-copilot links vendor github-copilot, which is not in the catalog'
    );
  });

  it('skips agents whose maker is unknown', async () => {
    let { orgs, vendors } = await fixtureIndexes();
    let { agents, issues } = buildAgents({
      orgs,
      vendors,
      seeds: [
        {
          id: 'ghost',
          name: 'Ghost',
          makerId: 'nobody',
          description: 'x',
          openSource: false,
          surfaces: ['cli']
        }
      ]
    });

    expect(agents).toEqual([]);
    expect(issues).toEqual(['agent ghost has unknown maker nobody']);
  });

  it('keeps aliases verbatim and sorts vendors by role', async () => {
    let { orgs, vendors } = await fixtureIndexes();
    let { agents } = buildAgents({
      orgs,
      vendors,
      seeds: [
        {
          id: 'demo',
          name: 'Demo',
          makerId: 'openai',
          description: 'x',
          openSource: true,
          license: 'MIT',
          surfaces: ['ide', 'cli'],
          aliases: ['demo_cli', 'Demo.App', 'demo_cli'],
          vendors: [
            { vendorId: 'openrouter', role: 'supported' },
            { vendorId: 'anthropic', role: 'supported' },
            { vendorId: 'openai', role: 'default' }
          ]
        }
      ]
    });

    expect(agents[0]).toMatchObject({
      surfaces: ['cli', 'ide'],
      aliases: ['Demo.App', 'demo_cli'],
      vendors: [
        { vendorId: 'openai', role: 'default' },
        { vendorId: 'anthropic', role: 'supported' },
        { vendorId: 'openrouter', role: 'supported' }
      ],
      website: null,
      derivedFrom: null,
      status: 'active'
    });
  });
});

describe('createAgentLookup', () => {
  it('finds agents by the ids telemetry reports', async () => {
    let { catalog } = await fixtureCatalog();
    let lookup = createAgentLookup(catalog);

    expect(lookup('claude-code')?.id).toBe('claude-code');
    expect(lookup('claude_code')?.id).toBe('claude-code');
    expect(lookup('codex_cli_rs')?.id).toBe('codex');
    expect(lookup('Copilot_VSCode')?.id).toBe('github-copilot');
    expect(lookup('other:goose')?.id).toBe('goose');
    expect(lookup('windsurf')?.id).toBe('devin-desktop');
    expect(lookup('unknown-agent')).toBeNull();
  });
});

describe('validateCatalog agents', () => {
  it('flags broken agent references and alias clashes', async () => {
    let { catalog } = await fixtureCatalog();
    let base = catalog.agents.find(agent => agent.id === 'codex')!;
    let broken: Agent[] = [
      ...catalog.agents,
      {
        ...base,
        id: 'clash',
        makerId: 'nobody',
        aliases: ['claude_code'],
        derivedFrom: 'missing-agent',
        vendors: [
          { vendorId: 'openai', role: 'default' },
          { vendorId: 'anthropic', role: 'default' },
          { vendorId: 'nowhere', role: 'supported' }
        ]
      }
    ];

    let { errors } = validateCatalog({ ...catalog, agents: broken });

    expect(errors).toEqual(
      expect.arrayContaining([
        'agent clash has missing maker nobody',
        'agent clash derives from missing agent missing-agent',
        'agent clash links missing vendor nowhere',
        'agent clash has more than one default vendor',
        'agent clash alias claude-code is already used by agent claude-code'
      ])
    );
  });

  it('accepts the generated agents', async () => {
    let { catalog, validation } = await fixtureCatalog();

    expect(catalog.agents.length).toBeGreaterThan(0);
    expect(validation.errors).toEqual([]);
  });
});
