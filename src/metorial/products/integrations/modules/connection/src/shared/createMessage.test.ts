import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionMessage: {
      create: vi.fn()
    },
    sessionEvent: {
      createMany: vi.fn()
    }
  },
  getId: vi.fn(() => ({ id: 'test_id' })),
  sessionMessageBucketRecord: { oid: 900n },
  messageCreatedQueue: {
    add: vi.fn()
  },
  createError: vi.fn(),
  messageFailureReasonToErrorType: vi.fn(() => 'message_processing_provider_error')
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: mocks.getId
}));

vi.mock('@metorial-subspace/connection-utils', () => ({
  sessionMessageBucketRecord: mocks.sessionMessageBucketRecord
}));

vi.mock('../queues/message/messageCreated', () => ({
  messageCreatedQueue: mocks.messageCreatedQueue
}));

vi.mock('./createError', () => ({
  createError: mocks.createError,
  messageFailureReasonToErrorType: mocks.messageFailureReasonToErrorType
}));

import { createMessage } from './createMessage';

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

let tool = { oid: 700n, key: 'search' } as any;

let baseProps = {
  status: 'waiting_for_response' as const,
  type: 'tool_call' as const,
  source: 'client' as const,
  senderParticipant: { oid: 400n } as any,
  transport: 'mcp' as const,
  input: { type: 'tool.call', data: {} } as any,
  isProductive: true,
  connection: null
};

describe('createMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getId.mockReturnValue({ id: 'test_id' });
    mocks.db.sessionEvent.createMany.mockResolvedValue(undefined);
    mocks.messageCreatedQueue.add.mockResolvedValue(undefined);
    mocks.db.sessionMessage.create.mockImplementation(async (args: any) => ({
      ...args.data,
      oid: 500n,
      id: 'msg_created',
      providerRunOid: null
    }));
  });

  it('double-writes the mirrored oids on the message', async () => {
    await createMessage({ ...baseProps, session });

    let { data } = mocks.db.sessionMessage.create.mock.calls[0]![0];

    expect(data.tenantOid).toBe(10n);
    expect(data.projectOid).toBe(11n);
    expect(data.environmentOid).toBe(20n);
    expect(data.instanceOid).toBe(21n);
  });

  it('double-writes the mirrored oids on the nested tool call', async () => {
    await createMessage({ ...baseProps, session, tool });

    let { data } = mocks.db.sessionMessage.create.mock.calls[0]![0];

    expect(data.toolCall.create).toEqual(
      expect.objectContaining({
        tenantOid: 10n,
        projectOid: 11n,
        environmentOid: 20n,
        instanceOid: 21n
      })
    );
  });

  it('copies the mirrored oids from the created message onto the session event', async () => {
    await createMessage({ ...baseProps, session });

    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'message_created',
        tenantOid: 10n,
        projectOid: 11n,
        environmentOid: 20n,
        instanceOid: 21n
      })
    });
  });

  it('writes null mirrored oids for an unlinked tenant and environment', async () => {
    await createMessage({ ...baseProps, session: unlinkedSession, tool });

    let { data } = mocks.db.sessionMessage.create.mock.calls[0]![0];

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.toolCall.create.projectOid).toBeNull();
    expect(data.toolCall.create.instanceOid).toBeNull();

    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectOid: null,
        instanceOid: null
      })
    });
  });
});
