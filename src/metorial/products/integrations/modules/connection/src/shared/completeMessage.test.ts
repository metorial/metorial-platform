import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionMessage: {
      findFirstOrThrow: vi.fn(),
      update: vi.fn()
    },
    sessionEvent: {
      updateMany: vi.fn(),
      createMany: vi.fn()
    },
    $transaction: vi.fn()
  },
  finalizeMessageQueue: {
    add: vi.fn()
  },
  createError: vi.fn(),
  messageFailureReasonToErrorType: vi.fn(() => 'message_processing_timeout'),
  getId: vi.fn(() => ({ id: 'sessionEvent_test', oid: 100n })),
  getRawToolCallAttachmentsFromOutput: vi.fn(() => []),
  presentToolCallAttachment: vi.fn((attachment: unknown) => attachment),
  replaceToolCallAttachmentsInOutput: vi.fn((output: unknown) => output)
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: mocks.getId,
  getRawToolCallAttachmentsFromOutput: mocks.getRawToolCallAttachmentsFromOutput,
  presentToolCallAttachment: mocks.presentToolCallAttachment,
  replaceToolCallAttachmentsInOutput: mocks.replaceToolCallAttachmentsInOutput
}));

vi.mock('../queues/message/finalizeMessage', () => ({
  finalizeMessageQueue: mocks.finalizeMessageQueue
}));

vi.mock('./createError', () => ({
  createError: mocks.createError,
  messageFailureReasonToErrorType: mocks.messageFailureReasonToErrorType
}));

import { completeMessage } from './completeMessage';

describe('completeMessage', () => {
  beforeEach(() => {
    mocks.db.sessionEvent.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionEvent.createMany.mockResolvedValue(undefined);
    mocks.finalizeMessageQueue.add.mockResolvedValue(undefined);
    mocks.createError.mockReset();
    mocks.messageFailureReasonToErrorType.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing message when another worker already completed it', async () => {
    let currentMessage = {
      id: 'msg_current',
      oid: 1n,
      session: { oid: 11n },
      connection: { oid: 12n },
      toolCall: null
    };
    let completedMessage = {
      id: 'msg_current',
      oid: 1n,
      status: 'failed',
      output: {
        type: 'error',
        data: { code: 'timeout', message: 'The request exceeded the tenant timeout.' }
      },
      completedAt: new Date(),
      providerRunOid: null,
      connectionOid: 12n,
      sessionOid: 11n,
      tenantOid: 13n,
      solutionOid: 14n,
      environmentOid: 15n,
      errorOid: 16n,
      toolCall: null
    };
    let tx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(completedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };

    mocks.db.sessionMessage.findFirstOrThrow.mockResolvedValue(currentMessage);
    mocks.db.$transaction.mockImplementation(async cb => await cb(tx));

    let message = await completeMessage(
      { messageId: 'msg_current' },
      {
        status: 'failed',
        failureReason: 'timeout',
        responderParticipant: { oid: 99n } as any,
        completedAt: new Date(),
        output: {
          type: 'error',
          data: { code: 'timeout', message: 'The conduit request timed out before the provider responded.' }
        }
      }
    );

    expect(message).toBe(completedMessage);
    expect(mocks.createError).not.toHaveBeenCalled();
    expect(mocks.db.sessionMessage.update).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.createMany).not.toHaveBeenCalled();
    expect(mocks.finalizeMessageQueue.add).not.toHaveBeenCalled();
  });

  it('creates a session error only after winning the state transition', async () => {
    let currentMessage = {
      id: 'msg_transition',
      oid: 2n,
      session: { oid: 21n, tenantOid: 23n, solutionOid: 24n, environmentOid: 25n },
      connection: { oid: 22n },
      toolCall: null
    };
    let transitionedMessage = {
      id: 'msg_transition',
      oid: 2n,
      status: 'failed',
      output: {
        type: 'error',
        data: { code: 'timeout', message: 'The request exceeded the tenant timeout.' }
      },
      completedAt: new Date(),
      providerRunOid: 31n,
      connectionOid: 22n,
      sessionOid: 21n,
      tenantOid: 23n,
      projectOid: 26n,
      solutionOid: 24n,
      environmentOid: 25n,
      instanceOid: 27n,
      errorOid: null,
      toolCall: null
    };
    let finalMessage = {
      ...transitionedMessage,
      errorOid: 32n
    };
    let tx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(transitionedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };

    mocks.db.sessionMessage.findFirstOrThrow.mockResolvedValue(currentMessage);
    mocks.db.$transaction.mockImplementation(async cb => await cb(tx));
    mocks.createError.mockResolvedValue({ oid: 32n });
    mocks.db.sessionMessage.update.mockResolvedValue(finalMessage);

    let message = await completeMessage(
      { messageId: 'msg_transition' },
      {
        status: 'failed',
        failureReason: 'timeout',
        responderParticipant: { oid: 99n } as any,
        completedAt: new Date(),
        providerRun: { oid: 31n } as any,
        output: {
          type: 'error',
          data: { code: 'timeout', message: 'The conduit request timed out before the provider responded.' }
        }
      }
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(message).toBe(finalMessage);
    expect(mocks.createError).toHaveBeenCalledTimes(1);
    expect(mocks.db.sessionMessage.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { errorOid: 32n },
      include: {
        toolCall: {
          include: {
            attachments: true
          }
        }
      }
    });
    expect(mocks.db.sessionEvent.updateMany).toHaveBeenCalled();
    expect(mocks.db.sessionEvent.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantOid: 23n,
        projectOid: 26n,
        environmentOid: 25n,
        instanceOid: 27n
      })
    });
    expect(mocks.finalizeMessageQueue.add).toHaveBeenCalledWith({ messageId: 'msg_transition' });
  });

  it('does not run post-transaction side effects after a retried transaction loses the race', async () => {
    let currentMessage = {
      id: 'msg_retry',
      oid: 3n,
      session: { oid: 31n },
      connection: { oid: 32n },
      toolCall: null
    };
    let completedMessage = {
      id: 'msg_retry',
      oid: 3n,
      status: 'failed',
      output: {
        type: 'error',
        data: { code: 'timeout', message: 'The request exceeded the tenant timeout.' }
      },
      completedAt: new Date(),
      providerRunOid: null,
      connectionOid: 32n,
      sessionOid: 31n,
      tenantOid: 33n,
      solutionOid: 34n,
      environmentOid: 35n,
      errorOid: 36n,
      toolCall: null
    };
    let firstAttemptTx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(completedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };
    let retriedAttemptTx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(completedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };

    mocks.db.sessionMessage.findFirstOrThrow.mockResolvedValue(currentMessage);
    mocks.db.$transaction.mockImplementation(async cb => {
      await cb(firstAttemptTx);
      return await cb(retriedAttemptTx);
    });

    let message = await completeMessage(
      { messageId: 'msg_retry' },
      {
        status: 'failed',
        failureReason: 'timeout',
        responderParticipant: { oid: 99n } as any,
        completedAt: new Date(),
        output: {
          type: 'error',
          data: { code: 'timeout', message: 'The conduit request timed out before the provider responded.' }
        }
      }
    );

    expect(message).toBe(completedMessage);
    expect(mocks.createError).not.toHaveBeenCalled();
    expect(mocks.db.sessionMessage.update).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.sessionEvent.createMany).not.toHaveBeenCalled();
    expect(mocks.finalizeMessageQueue.add).not.toHaveBeenCalled();
  });

  it('rehosts attachments and persists a ToolCallAttachment when storeToolCallAttachments is enabled', async () => {
    let rawAttachment = { url: 'https://provider.example/raw-file', mimeType: 'image/png', expiresAt: null };
    mocks.getRawToolCallAttachmentsFromOutput.mockReturnValueOnce([rawAttachment]);

    let currentMessage = {
      id: 'msg_attach_on',
      oid: 4n,
      session: { oid: 41n, dataRetentionLevel: 'full', storeToolCallAttachments: true, collectErrors: true },
      connection: { oid: 42n },
      toolCall: { oid: 43n }
    };
    let completedMessage = {
      id: 'msg_attach_on',
      oid: 4n,
      status: 'succeeded',
      toolCall: { oid: 43n, attachments: [] }
    };
    let tx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(completedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };

    mocks.db.sessionMessage.findFirstOrThrow.mockResolvedValue(currentMessage);
    mocks.db.$transaction.mockImplementation(async cb => await cb(tx));

    await completeMessage(
      { messageId: 'msg_attach_on' },
      {
        status: 'succeeded',
        responderParticipant: { oid: 99n } as any,
        output: { type: 'tool.result', data: {} } as any
      }
    );

    expect(mocks.replaceToolCallAttachmentsInOutput).toHaveBeenCalledWith(
      { type: 'tool.result', data: {} },
      [expect.objectContaining({ url: rawAttachment.url, toolCallOid: 43n })]
    );
    expect(tx.toolCallAttachment.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ url: rawAttachment.url, toolCallOid: 43n })]
    });
  });

  it('strips $attachments and skips persisting a ToolCallAttachment when storeToolCallAttachments is disabled', async () => {
    let rawAttachment = { url: 'https://provider.example/raw-file', mimeType: 'image/png', expiresAt: null };
    mocks.getRawToolCallAttachmentsFromOutput.mockReturnValueOnce([rawAttachment]);

    let currentMessage = {
      id: 'msg_attach_off',
      oid: 5n,
      session: { oid: 51n, dataRetentionLevel: 'full', storeToolCallAttachments: false, collectErrors: true },
      connection: { oid: 52n },
      toolCall: { oid: 53n }
    };
    let completedMessage = {
      id: 'msg_attach_off',
      oid: 5n,
      status: 'succeeded',
      toolCall: { oid: 53n, attachments: [] }
    };
    let tx = {
      sessionMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(completedMessage)
      },
      toolCall: {
        updateMany: vi.fn()
      },
      toolCallAttachment: {
        createMany: vi.fn()
      }
    };

    mocks.db.sessionMessage.findFirstOrThrow.mockResolvedValue(currentMessage);
    mocks.db.$transaction.mockImplementation(async cb => await cb(tx));

    await completeMessage(
      { messageId: 'msg_attach_off' },
      {
        status: 'succeeded',
        responderParticipant: { oid: 99n } as any,
        output: { type: 'tool.result', data: {} } as any
      }
    );

    expect(mocks.replaceToolCallAttachmentsInOutput).toHaveBeenCalledWith(
      { type: 'tool.result', data: {} },
      []
    );
    expect(tx.toolCallAttachment.createMany).not.toHaveBeenCalled();
  });
});
