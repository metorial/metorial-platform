import { beforeEach, describe, expect, it, vi } from 'vitest';

let { processors, db } = vi.hoisted(() => {
  let processors = new Map<string, (data: any) => Promise<void>>();
  let model = () => ({ findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() });

  return {
    processors,
    db: {
      integrationInstance: model(),
      integrationInstanceGroup: model(),
      sessionTemplate: model(),
      ephemeralManagedSession: model(),
      session: model(),
      magicMcpServerBacking: model(),
      magicMcpEndpointBacking: model()
    }
  };
});

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(() => ({})),
  dailyPacedDelay: vi.fn(() => ({})),
  createQueue: vi.fn((config: { name: string }) => ({
    add: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn((handler: (data: any) => Promise<void>) => {
      processors.set(config.name, handler);
      return {};
    })
  }))
}));

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn(() => ({}))
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('../src/env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

await import('../src/queues/resourceOwner');

let run = (key: string, id = 'res_1') =>
  processors.get(`sub/int/resourceOwner/${key}/single`)!({ id });

let consumer = { oid: 500n, type: 'consumer' };
let person = { oid: 600n, type: 'person' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resource owner reconcilers', () => {
  it('sets a consumer identity actor as the integration instance owner', async () => {
    db.integrationInstance.findUnique.mockResolvedValue({
      oid: 1n,
      ownerActorOid: null,
      identityActor: consumer
    });

    await run('integrationInstance');

    expect(db.integrationInstance.updateMany).toHaveBeenCalledWith({
      where: { oid: 1n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 500n }
    });
  });

  it('does not make non-consumer actors owners', async () => {
    db.integrationInstanceGroup.findUnique.mockResolvedValue({
      oid: 2n,
      ownerActorOid: null,
      identityActor: person
    });

    await run('integrationInstanceGroup');

    expect(db.integrationInstanceGroup.updateMany).not.toHaveBeenCalled();
  });

  it('never overwrites an existing owner', async () => {
    db.session.findUnique.mockResolvedValue({
      oid: 3n,
      ownerActorOid: 1n,
      identityActor: consumer,
      ephemeralManagedSession: null
    });

    await run('session');

    expect(db.session.updateMany).not.toHaveBeenCalled();
  });

  it('prefers the integration instance owner for session templates', async () => {
    db.sessionTemplate.findUnique.mockResolvedValue({
      oid: 4n,
      ownerActorOid: null,
      identityActor: consumer,
      integrationInstance: { ownerActorOid: 700n },
      integrationInstanceGroup: null
    });

    await run('sessionTemplate');

    expect(db.sessionTemplate.updateMany).toHaveBeenCalledWith({
      where: { oid: 4n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 700n }
    });
  });

  it('inherits the session template owner for ephemeral managed sessions', async () => {
    db.ephemeralManagedSession.findUnique.mockResolvedValue({
      oid: 5n,
      ownerActorOid: null,
      actor: person,
      sessionTemplate: { ownerActorOid: 800n }
    });

    await run('ephemeralManagedSession');

    expect(db.ephemeralManagedSession.updateMany).toHaveBeenCalledWith({
      where: { oid: 5n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 800n }
    });
  });

  it('inherits the ephemeral managed session owner for sessions', async () => {
    db.session.findUnique.mockResolvedValue({
      oid: 6n,
      ownerActorOid: null,
      identityActor: null,
      ephemeralManagedSession: { ownerActorOid: 900n }
    });

    await run('session');

    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { oid: 6n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 900n }
    });
  });

  it('falls back to the backing actor for magic MCP server backings', async () => {
    db.magicMcpServerBacking.findUnique.mockResolvedValue({
      oid: 7n,
      ownerActorOid: null,
      actor: consumer,
      integrationInstance: { ownerActorOid: null }
    });

    await run('magicMcpServerBacking');

    expect(db.magicMcpServerBacking.updateMany).toHaveBeenCalledWith({
      where: { oid: 7n, ownerActorOid: null, isSystemOwned: false },
      data: { ownerActorOid: 500n }
    });
  });

  it('skips missing rows', async () => {
    db.magicMcpEndpointBacking.findUnique.mockResolvedValue(null);

    await run('magicMcpEndpointBacking');

    expect(db.magicMcpEndpointBacking.updateMany).not.toHaveBeenCalled();
  });

  it('queues candidates and pages through them', async () => {
    db.session.findMany.mockResolvedValue([{ id: 'ses_1' }, { id: 'ses_2' }]);

    await processors.get('sub/int/resourceOwner/session/many')!({ cursor: 'ses_0' });

    expect(db.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerActorOid: null, id: { gt: 'ses_0' } })
      })
    );
  });
});
