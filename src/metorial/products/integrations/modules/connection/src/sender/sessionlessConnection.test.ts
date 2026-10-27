import { beforeEach, describe, expect, it, vi } from 'vitest';

let { store, sessionUpdates, sessionEvents } = vi.hoisted(() => ({
  store: [] as any[],
  sessionUpdates: [] as any[],
  sessionEvents: [] as any[]
}));

let matchesWhere = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && 'gt' in condition) {
      return row[key] instanceof Date && row[key] > condition.gt;
    }
    return row[key] === condition;
  });

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  badRequestError: ({ message }: { message: string }) => new Error(message),
  goneError: ({ message }: { message: string }) => new Error(message),
  internalServerError: ({ message }: { message: string }) => new Error(message),
  notFoundError: (_object: string, id?: string) => new Error(id ?? 'not found'),
  preconditionFailedError: ({ message }: { message: string }) => new Error(message)
}));
vi.mock('@lowerdeck/lock', () => {
  let tails = new Map<string, Promise<unknown>>();

  return {
    createLock: vi.fn(() => ({
      usingLock: async (key: string, fn: () => Promise<unknown>) => {
        let previous = tails.get(key) ?? Promise.resolve();
        let run = previous.then(fn, fn);
        tails.set(
          key,
          run.catch(() => {})
        );
        return await run;
      }
    }))
  };
});
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({ captureException: vi.fn() }))
}));
vi.mock('@metorial-subspace/conduit', () => ({
  ConduitSendError: class ConduitSendError extends Error {}
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {
    sessionConnection: {
      findFirst: vi.fn(async ({ where }: any) => {
        let rows = store
          .filter(row => matchesWhere(row, where))
          .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
        return rows[0] ? { ...rows[0] } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        let row = store.find(row => row.oid === where.oid);
        Object.assign(row, data);
        return { ...row };
      })
    },
    session: { updateMany: vi.fn(async (d: any) => sessionUpdates.push(d)) },
    sessionEvent: { createMany: vi.fn(async (d: any) => sessionEvents.push(d.data)) }
  },
  getId: vi.fn(() => ({ id: 'sev_1', oid: 1n })),
  ID: {},
  withTransaction: vi.fn()
}));
vi.mock('@metorial/module-rate-limit', () => ({
  rateLimitService: { consume: vi.fn() }
}));
vi.mock('@metorial-subspace/module-agent', () => ({}));
vi.mock('@metorial-subspace/module-callback', () => ({ callbackEventService: {} }));
vi.mock('@metorial-subspace/module-enclave', () => ({}));
vi.mock('@metorial-subspace/module-provider-internal', () => ({}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: vi.fn(),
  parseNameFromSessionProviderTemplates: vi.fn(() => null),
  sessionProviderNameTemplateService: {}
}));
vi.mock('@metorial-subspace/module-session/src/services/ephemeralManagedSession', () => ({
  ephemeralManagedSessionService: {}
}));
vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));
vi.mock('../lib/conduit', () => ({
  conduit: { createSender: vi.fn(() => ({})) }
}));
vi.mock('../lib/nats', () => ({ broadcastNats: vi.fn() }));
vi.mock('../audit/recordMessage', () => ({ recordConnectionAuditEvent: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: vi.fn() }));
vi.mock('../shared/createError', () => ({ createError: vi.fn() }));
vi.mock('../shared/createMessage', () => ({ createMessage: vi.fn() }));
vi.mock('../shared/createWarning', () => ({ createWarning: vi.fn() }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: vi.fn() }));
vi.mock('./connectionSpecification', () => ({
  isConnectionScopedProviderVersion: vi.fn(),
  resolveConnectionScopedSpecification: vi.fn()
}));
vi.mock('./toolSpecification', () => ({
  resolveProviderToolListingSpecificationOid: vi.fn()
}));

import { SenderManager } from './manager';

let HOUR_MS = 60 * 60 * 1000;

let session = {
  oid: 10n,
  isInternal: false,
  adapterGlobalOid: null,
  tenantOid: 1n,
  projectOid: 1n,
  solutionOid: 1,
  environmentOid: 1n,
  instanceOid: 1n
};

let initializeCalls: any[] = [];

let createManager = () => {
  let manager = new (SenderManager as any)(
    session,
    undefined,
    {},
    {},
    'mcp',
    undefined,
    undefined
  ) as any;

  manager.initialize = vi.fn(async (d: any) => {
    initializeCalls.push(d);
    await new Promise(resolve => setTimeout(resolve, 5));

    let now = new Date();
    let row = {
      oid: BigInt(store.length + 1),
      id: `scon_${store.length + 1}`,
      sessionOid: session.oid,
      isInternal: false,
      adapterGlobalOid: null,
      transport: 'mcp',
      status: 'active',
      state: 'connected',
      isManuallyDisabled: false,
      mcpTransport: d.mcpTransport,
      mcpClientKey: d.mcpClientKey,
      mcpProtocolVersion: d.mcpProtocolVersion,
      mcpData: { capabilities: d.mcpCapabilities, protocolVersion: d.mcpProtocolVersion },
      expiresAt: d.expiresAt,
      lastActiveAt: now
    };
    store.push(row);
    manager.connection = { ...row };
    return { ...row };
  });

  return manager as SenderManager & { initialize: ReturnType<typeof vi.fn> };
};

let request = (clientKey = 'key_1', capabilities: Record<string, any> = {}) => ({
  clientKey,
  client: { identifier: 'ExampleClient@1.0.0', name: 'ExampleClient', version: '1.0.0' },
  mcpCapabilities: capabilities,
  mcpProtocolVersion: '2026-07-28'
});

describe('SenderManager.resolveSessionlessConnection', () => {
  beforeEach(() => {
    store.length = 0;
    sessionUpdates.length = 0;
    sessionEvents.length = 0;
    initializeCalls = [];
  });

  it('creates a 24h sessionless connection for a new client', async () => {
    let before = Date.now();
    let connection = await createManager().resolveSessionlessConnection(request());

    expect(connection.id).toBe('scon_1');
    expect(initializeCalls).toHaveLength(1);
    expect(initializeCalls[0]).toMatchObject({
      mcpTransport: 'sessionless',
      mcpClientKey: 'key_1',
      mcpProtocolVersion: '2026-07-28',
      client: { identifier: 'ExampleClient@1.0.0', name: 'ExampleClient' }
    });

    let lifetimeMs = initializeCalls[0].expiresAt.getTime() - before;
    expect(lifetimeMs).toBeGreaterThanOrEqual(24 * HOUR_MS);
    expect(lifetimeMs).toBeLessThan(24 * HOUR_MS + 60_000);
  });

  it('reuses the connection for the same client and bumps lastActiveAt', async () => {
    let first = await createManager().resolveSessionlessConnection(request());
    store[0].lastActiveAt = new Date(Date.now() - HOUR_MS);

    let manager = createManager();
    let second = await manager.resolveSessionlessConnection(request());

    expect(second.oid).toBe(first.oid);
    expect(initializeCalls).toHaveLength(1);
    expect(store[0].lastActiveAt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(manager.connection?.oid).toBe(first.oid);
  });

  it('gives a different client key its own connection', async () => {
    let first = await createManager().resolveSessionlessConnection(request('key_1'));
    let second = await createManager().resolveSessionlessConnection(request('key_2'));

    expect(second.oid).not.toBe(first.oid);
    expect(initializeCalls).toHaveLength(2);
  });

  it('rotates to a new connection after more than 5h idle', async () => {
    let first = await createManager().resolveSessionlessConnection(request());
    store[0].lastActiveAt = new Date(Date.now() - 5 * HOUR_MS - 60_000);

    let second = await createManager().resolveSessionlessConnection(request());

    expect(second.oid).not.toBe(first.oid);
    expect(initializeCalls).toHaveLength(2);
  });

  it('rotates to a new connection after the 24h hard limit', async () => {
    let first = await createManager().resolveSessionlessConnection(request());
    store[0].expiresAt = new Date(Date.now() - 1000);

    let second = await createManager().resolveSessionlessConnection(request());

    expect(second.oid).not.toBe(first.oid);
  });

  it('creates exactly one connection for concurrent first requests', async () => {
    let results = await Promise.all(
      Array.from({ length: 5 }, () => createManager().resolveSessionlessConnection(request()))
    );

    expect(initializeCalls).toHaveLength(1);
    expect(new Set(results.map(result => result.oid)).size).toBe(1);
  });

  it('reconnects a disconnected connection and refreshes changed capabilities', async () => {
    await createManager().resolveSessionlessConnection(request());
    store[0].state = 'disconnected';

    await createManager().resolveSessionlessConnection(
      request('key_1', { elicitation: { form: {} } })
    );

    expect(store[0].state).toBe('connected');
    expect(store[0].mcpData.capabilities).toEqual({ elicitation: { form: {} } });
    expect(sessionUpdates).toHaveLength(1);
    expect(sessionEvents[0]).toMatchObject({ type: 'connection_connected' });
  });
});
