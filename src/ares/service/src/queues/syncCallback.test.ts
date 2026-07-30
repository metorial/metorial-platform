import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, handlers, queueAdd, queueAddMany, afterTransactionHooks } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    ssoTenant: { findUnique: vi.fn(), update: vi.fn() },
    ssoConnection: { findUnique: vi.fn() },
    syncListener: { findMany: vi.fn(), findUnique: vi.fn() }
  },
  handlers: [] as ((input: any) => Promise<void>)[],
  queueAdd: vi.fn(),
  queueAddMany: vi.fn(),
  afterTransactionHooks: [] as (() => Promise<unknown>)[]
}));

vi.mock('@lowerdeck/queue', () => ({
  combineQueueProcessors: vi.fn(() => ({})),
  createQueue: vi.fn(() => ({
    add: queueAdd,
    addMany: queueAddMany,
    process: (handler: (input: any) => Promise<void>) => {
      handlers.push(handler);
      return {};
    }
  }))
}));

vi.mock('../db', () => ({
  db,
  withTransaction: vi.fn((handler: (transaction: typeof db) => Promise<unknown>) =>
    handler(db)
  ),
  addAfterTransactionHook: vi.fn((hook: () => Promise<unknown>) =>
    afterTransactionHooks.push(hook)
  )
}));

vi.mock('../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

import {
  markAresSsoTenantChanged,
  markAresSsoTenantChangedForConnection
} from './syncCallback';

let [fanoutHandler, deliveryHandler] = handlers;

let flushAfterTransactionHooks = async () => {
  let hooks = afterTransactionHooks.splice(0, afterTransactionHooks.length);
  for (let hook of hooks) await hook();
};

describe('ares sync fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterTransactionHooks.length = 0;
    db.ssoTenant.findUnique.mockResolvedValue({
      id: 'tenant_1',
      app: { id: 'app_1' }
    });
  });

  it('delivers sso_tenant.changed only to listeners subscribed to that event type', async () => {
    db.syncListener.findMany.mockResolvedValue([{ id: 'usl_cell_eu' }]);

    await fanoutHandler!({
      type: 'sso_tenant.changed',
      tenantId: 'tenant_1',
      revision: '4'
    });

    expect(db.syncListener.findMany).toHaveBeenCalledWith({
      where: { eventTypes: { has: 'sso_tenant.changed' } },
      select: { id: true }
    });
    expect(queueAddMany).toHaveBeenCalledWith([
      {
        listenerId: 'usl_cell_eu',
        event: {
          type: 'sso_tenant.changed',
          data: { appId: 'app_1', tenantId: 'tenant_1', revision: '4' }
        }
      }
    ]);
  });

  it('drops events for tenants that no longer exist', async () => {
    db.ssoTenant.findUnique.mockResolvedValue(null);

    await fanoutHandler!({
      type: 'sso_tenant.changed',
      tenantId: 'tenant_gone',
      revision: '1'
    });

    expect(db.syncListener.findMany).not.toHaveBeenCalled();
    expect(queueAddMany).not.toHaveBeenCalled();
  });

  it('signs the delivered body with the listener secret', async () => {
    db.syncListener.findUnique.mockResolvedValue({
      id: 'usl_cell_eu',
      identifier: 'cell:eu1',
      callbackUrl: 'https://cell.test/metorial-cell-ares/api',
      secret: 'shhh'
    });
    let fetchMock = vi.fn(async () => new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    let event = {
      type: 'sso_tenant.changed' as const,
      data: { appId: 'app_1', tenantId: 'tenant_1', revision: '4' }
    };
    await deliveryHandler!({ listenerId: 'usl_cell_eu', event });

    let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cell.test/metorial-cell-ares/api');
    expect(init.body).toBe(JSON.stringify(event));
    expect((init.headers as Record<string, string>)['ares-signature']).toMatch(
      /^t=\d+,v1=[a-f0-9]{64}$/
    );

    vi.unstubAllGlobals();
  });

  it('fails the delivery when the listener rejects the callback', async () => {
    db.syncListener.findUnique.mockResolvedValue({
      id: 'usl_cell_eu',
      identifier: 'cell:eu1',
      callbackUrl: 'https://cell.test/metorial-cell-ares/api',
      secret: 'shhh'
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    );

    await expect(
      deliveryHandler!({
        listenerId: 'usl_cell_eu',
        event: {
          type: 'sso_tenant.changed',
          data: { appId: 'app_1', tenantId: 'tenant_1', revision: '4' }
        }
      })
    ).rejects.toThrow('returned 500');

    vi.unstubAllGlobals();
  });
});

describe('ares tenant revision marking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterTransactionHooks.length = 0;
    db.ssoTenant.update.mockResolvedValue({ id: 'tenant_1', syncRevision: 7n });
  });

  it('increments the tenant revision and enqueues a deduplicated fanout job', async () => {
    await markAresSsoTenantChanged({ tenantOid: 3n });
    await flushAfterTransactionHooks();

    expect(db.ssoTenant.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { syncRevision: { increment: 1 } },
      select: { id: true, syncRevision: true }
    });
    expect(queueAdd).toHaveBeenCalledWith(
      { type: 'sso_tenant.changed', tenantId: 'tenant_1', revision: '7' },
      { id: 'tenant_1-7' }
    );
  });

  it('resolves the tenant through the connection for connection-scoped changes', async () => {
    db.ssoConnection.findUnique.mockResolvedValue({ tenantOid: 3n });

    await markAresSsoTenantChangedForConnection({ connectionOid: 2n });

    expect(db.ssoTenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 3n } })
    );
  });

  it('ignores connection-scoped changes for connections that are already gone', async () => {
    db.ssoConnection.findUnique.mockResolvedValue(null);

    await markAresSsoTenantChangedForConnection({ connectionOid: 2n });

    expect(db.ssoTenant.update).not.toHaveBeenCalled();
  });
});
