import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    sessionMessage: {
      create: vi.fn()
    },
    sessionEvent: {
      createMany: vi.fn()
    },
    sessionError: {
      create: vi.fn()
    },
    session: {
      updateMany: vi.fn()
    },
    sessionConnection: {
      updateMany: vi.fn()
    }
  },
  getId: vi.fn(() => ({ id: 'test_id' })),
  Prisma: { DbNull: 'DbNull' },
  sessionMessageBucketRecord: { oid: 900n },
  messageCreatedQueue: { add: vi.fn() },
  createErrorQueue: { add: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  getId: mocks.getId,
  Prisma: mocks.Prisma
}));

vi.mock('@metorial-subspace/connection-utils', () => ({
  sessionMessageBucketRecord: mocks.sessionMessageBucketRecord
}));

vi.mock('../queues/message/messageCreated', () => ({
  messageCreatedQueue: mocks.messageCreatedQueue
}));

vi.mock('../queues/error/createError', () => ({
  createErrorQueue: mocks.createErrorQueue
}));

import { createMessage } from './createMessage';
import { createError } from './createError';

let sessionAt = (
  dataRetentionLevel: string,
  opts: {
    storeToolCallAttachments?: boolean;
    collectErrors?: boolean;
    extra?: Record<string, unknown>;
  } = {}
) =>
  ({
    oid: 1n,
    tenantOid: 10n,
    projectOid: 11n,
    environmentOid: 20n,
    instanceOid: 21n,
    solutionOid: 30n,
    hasErrors: false,
    dataRetentionLevel,
    storeToolCallAttachments: opts.storeToolCallAttachments ?? true,
    collectErrors: opts.collectErrors ?? true,
    ...opts.extra
  }) as any;

let tool = { oid: 700n, key: 'search' } as any;

let baseProps = {
  status: 'waiting_for_response' as const,
  type: 'tool_call' as const,
  source: 'client' as const,
  senderParticipant: { oid: 400n } as any,
  transport: 'mcp' as const,
  input: { type: 'tool.call', data: { query: 'secret customer data' } } as any,
  isProductive: true,
  connection: null
};

let createdData = () => mocks.db.sessionMessage.create.mock.calls[0]![0].data;

describe('createMessage retention', () => {
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

  it('stores payloads, tool identity and the tool call at full', async () => {
    await createMessage({ ...baseProps, session: sessionAt('full'), tool });

    let data = createdData();
    expect(data.input).toEqual(baseProps.input);
    expect(data.retentionLevel).toBe('full');
    expect(data.methodOrToolKey).toBe('search');
    expect(data.toolCall.create).toBeDefined();
  });

  it('drops payloads but keeps tool identity at intent_only', async () => {
    await createMessage({
      ...baseProps,
      session: sessionAt('intent_only'),
      tool,
      rationale: 'needed to answer the question',
      operation: 'find the latest news'
    });

    let data = createdData();
    expect(data.input).toBe('DbNull');
    expect(data.output).toBe('DbNull');
    expect(data.retentionLevel).toBe('intent_only');

    // Intent survives: the tool name and the model-authored description.
    expect(data.methodOrToolKey).toBe('search');
    expect(data.toolCall.create.toolKey).toBe('search');
    expect(data.toolCall.create.rationale).toBe('needed to answer the question');
    expect(data.toolCall.create.operation).toBe('find the latest news');
  });

  it('drops payloads, tool identity and the tool call entirely at none', async () => {
    await createMessage({ ...baseProps, session: sessionAt('none'), tool });

    let data = createdData();
    expect(data.input).toBe('DbNull');
    expect(data.output).toBe('DbNull');
    expect(data.retentionLevel).toBe('none');
    expect(data.methodOrToolKey).toBeNull();

    // Omitted rather than written with null columns -- toolKey/toolOid are non-nullable and
    // the tool call presenter requires both.
    expect(data.toolCall).toBeUndefined();
  });

  it('records hasOutput for billing even when the payload is not stored', async () => {
    await createMessage({
      ...baseProps,
      session: sessionAt('none'),
      status: 'succeeded',
      output: { type: 'tool.result', data: {} } as any,
      responderParticipant: { oid: 401n } as any
    });

    let data = createdData();
    expect(data.output).toBe('DbNull');
    expect(data.hasOutput).toBe(true);
  });

  it('returns the in-memory payload so the live response still works', async () => {
    let output = { type: 'tool.result', data: { answer: 42 } } as any;

    let message = await createMessage({
      ...baseProps,
      session: sessionAt('none'),
      status: 'succeeded',
      output,
      responderParticipant: { oid: 401n } as any
    });

    // Nothing persisted, but the caller can still answer the client.
    expect(createdData().output).toBe('DbNull');
    expect(message.output).toEqual(output);
    expect(message.input).toEqual(baseProps.input);
  });
});

describe('createError retention', () => {
  let errorOutput = {
    type: 'error' as const,
    data: {
      code: 'rate_limited',
      message: 'Too many requests for user alice@example.com',
      retryAfterSeconds: 30,
      throttled: true,
      request: { userEmail: 'alice@example.com', attempts: 4 }
    }
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getId.mockReturnValue({ id: 'test_id' });
    mocks.createErrorQueue.add.mockResolvedValue(undefined);
    mocks.db.session.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionConnection.updateMany.mockResolvedValue(undefined);
    mocks.db.sessionError.create.mockImplementation(async (args: any) => ({
      ...args.data,
      oid: 800n,
      id: 'err_created'
    }));
  });

  it('stores the raw payload at full, even if collectErrors is (incorrectly) set false', async () => {
    await createError({
      session: sessionAt('full', { collectErrors: false }),
      connection: null,
      type: 'message_processing_provider_error',
      output: errorOutput
    });

    let { data } = mocks.db.sessionError.create.mock.calls[0]![0];
    expect(data.code).toBe('rate_limited');
    expect(data.payload).toEqual(errorOutput.data);
  });

  it('stores real code and message but a redacted-shape payload at intent_only', async () => {
    await createError({
      session: sessionAt('intent_only', { collectErrors: true }),
      connection: null,
      type: 'message_processing_provider_error',
      output: errorOutput
    });

    let { data } = mocks.db.sessionError.create.mock.calls[0]![0];
    expect(data.code).toBe('rate_limited');
    expect(data.message).toBe('Too many requests for user alice@example.com');

    // Shape preserved, every leaf value replaced by its type.
    expect(data.payload).toEqual({
      code: 'Redacted[string]',
      message: 'Redacted[string]',
      retryAfterSeconds: 'Redacted[number]',
      throttled: 'Redacted[boolean]',
      request: { userEmail: 'Redacted[string]', attempts: 'Redacted[number]' }
    });
  });

  it('stores a redacted payload at none when error collection is explicitly enabled', async () => {
    await createError({
      session: sessionAt('none', { collectErrors: true }),
      connection: null,
      type: 'message_processing_provider_error',
      output: errorOutput
    });

    let { data } = mocks.db.sessionError.create.mock.calls[0]![0];
    expect(data.code).toBe('rate_limited');
    expect(data.payload.request).toEqual({
      userEmail: 'Redacted[string]',
      attempts: 'Redacted[number]'
    });
  });

  it('creates no error row at all when error collection is turned off', async () => {
    let result = await createError({
      session: sessionAt('intent_only', { collectErrors: false }),
      connection: null,
      type: 'message_processing_provider_error',
      output: errorOutput
    });

    expect(result).toBeUndefined();
    expect(mocks.db.sessionError.create).not.toHaveBeenCalled();
    expect(mocks.createErrorQueue.add).not.toHaveBeenCalled();
  });

  it('still flags hasErrors when error collection is off, since that signal carries no content', async () => {
    await createError({
      session: sessionAt('none', { collectErrors: false }),
      connection: { oid: 60n, hasErrors: false } as any,
      type: 'message_processing_provider_error',
      output: errorOutput
    });

    expect(mocks.db.session.updateMany).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { hasErrors: true }
    });
    expect(mocks.db.sessionConnection.updateMany).toHaveBeenCalledWith({
      where: { oid: 60n },
      data: { hasErrors: true }
    });
  });
});
