import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  gateway: {
    organization: { upsert: vi.fn() },
    project: { upsert: vi.fn() },
    instance: { upsert: vi.fn() }
  },
  fire: vi.fn(),
  enabled: { value: true }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: async (hook: () => unknown) => await hook(),
  db: { instance: { update: vi.fn() } }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('../src/lib/client', () => ({
  requireAiGateway: () => {
    if (!mocks.enabled.value) throw new Error('The AI gateway is not configured.');
    return mocks.gateway;
  }
}));

import { db } from '@metorial/db';
import { aiGatewayTenantService } from '../src/services/aiGatewayTenant';

let organization = { oid: 1n, id: 'org_1', name: 'Acme' };
let project = { oid: 2n, id: 'proj_1', name: 'Production' };
let instance = {
  oid: 3n,
  id: 'inst_1',
  name: 'Default',
  aiGatewayInstanceId: null as string | null,
  organization,
  project
};

let ensure = (overrides: Partial<typeof instance> = {}) =>
  aiGatewayTenantService.ensure({ instance: { ...instance, ...overrides } as any });

describe('aiGatewayTenantService.ensure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.gateway.project.upsert.mockResolvedValue({
      id: 'gwpr_1',
      platformLimitsSyncedAt: null
    });
    mocks.gateway.instance.upsert.mockResolvedValue({ id: 'gwin_1' });
  });

  it('skips the gateway entirely for an instance that is already set up', async () => {
    let result = await ensure({ aiGatewayInstanceId: 'gwin_1' });

    expect(mocks.gateway.organization.upsert).not.toHaveBeenCalled();
    expect(mocks.gateway.instance.upsert).not.toHaveBeenCalled();
    expect(db.instance.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      gateway: mocks.gateway,
      gatewayInstanceId: 'gwin_1',
      scope: { organizationId: 'org_1', instanceId: 'inst_1' }
    });
  });

  it('provisions the scope chain and records the marker on first use', async () => {
    let result = await ensure();

    expect(mocks.gateway.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.gateway.instance.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'gwpr_1',
      ref: 'inst_1',
      name: 'Default'
    });
    expect(db.instance.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { aiGatewayInstanceId: 'gwin_1' }
    });
    expect(result.gatewayInstanceId).toBe('gwin_1');
  });

  it('announces a project the first time it is provisioned', async () => {
    await ensure();

    expect(mocks.fire).toHaveBeenCalledWith('ai_gateway.project.created:after', {
      organization,
      project,
      gatewayProjectId: 'gwpr_1'
    });
  });

  it('fails clearly while the gateway is not configured', async () => {
    mocks.enabled.value = false;

    await expect(ensure({ aiGatewayInstanceId: 'gwin_1' })).rejects.toThrow(/not configured/);
  });
});
