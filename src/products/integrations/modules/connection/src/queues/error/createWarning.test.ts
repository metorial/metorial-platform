import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let handlerRef: { current: any } = { current: null };

  return {
    handlerRef,
    db: {
      sessionWarning: { findFirst: vi.fn() },
      session: { updateMany: vi.fn() },
      sessionConnection: { updateMany: vi.fn() },
      sessionEvent: { createMany: vi.fn() }
    }
  };
});

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class extends Error {},
  createQueue: () => ({
    process: (handler: any) => {
      mocks.handlerRef.current = handler;
      return { handler };
    }
  })
}));
vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: () => ({ id: 'sev_1', oid: 1n })
}));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));

import './createWarning';

describe('createWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.sessionWarning.findFirst.mockResolvedValue({
      oid: 9n,
      sessionOid: 1n,
      tenantOid: 2n,
      session: { hasWarnings: false, hasErrors: false },
      connection: { oid: 3n, hasWarnings: false, hasErrors: false }
    });
  });

  it('flags warnings, not errors, on the session and connection', async () => {
    await mocks.handlerRef.current({ warningId: 'swa_1' });

    expect(mocks.db.session.updateMany).toHaveBeenCalledWith({
      where: { oid: 1n, hasWarnings: false },
      data: { hasWarnings: true }
    });
    expect(mocks.db.sessionConnection.updateMany).toHaveBeenCalledWith({
      where: { oid: 3n, hasWarnings: false },
      data: { hasWarnings: true }
    });
  });
});
