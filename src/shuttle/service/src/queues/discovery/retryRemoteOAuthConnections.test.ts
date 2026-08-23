import { beforeEach, describe, expect, it, vi } from 'vitest';

let { queues, dbMock, runAutoRegistration, QueueRetryError } = vi.hoisted(() => ({
  queues: {} as Record<string, any>,
  QueueRetryError: class QueueRetryError extends Error {},
  dbMock: {
    serverOAuthCredentials: {
      findFirst: vi.fn()
    },
    remoteOAuthConnection: {
      findMany: vi.fn()
    }
  },
  runAutoRegistration: vi.fn()
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

vi.mock('@lowerdeck/cron', () => ({ createCron: () => ({}) }));

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: (_key: string, fn: () => Promise<unknown>) => fn() })
}));

vi.mock('../../db', () => ({ db: dbMock }));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../../id', () => ({ getId: () => ({ oid: 1n, id: 'event_id' }) }));

vi.mock('../../transaction', () => ({
  withTransaction: (cb: (db: unknown) => Promise<unknown>) => cb(dbMock)
}));

vi.mock('../../services/oauth/remote/connection', () => ({
  remoteOAuthConnectionService: { createConnection: vi.fn() }
}));

vi.mock('../../services/oauth/remote/registration', () => ({
  remoteOAuthRegistrationService: { runAutoRegistration }
}));

import './retryRemoteOAuthConnections';

let retryProcessor = () => queues['shut/rem-oaconn/retry/single'].processor;
let promoteQueue = () => queues['shut/rem-oaconn/rotate/promote'];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retryRegistrationQueueProcessor', () => {
  it('promotes a replacement that was registered by an earlier run of the job', async () => {
    // The job crashed after registering, so this run only sees the connection
    // as already registered.
    runAutoRegistration.mockResolvedValue({
      ok: false,
      reason: 'skipped',
      blocker: 'already_succeeded'
    });
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValue({ id: 'soc_replacement' });

    await retryProcessor()({ oauthConnectionId: 'cso_replacement' });

    expect(promoteQueue().add).toHaveBeenCalledWith(
      { newCredentialsId: 'soc_replacement' },
      expect.objectContaining({ delay: 5000 })
    );
  });

  it('promotes a replacement right after a successful registration', async () => {
    runAutoRegistration.mockResolvedValue({ ok: true });
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValue({ id: 'soc_replacement' });

    await retryProcessor()({ oauthConnectionId: 'cso_replacement' });

    expect(promoteQueue().add).toHaveBeenCalledWith(
      { newCredentialsId: 'soc_replacement' },
      expect.objectContaining({ delay: 5000 })
    );
  });

  it('does not promote connections that are not replacements', async () => {
    runAutoRegistration.mockResolvedValue({ ok: true });
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValue(null);

    await retryProcessor()({ oauthConnectionId: 'cso_plain' });

    expect(promoteQueue().add).not.toHaveBeenCalled();
  });

  it('retries transient registration failures', async () => {
    runAutoRegistration.mockResolvedValue({ ok: false, reason: 'failed', isTransient: true });
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValue(null);

    await expect(
      retryProcessor()({ oauthConnectionId: 'cso_replacement' })
    ).rejects.toBeInstanceOf(QueueRetryError);
  });
});
