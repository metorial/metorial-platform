import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionError: {
      create: vi.fn()
    }
  },
  getId: vi.fn(() => ({ id: 'serr_test' })),
  createErrorQueue: {
    add: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: mocks.getId
}));

vi.mock('../queues/error/createError', () => ({
  createErrorQueue: mocks.createErrorQueue
}));

import { createError } from './createError';

let session = {
  oid: 1n,
  tenantOid: 10n,
  projectOid: 11n,
  environmentOid: 20n,
  instanceOid: 21n,
  solutionOid: 30n
} as any;

let unlinkedSession = {
  oid: 1n,
  tenantOid: 10n,
  projectOid: null,
  environmentOid: 20n,
  instanceOid: null,
  solutionOid: 30n
} as any;

let output = {
  type: 'error' as const,
  data: { code: 'timeout', message: 'The provider timed out.' }
};

describe('createError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getId.mockReturnValue({ id: 'serr_test' });
    mocks.createErrorQueue.add.mockResolvedValue(undefined);
    mocks.db.sessionError.create.mockImplementation(async (args: any) => ({
      ...args.data,
      oid: 600n,
      id: 'serr_created'
    }));
  });

  it('double-writes the mirrored oids from the session', async () => {
    await createError({
      session,
      connection: null,
      type: 'message_processing_timeout',
      output
    });

    let { data } = mocks.db.sessionError.create.mock.calls[0]![0];

    expect(data.tenantOid).toBe(10n);
    expect(data.projectOid).toBe(11n);
    expect(data.environmentOid).toBe(20n);
    expect(data.instanceOid).toBe(21n);
  });

  it('writes null mirrored oids for an unlinked tenant and environment', async () => {
    await createError({
      session: unlinkedSession,
      connection: null,
      type: 'message_processing_timeout',
      output
    });

    let { data } = mocks.db.sessionError.create.mock.calls[0]![0];

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.tenantOid).toBe(10n);
    expect(data.environmentOid).toBe(20n);
  });
});
