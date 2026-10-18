import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionMessage: {
      create: vi.fn(),
      updateMany: vi.fn()
    },
    sessionEvent: {
      createMany: vi.fn()
    }
  },
  getId: vi.fn(() => ({ id: 'test_id' })),
  sessionMessageBucketRecord: { oid: 900n },
  offloadWithRetry: vi.fn(),
  captureException: vi.fn(),
  messageCreatedQueue: {
    add: vi.fn()
  },
  createError: vi.fn(),
  messageFailureReasonToErrorType: vi.fn(() => 'message_processing_provider_error')
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: mocks.getId,
  Prisma: { DbNull: Symbol('DbNull') }
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

vi.mock('@metorial-subspace/connection-utils', () => ({
  offload: { offloadSessionMessageWithRetry: mocks.offloadWithRetry },
  getJsonSizeBytes: (value: unknown) =>
    value == null ? 0 : Buffer.byteLength(JSON.stringify(value)),
  sessionMessageBucketRecord: mocks.sessionMessageBucketRecord
}));

vi.mock('../queues/message/messageCreated', () => ({
  messageCreatedQueue: mocks.messageCreatedQueue
}));

vi.mock('./createError', () => ({
  createError: mocks.createError,
  messageFailureReasonToErrorType: mocks.messageFailureReasonToErrorType
}));

import { Prisma } from '@metorial-subspace/db';
import { createMessage, DIRECT_OFFLOAD_MIN_BYTES } from './createMessage';

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
    mocks.offloadWithRetry.mockResolvedValue(undefined);
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

    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'message_created',
          tenantOid: 10n,
          projectOid: 11n,
          environmentOid: 20n,
          instanceOid: 21n
        })
      ]
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
      data: [
        expect.objectContaining({
          projectOid: null,
          instanceOid: null
        })
      ]
    });
  });

  it('writes the created and processed events in one insert for a completed message', async () => {
    await createMessage({
      ...baseProps,
      status: 'succeeded',
      output: { type: 'tool.result', data: {} } as any,
      responderParticipant: { oid: 401n } as any,
      session,
      tool
    });

    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ type: 'message_created' }),
        expect.objectContaining({ type: 'message_processed' })
      ]
    });
  });
  describe('direct offload of control messages', () => {
    let big = { type: 'mcp', data: { result: 'x'.repeat(DIRECT_OFFLOAD_MIN_BYTES) } } as any;
    let controlProps = {
      ...baseProps,
      type: 'mcp_control' as const,
      status: 'succeeded' as const,
      responderParticipant: { oid: 401n } as any,
      input: { type: 'mcp', data: { method: 'tools/list' } } as any,
      session
    };

    it('stores large control responses in storage instead of the database', async () => {
      let message = await createMessage({ ...controlProps, output: big });

      let { data } = mocks.db.sessionMessage.create.mock.calls[0]![0];
      expect(data.isOffloadedToStorage).toBe(true);
      expect(data.input).toBe(Prisma.DbNull);
      expect(data.output).toBe(Prisma.DbNull);
      expect(data.outputSize).toBeGreaterThanOrEqual(DIRECT_OFFLOAD_MIN_BYTES);

      expect(mocks.offloadWithRetry).toHaveBeenCalledWith({
        id: 'msg_created',
        input: controlProps.input,
        output: big
      });
      expect(message.output).toBe(big);
    });

    it('keeps small control responses in the database', async () => {
      await createMessage({
        ...controlProps,
        output: { type: 'mcp', data: { result: {} } } as any
      });

      let { data } = mocks.db.sessionMessage.create.mock.calls[0]![0];
      expect(data.isOffloadedToStorage).toBe(false);
      expect(data.output).not.toBe(Prisma.DbNull);
      expect(mocks.offloadWithRetry).not.toHaveBeenCalled();
    });

    it('keeps large tool calls in the database', async () => {
      await createMessage({
        ...controlProps,
        type: 'tool_call',
        output: big
      });

      expect(mocks.db.sessionMessage.create.mock.calls[0]![0].data.isOffloadedToStorage).toBe(
        false
      );
      expect(mocks.offloadWithRetry).not.toHaveBeenCalled();
    });

    it('puts the body back into the database when the storage write fails', async () => {
      let error = new Error('storage down');
      mocks.offloadWithRetry.mockRejectedValue(error);
      mocks.db.sessionMessage.updateMany.mockResolvedValue({ count: 1 });

      await expect(createMessage({ ...controlProps, output: big })).resolves.toBeDefined();
      await vi.waitFor(() => expect(mocks.db.sessionMessage.updateMany).toHaveBeenCalled());

      expect(mocks.captureException).toHaveBeenCalledWith(error);
      expect(mocks.db.sessionMessage.updateMany).toHaveBeenCalledWith({
        where: { oid: 500n },
        data: { input: controlProps.input, output: big, isOffloadedToStorage: false }
      });
    });
  });
});
