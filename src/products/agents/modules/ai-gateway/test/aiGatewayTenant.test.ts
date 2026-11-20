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
  db: { instance: { findUniqueOrThrow: vi.fn() } }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('../src/lib/client', () => ({
  getAiGateway: () => (mocks.enabled.value ? mocks.gateway : null)
}));

import { db } from '@metorial/db';
import { aiGatewayTenantService } from '../src/services/aiGatewayTenant';

let organization = { oid: 1n, id: 'org_1', name: 'Acme' };
let project = { oid: 2n, id: 'proj_1', name: 'Production' };
let instance = { oid: 3n, id: 'inst_1', name: 'Default', organization, project };

describe('aiGatewayTenantService.ensure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);
    mocks.gateway.project.upsert.mockResolvedValue({
      id: 'gwpr_1',
      platformLimitsSyncedAt: null
    });
    mocks.gateway.instance.upsert.mockResolvedValue({ id: 'gwin_1' });
  });

  it('provisions the whole scope chain and returns the gateway project and instance', async () => {
    let result = await aiGatewayTenantService.ensure({ instance: { oid: 3n } as any });

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
    expect(result).toEqual({
      project: { id: 'gwpr_1', platformLimitsSyncedAt: null },
      instance: { id: 'gwin_1' }
    });
  });

  it('announces a project the first time it is provisioned', async () => {
    await aiGatewayTenantService.ensure({ instance: { oid: 3n } as any });

    expect(mocks.fire).toHaveBeenCalledWith('ai_gateway.project.created:after', {
      organization,
      project,
      gatewayProjectId: 'gwpr_1'
    });
  });

  it('fails clearly while the gateway is not configured', async () => {
    mocks.enabled.value = false;

    await expect(
      aiGatewayTenantService.ensure({ instance: { oid: 3n } as any })
    ).rejects.toThrow(/not configured/);
  });
});
