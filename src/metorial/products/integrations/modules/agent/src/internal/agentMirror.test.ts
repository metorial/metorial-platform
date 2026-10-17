import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    agentClient: { findUnique: vi.fn() },
    agentInstance: { findUnique: vi.fn() }
  },
  metorialDb: {
    consumerClient: { findUnique: vi.fn() },
    consumerAuthClient: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn() },
    agentClient: { upsert: vi.fn(), deleteMany: vi.fn() },
    agentClientRegistration: { upsert: vi.fn(), findUnique: vi.fn() },
    agentInstance: { upsert: vi.fn(), deleteMany: vi.fn() }
  },
  resolveMetorialInstance: vi.fn(),
  syncAgent: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: vi.fn((_name, factory) => ({ build: () => factory() })) }
}));

vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));

vi.mock('@metorial-subspace/module-tenant', () => ({ metorialDb: mocks.metorialDb }));

vi.mock('@metorial-subspace/module-identity', () => ({
  identityActorMirrorService: { syncAgent: mocks.syncAgent },
  resolveMetorialInstance: mocks.resolveMetorialInstance
}));

import { agentMirrorService } from './agentMirror';

let createdAt = new Date('2026-01-01');
let updatedAt = new Date('2026-02-01');

let buildClient = (overrides: Record<string, unknown> = {}) => ({
  oid: 11n,
  id: 'agc_1',
  type: 'mcp_client_oauth',
  name: 'Claude Desktop',
  foreignId: 'cli_1',
  instanceOid: 31n,
  environmentOid: 21n,
  createdAt,
  updatedAt,
  lastConnectedAt: updatedAt,
  agentClientRegistrations: [
    {
      oid: 12n,
      id: 'agr_1',
      oauthRegistrationId: 'cac_1',
      createdAt,
      updatedAt
    }
  ],
  ...overrides
});

let buildInstance = (overrides: Record<string, unknown> = {}) => ({
  oid: 13n,
  id: 'agi_1',
  type: 'mcp_client',
  name: 'Claude Desktop',
  version: '1.0.0',
  description: null,
  hash: 'hash',
  createdAt,
  updatedAt,
  lastConnectedAt: updatedAt,
  agent: { id: 'agt_1' },
  agentClient: { id: 'agc_1' },
  agentClientRegistration: { id: 'agr_1' },
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.resolveMetorialInstance.mockResolvedValue({
    oid: 301n,
    projectOid: 201n,
    organizationOid: 101n
  });
  mocks.metorialDb.consumerClient.findUnique.mockResolvedValue({ oid: 401n });
  mocks.metorialDb.consumerAuthClient.findUnique.mockResolvedValue({ oid: 501n });
  mocks.metorialDb.agentClient.upsert.mockImplementation(async ({ create }) => create);
  mocks.metorialDb.agent.findUnique.mockResolvedValue({ oid: 601n });
  mocks.metorialDb.agentClientRegistration.findUnique.mockResolvedValue({ oid: 12n });
});

describe('syncAgentClient', () => {
  it('mirrors the client and links its registration to the oauth client', async () => {
    mocks.db.agentClient.findUnique.mockResolvedValue(buildClient());

    await agentMirrorService.syncAgentClient({ agentClientId: 'agc_1' });

    expect(mocks.metorialDb.consumerClient.findUnique).toHaveBeenCalledWith({
      where: { id: 'cli_1' },
      select: { oid: true }
    });
    expect(mocks.metorialDb.agentClient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agc_1' },
        create: expect.objectContaining({
          oid: 11n,
          id: 'agc_1',
          organizationOid: 101n,
          projectOid: 201n,
          instanceOid: 301n,
          consumerClientOid: 401n
        })
      })
    );
    expect(mocks.metorialDb.consumerAuthClient.findUnique).toHaveBeenCalledWith({
      where: { id: 'cac_1' },
      select: { oid: true }
    });
    expect(mocks.metorialDb.agentClientRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agr_1' },
        create: expect.objectContaining({
          oid: 12n,
          agentClientOid: 11n,
          consumerAuthClientOid: 501n
        })
      })
    );
  });

  it('leaves system clients without a consumer link', async () => {
    mocks.db.agentClient.findUnique.mockResolvedValue(
      buildClient({ type: 'system_client', agentClientRegistrations: [] })
    );

    await agentMirrorService.syncAgentClient({ agentClientId: 'agc_1' });

    expect(mocks.metorialDb.consumerClient.findUnique).not.toHaveBeenCalled();
    expect(mocks.metorialDb.agentClient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ consumerClientOid: null })
      })
    );
  });

  it('keeps registrations when the oauth client no longer exists', async () => {
    mocks.db.agentClient.findUnique.mockResolvedValue(buildClient());
    mocks.metorialDb.consumerAuthClient.findUnique.mockResolvedValue(null);

    await agentMirrorService.syncAgentClient({ agentClientId: 'agc_1' });

    expect(mocks.metorialDb.agentClientRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ consumerAuthClientOid: null })
      })
    );
  });

  it('skips clients whose instance cannot be resolved', async () => {
    mocks.db.agentClient.findUnique.mockResolvedValue(buildClient());
    mocks.resolveMetorialInstance.mockResolvedValue(null);

    let result = await agentMirrorService.syncAgentClient({ agentClientId: 'agc_1' });

    expect(result).toBeNull();
    expect(mocks.metorialDb.agentClient.upsert).not.toHaveBeenCalled();
  });

  it('removes the mirror when the client is gone', async () => {
    mocks.db.agentClient.findUnique.mockResolvedValue(null);

    await agentMirrorService.syncAgentClient({ agentClientId: 'agc_1' });

    expect(mocks.metorialDb.agentClient.deleteMany).toHaveBeenCalledWith({
      where: { id: 'agc_1' }
    });
  });
});

describe('syncAgentInstance', () => {
  beforeEach(() => {
    mocks.db.agentClient.findUnique.mockResolvedValue(buildClient());
    mocks.metorialDb.agentInstance.upsert.mockImplementation(async ({ create }) => create);
  });

  it('mirrors the instance against the mirrored agent, client and registration', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(buildInstance());

    await agentMirrorService.syncAgentInstance({ agentInstanceId: 'agi_1' });

    expect(mocks.metorialDb.agentInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agi_1' },
        create: expect.objectContaining({
          oid: 13n,
          hash: 'hash',
          agentOid: 601n,
          agentClientOid: 11n,
          agentClientRegistrationOid: 12n
        })
      })
    );
    expect(mocks.syncAgent).not.toHaveBeenCalled();
  });

  it('mirrors the agent first when it is missing in core', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(buildInstance());
    mocks.metorialDb.agent.findUnique.mockResolvedValue(null);
    mocks.syncAgent.mockResolvedValue({ oid: 602n });

    await agentMirrorService.syncAgentInstance({ agentInstanceId: 'agi_1' });

    expect(mocks.syncAgent).toHaveBeenCalledWith({ agentId: 'agt_1' });
    expect(mocks.metorialDb.agentInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ agentOid: 602n })
      })
    );
  });

  it('skips when the agent cannot be mirrored', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(buildInstance());
    mocks.metorialDb.agent.findUnique.mockResolvedValue(null);
    mocks.syncAgent.mockResolvedValue(null);

    await agentMirrorService.syncAgentInstance({ agentInstanceId: 'agi_1' });

    expect(mocks.metorialDb.agentInstance.upsert).not.toHaveBeenCalled();
  });

  it('mirrors instances that have no client', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(
      buildInstance({ agentClient: null, agentClientRegistration: null })
    );

    await agentMirrorService.syncAgentInstance({ agentInstanceId: 'agi_1' });

    expect(mocks.metorialDb.agentInstance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          agentClientOid: null,
          agentClientRegistrationOid: null
        })
      })
    );
  });

  it('removes the mirror when the instance is gone', async () => {
    mocks.db.agentInstance.findUnique.mockResolvedValue(null);

    await agentMirrorService.syncAgentInstance({ agentInstanceId: 'agi_1' });

    expect(mocks.metorialDb.agentInstance.deleteMany).toHaveBeenCalledWith({
      where: { id: 'agi_1' }
    });
  });
});
