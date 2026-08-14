import { subDays, subHours } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { queues, dbMock, createConnection, QueueRetryError } = vi.hoisted(() => ({
  queues: {} as Record<string, any>,
  QueueRetryError: class QueueRetryError extends Error {},
  dbMock: {
    serverOAuthCredentials: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    remoteOAuthConnection: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    remoteOAuthConfig: {
      findUniqueOrThrow: vi.fn()
    },
    remoteOAuthConnectionEvent: {
      upsert: vi.fn()
    }
  },
  createConnection: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError,
  createQueue: (opts: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      }),
      processor: undefined as any
    };
    queues[opts.name] = queue;
    return queue;
  }
}));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: (_key: string, fn: (controller: { passForNow: () => void }) => Promise<unknown>) =>
      fn({ passForNow: () => {} })
  })
}));

vi.mock('../../db', () => ({ db: dbMock }));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../id', () => ({
  getId: () => ({ oid: 1n, id: 'event_id' })
}));

vi.mock('../../transaction', () => ({
  withTransaction: (cb: (db: unknown) => Promise<unknown>) => cb(dbMock)
}));

vi.mock('../../services/oauth/remote/connection', () => ({
  remoteOAuthConnectionService: { createConnection }
}));

import './rotateRemoteCredentials';

let rotateProcessor = () => queues['shut/rem-oaconn/rotate/single'].processor;
let promoteProcessor = () => queues['shut/rem-oaconn/rotate/promote'].processor;
let promoteQueue = () => queues['shut/rem-oaconn/rotate/promote'];

let previousCredentials = (registrationCreatedAt: Date) => ({
  oid: 100n,
  id: 'soc_previous',
  isDefault: true,
  tenantOid: 2n,
  serverOid: 3n,
  tenant: { oid: 2n, id: 'ten_test' },
  server: { oid: 3n, id: 'srv_test', remoteOauthConfigOid: 4n },
  remoteConnection: {
    oid: 10n,
    id: 'cso_previous',
    status: 'active',
    discoveryStatus: 'succeeded',
    secretOid: null,
    registrationOid: 20n,
    scopes: ['openid'],
    registration: { oid: 20n, createdAt: registrationCreatedAt }
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rotateStaleCredentialsQueueProcessor', () => {
  it('replaces a stale registration with a new connection', async () => {
    let credentials = previousCredentials(subDays(new Date(), 5));

    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(credentials)
      .mockResolvedValueOnce(credentials);
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue(null);
    dbMock.remoteOAuthConfig.findUniqueOrThrow.mockResolvedValue({
      oid: 4n,
      discoverStatus: 'supports_auto_registration'
    });
    createConnection.mockResolvedValue({
      oid: 11n,
      id: 'cso_replacement',
      serverOAuthCredentials: { oid: 101n, id: 'soc_replacement' }
    });

    await rotateProcessor()({ credentialsId: 'soc_previous' });

    expect(createConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ scopes: ['openid'] })
      })
    );
    expect(promoteQueue().add).toHaveBeenCalledWith(
      { newCredentialsId: 'soc_replacement', previousCredentialsId: 'soc_previous' },
      expect.objectContaining({ delay: 5000 })
    );
  });

  it('leaves recent registrations alone', async () => {
    let credentials = previousCredentials(subHours(new Date(), 6));

    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(credentials)
      .mockResolvedValueOnce(credentials);

    await rotateProcessor()({ credentialsId: 'soc_previous' });

    expect(createConnection).not.toHaveBeenCalled();
    expect(promoteQueue().add).not.toHaveBeenCalled();
  });

  it('skips when a replacement is already in flight', async () => {
    let credentials = previousCredentials(subDays(new Date(), 5));

    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(credentials)
      .mockResolvedValueOnce(credentials);
    dbMock.remoteOAuthConnection.findFirst.mockResolvedValue({ oid: 11n });

    await rotateProcessor()({ credentialsId: 'soc_previous' });

    expect(createConnection).not.toHaveBeenCalled();
  });

  it('does not replace manually configured credentials', async () => {
    let credentials = previousCredentials(subDays(new Date(), 5));
    credentials.remoteConnection.secretOid = 9n as any;

    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(credentials)
      .mockResolvedValueOnce(credentials);

    await rotateProcessor()({ credentialsId: 'soc_previous' });

    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe('promoteRotatedCredentialsQueueProcessor', () => {
  let newCredentials = (discoveryStatus: string, registrationAttemptCount = 1) => ({
    oid: 101n,
    id: 'soc_replacement',
    tenantOid: 2n,
    serverOid: 3n,
    remoteConnection: {
      oid: 11n,
      id: 'cso_replacement',
      status: 'active',
      discoveryStatus,
      registrationAttemptCount,
      clientId: 'new-client-id',
      errorCode: 'auto_registration_failed',
      errorMessage: 'nope'
    }
  });

  it('waits while the replacement is still registering', async () => {
    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(newCredentials('discovering'))
      .mockResolvedValueOnce(previousCredentials(subDays(new Date(), 5)));

    await expect(
      promoteProcessor()({
        newCredentialsId: 'soc_replacement',
        previousCredentialsId: 'soc_previous'
      })
    ).rejects.toBeInstanceOf(QueueRetryError);

    expect(dbMock.serverOAuthCredentials.update).not.toHaveBeenCalled();
    expect(dbMock.serverOAuthCredentials.updateMany).not.toHaveBeenCalled();
  });

  it('keeps waiting while only transient failures were recorded', async () => {
    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(newCredentials('failed', 0))
      .mockResolvedValueOnce(previousCredentials(subDays(new Date(), 5)));

    await expect(
      promoteProcessor()({
        newCredentialsId: 'soc_replacement',
        previousCredentialsId: 'soc_previous'
      })
    ).rejects.toBeInstanceOf(QueueRetryError);

    expect(dbMock.remoteOAuthConnection.updateMany).not.toHaveBeenCalled();
  });

  it('promotes the replacement once registration succeeded', async () => {
    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(newCredentials('succeeded'))
      .mockResolvedValueOnce(previousCredentials(subDays(new Date(), 5)));

    await promoteProcessor()({
      newCredentialsId: 'soc_replacement',
      previousCredentialsId: 'soc_previous'
    });

    expect(dbMock.serverOAuthCredentials.updateMany).toHaveBeenCalledWith({
      where: {
        tenantOid: 2n,
        serverOid: 3n,
        isDefault: true,
        oid: { not: 101n }
      },
      data: { isDefault: false }
    });
    expect(dbMock.serverOAuthCredentials.update).toHaveBeenCalledWith({
      where: { oid: 101n },
      data: { isDefault: true }
    });
    // The replaced connection stays active so its auth configs keep refreshing.
    expect(dbMock.remoteOAuthConnection.updateMany).not.toHaveBeenCalled();
    expect(dbMock.remoteOAuthConnectionEvent.upsert).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous default when the replacement fails to register', async () => {
    dbMock.serverOAuthCredentials.findUnique
      .mockResolvedValueOnce(newCredentials('failed'))
      .mockResolvedValueOnce(previousCredentials(subDays(new Date(), 5)));

    await promoteProcessor()({
      newCredentialsId: 'soc_replacement',
      previousCredentialsId: 'soc_previous'
    });

    expect(dbMock.serverOAuthCredentials.update).not.toHaveBeenCalled();
    expect(dbMock.serverOAuthCredentials.updateMany).not.toHaveBeenCalled();
    expect(dbMock.remoteOAuthConnection.updateMany).toHaveBeenCalledWith({
      where: { oid: 11n, status: 'active' },
      data: { status: 'inactive' }
    });
    expect(dbMock.remoteOAuthConnectionEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          connectionOid: 10n,
          type: 'credentials_rotated'
        })
      })
    );
  });
});
