import { beforeEach, describe, expect, it, vi } from 'vitest';

let env = { genesis: {} as Record<string, string | undefined> };

vi.mock('../src/env', () => ({ env }));

let region = {
  id: 'aws:us-east-1',
  identifier: 'iad1',
  name: 'Washington, D.C., USA (East)',
  cloud: 'Amazon Web Services',
  area: { id: 'na', name: 'North America' },
  genesisUrl: 'http://genesis-us'
};

let load = async () => {
  vi.resetModules();
  return await import('../src/lib/regions');
};

describe('sandbox regions', () => {
  beforeEach(() => {
    env.genesis = {};
  });

  it('is disabled without configuration', async () => {
    let regions = await load();

    expect(regions.isSandboxingEnabled()).toBe(false);
    expect(() => regions.getRegionClient('aws:us-east-1')).toThrow();
  });

  it('reads SANDBOX_REGIONS', async () => {
    env.genesis.SANDBOX_REGIONS = JSON.stringify([region]);
    let regions = await load();

    expect(regions.isSandboxingEnabled()).toBe(true);
    expect(regions.getSandboxRegionConfigs()).toEqual([region]);
  });

  it('falls back to a single dev region from GENESIS_INTERNAL_URL', async () => {
    env.genesis.GENESIS_INTERNAL_URL = 'http://bastion/genesis/internal';
    let regions = await load();

    expect(regions.getSandboxRegionConfigs()).toMatchObject([
      { id: 'dev', identifier: 'dev', genesisUrl: 'http://bastion/genesis/internal' }
    ]);
  });

  it('rejects duplicate identifiers', async () => {
    env.genesis.SANDBOX_REGIONS = JSON.stringify([region, { ...region, id: 'aws:us-east-2' }]);
    let regions = await load();

    expect(() => regions.getSandboxRegionConfigs()).toThrow(/duplicate/);
  });

  it('caches one client per region', async () => {
    env.genesis.SANDBOX_REGIONS = JSON.stringify([region]);
    let regions = await load();

    expect(regions.getRegionClient(region.id)).toBe(regions.getRegionClient(region.id));
  });

  it('requires signing credentials for authenticated regions without falling back to unsigned RPC', async () => {
    env.genesis.SANDBOX_REGIONS = JSON.stringify([
      {
        ...region,
        genesisUrl: 'https://genesis.test/genesis/internal',
        auth: { audience: 'genesis:staging-us-east-1' }
      }
    ]);
    let regions = await load();

    expect(() => regions.getRegionClient(region.id)).toThrow(/SANDBOX_SIGNATURE_CREDENTIALS/);
  });

  it('loads authenticated regions with credentials kept outside the public region configuration', async () => {
    let config = {
      ...region,
      genesisUrl: 'https://genesis.test/genesis/internal',
      auth: { audience: 'genesis:staging-us-east-1' }
    };
    env.genesis.SANDBOX_REGIONS = JSON.stringify([config]);
    env.genesis.SANDBOX_SIGNATURE_CREDENTIALS = JSON.stringify({
      keyId: 'staging/v1',
      privateKey: { kty: 'OKP', crv: 'Ed25519', x: 'a'.repeat(43), d: 'b'.repeat(43) }
    });
    let regions = await load();

    expect(regions.getSandboxRegionConfigs()).toEqual([config]);
    expect(regions.getRegionClient(region.id)).toBe(regions.getRegionClient(region.id));
    expect(JSON.stringify(regions.getSandboxRegionConfigs())).not.toContain('privateKey');
  });

  it('rejects plaintext transport for authenticated regions', async () => {
    env.genesis.SANDBOX_REGIONS = JSON.stringify([
      { ...region, auth: { audience: 'genesis:staging-us-east-1' } }
    ]);
    let regions = await load();

    expect(() => regions.getSandboxRegionConfigs()).toThrow(/HTTPS/);
  });
});
