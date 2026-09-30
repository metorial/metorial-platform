import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  loadTemplateContextForDeployment: vi.fn(),
  getCompletedSetupSession: vi.fn(),
  relinkMagicMcpServerIntegrationInstance: vi.fn(),
  createMagicMcpServer: vi.fn(),
  archiveMagicMcpServer: vi.fn(),
  upsertConsumerIntegration: vi.fn(),
  grantAccess: vi.fn(),
  fabricFire: vi.fn(),
  getMagicMcpServerBackingStatuses: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: { findFirst: vi.fn(), findMany: vi.fn() },
    consumerActor: { findFirst: vi.fn() }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/context', () => ({ Context: {} }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fabricFire } }));
vi.mock('@metorial/module-magic', () => ({
  magicMcpServerService: {
    relinkMagicMcpServerIntegrationInstance: mocks.relinkMagicMcpServerIntegrationInstance,
    createMagicMcpServer: mocks.createMagicMcpServer,
    archiveMagicMcpServer: mocks.archiveMagicMcpServer
  }
}));
vi.mock('@metorial-subspace/module-integration', () => ({
  magicMcpServerBackingService: {
    getMagicMcpServerBackingStatuses: mocks.getMagicMcpServerBackingStatuses
  }
}));
vi.mock('@metorial/module-consumer-access', () => ({
  consumerAccessPolicyService: { grantAccess: mocks.grantAccess }
}));
vi.mock('../src/lib/consumerProviderContext', () => ({
  loadTemplateContextForDeployment: mocks.loadTemplateContextForDeployment
}));
vi.mock('../src/services/consumerIntegration', () => ({
  consumerIntegrationService: { upsertConsumerIntegration: mocks.upsertConsumerIntegration }
}));
vi.mock('../src/services/consumerProviderSetupSession', () => ({
  consumerProviderSetupSessionService: {
    getCompletedSetupSession: mocks.getCompletedSetupSession
  }
}));

import { db } from '@metorial/db';
import { consumerProviderDeploymentService } from '../src/services/consumerProviderDeployment';

let instance = { oid: 10n, id: 'ins_1' } as any;
let consumerProfile = { oid: 40n, id: 'cpr_1' } as any;
let auditScope = { organizationOid: 1n } as any;

let providerContext = {
  providerTemplate: {
    id: 'ptb_1',
    name: 'Slack',
    description: null,
    subspaceIntegrationId: 'int_1'
  },
  provider: { id: 'pro_1', name: 'Slack', description: null },
  deployment: { description: null, defaultConfig: null },
  configSchema: null
};

let existingServer = {
  oid: 20n,
  id: 'mms_1',
  name: 'Slack',
  status: 'active',
  source: 'consumer_provider_template',
  providerTemplateId: 'ptb_1',
  subspaceIntegrationInstanceId: 'iin_old'
};

let completedSetupSession = {
  status: 'successful',
  integrationInstance: {
    id: 'iin_new',
    status: 'active',
    integrationInstanceProviders: [{ currentVersion: null }]
  }
};

let reconnect = () =>
  consumerProviderDeploymentService.reconnectProvider({
    organization: { oid: 1n } as any,
    performedBy: { oid: 2n } as any,
    instance,
    context: {} as any,
    consumerProfile,
    accessTags: {} as any,
    auditScope,
    providerTemplateId: 'ptb_1',
    input: {
      magicMcpServerId: 'mms_1',
      integrationSetupSessionId: 'iss_1'
    }
  });

describe('consumerProviderDeploymentService.reconnectProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.loadTemplateContextForDeployment.mockResolvedValue(providerContext);
    mocks.getCompletedSetupSession.mockResolvedValue(completedSetupSession);
    (db.consumerActor.findFirst as any).mockResolvedValue({
      id: 'cac_1',
      defaultIdentityId: 'idn_1'
    });
    mocks.relinkMagicMcpServerIntegrationInstance.mockResolvedValue({
      ...existingServer,
      subspaceIntegrationInstanceId: 'iin_new'
    });
    (db.magicMcpServer.findMany as any).mockResolvedValue([]);
    mocks.getMagicMcpServerBackingStatuses.mockResolvedValue(new Map());
  });

  it('relinks the consumer-owned server instead of creating a new one', async () => {
    (db.magicMcpServer.findFirst as any).mockResolvedValue(existingServer);

    let result = await reconnect();

    expect(result.id).toBe('mms_1');
    expect(db.magicMcpServer.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'mms_1',
        status: 'active',
        source: 'consumer_provider_template',
        providerTemplateId: 'ptb_1',
        consumerIntegrations: { some: { consumerProfileOid: consumerProfile.oid } }
      })
    });
    expect(mocks.relinkMagicMcpServerIntegrationInstance).toHaveBeenCalledWith({
      server: existingServer,
      instance,
      auditScope,
      integrationInstanceId: 'iin_new',
      consumerOwner: { identityActorId: 'cac_1', identityId: 'idn_1' }
    });
    expect(mocks.createMagicMcpServer).not.toHaveBeenCalled();
    expect(mocks.fabricFire).toHaveBeenCalledWith(
      'consumer.provider.reconnected:after',
      expect.objectContaining({
        deployment: expect.objectContaining({ integrationInstanceId: 'iin_new' }),
        previousDeployment: expect.objectContaining({ integrationInstanceId: 'iin_old' })
      })
    );
  });

  it('falls back to a fresh deployment when the server is gone or not owned', async () => {
    (db.magicMcpServer.findFirst as any).mockResolvedValue(null);
    mocks.createMagicMcpServer.mockResolvedValue({ ...existingServer, id: 'mms_new' });

    let result = await reconnect();

    expect(result.id).toBe('mms_new');
    expect(mocks.relinkMagicMcpServerIntegrationInstance).not.toHaveBeenCalled();
    expect(mocks.createMagicMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ subspaceIntegrationInstanceId: 'iin_new' })
      })
    );
  });

  it('rejects setup sessions that did not produce an active integration instance', async () => {
    (db.magicMcpServer.findFirst as any).mockResolvedValue(existingServer);
    mocks.getCompletedSetupSession.mockResolvedValue({
      ...completedSetupSession,
      integrationInstance: { ...completedSetupSession.integrationInstance, status: 'archived' }
    });

    await expect(reconnect()).rejects.toThrow();
    expect(mocks.relinkMagicMcpServerIntegrationInstance).not.toHaveBeenCalled();
  });
});

describe('consumerProviderDeploymentService.deployProvider self-healing', () => {
  let deploy = () =>
    consumerProviderDeploymentService.deployProvider({
      organization: { oid: 1n } as any,
      performedBy: { oid: 2n } as any,
      instance,
      context: {} as any,
      consumerProfile,
      accessTags: {} as any,
      auditScope,
      providerTemplateId: 'ptb_1',
      input: { integrationSetupSessionId: 'iss_1' }
    });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.loadTemplateContextForDeployment.mockResolvedValue(providerContext);
    mocks.getCompletedSetupSession.mockResolvedValue(completedSetupSession);
    (db.consumerActor.findFirst as any).mockResolvedValue({
      id: 'cac_1',
      defaultIdentityId: 'idn_1'
    });
    mocks.relinkMagicMcpServerIntegrationInstance.mockResolvedValue({
      ...existingServer,
      subspaceIntegrationInstanceId: 'iin_new'
    });
    mocks.createMagicMcpServer.mockResolvedValue({ ...existingServer, id: 'mms_new' });
  });

  it('relinks an owned server whose integration instance was removed', async () => {
    let healthyServer = { ...existingServer, id: 'mms_healthy' };
    (db.magicMcpServer.findMany as any).mockResolvedValue([healthyServer, existingServer]);
    mocks.getMagicMcpServerBackingStatuses.mockResolvedValue(
      new Map([
        ['mms_healthy', 'healthy'],
        ['mms_1', 'needs_reconnect']
      ])
    );

    let result = await deploy();

    expect(result.id).toBe('mms_1');
    expect(db.magicMcpServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          source: 'consumer_provider_template',
          providerTemplateId: 'ptb_1',
          hasSubspaceBacking: true,
          consumerIntegrations: { some: { consumerProfileOid: consumerProfile.oid } }
        })
      })
    );
    expect(mocks.relinkMagicMcpServerIntegrationInstance).toHaveBeenCalledWith(
      expect.objectContaining({ server: existingServer, integrationInstanceId: 'iin_new' })
    );
    expect(mocks.createMagicMcpServer).not.toHaveBeenCalled();
    expect(mocks.fabricFire).not.toHaveBeenCalledWith(
      'consumer.provider.deployed:before',
      expect.anything()
    );
    expect(mocks.fabricFire).toHaveBeenCalledWith(
      'consumer.provider.reconnected:after',
      expect.anything()
    );
  });

  it('creates a new server when all owned servers are healthy', async () => {
    (db.magicMcpServer.findMany as any).mockResolvedValue([existingServer]);
    mocks.getMagicMcpServerBackingStatuses.mockResolvedValue(new Map([['mms_1', 'healthy']]));

    let result = await deploy();

    expect(result.id).toBe('mms_new');
    expect(mocks.relinkMagicMcpServerIntegrationInstance).not.toHaveBeenCalled();
    expect(mocks.createMagicMcpServer).toHaveBeenCalled();
  });

  it('skips the backing status lookup when the consumer owns no servers', async () => {
    (db.magicMcpServer.findMany as any).mockResolvedValue([]);

    await deploy();

    expect(mocks.getMagicMcpServerBackingStatuses).not.toHaveBeenCalled();
    expect(mocks.createMagicMcpServer).toHaveBeenCalled();
  });
});
