import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enrichMessages, getProviderTelemetryErrorGroupsStorageTarget } = vi.hoisted(() => ({
  db: {
    sessionError: {
      findMany: vi.fn()
    }
  },
  enrichMessages: vi.fn(async (messages: any[]) => messages),
  getProviderTelemetryErrorGroupsStorageTarget: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/connection-utils', () => ({
  getOffloadedSessionMessage: vi.fn(),
  getProviderTelemetryErrorGroupsStorageTarget
}));
vi.mock('../services/sessionMessage', () => ({
  sessionMessageService: {
    enrichMessages
  }
}));

import {
  PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY,
  anonymizeProviderTelemetryExportValue,
  getProviderTelemetryFailedMessagesExportChunkKey,
  listProviderTelemetryFailedMessagesForExport,
  runProviderTelemetryErrorGroupsExport,
  type ProviderTelemetryErrorGroupsExportState,
  type ProviderTelemetryFailedMessageExportCandidate,
  type ProviderTelemetryFailedMessagesExportListInput
} from './providerTelemetryErrorGroupExport';

let createStorage = (state?: ProviderTelemetryErrorGroupsExportState | null) => ({
  upsertBucket: vi.fn(async (_bucket: string) => ({})),
  getObject: vi.fn(async (_bucket: string, key: string) => {
    if (key !== PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY || state === undefined) {
      throw { statusCode: 404 };
    }

    return { data: Buffer.from(JSON.stringify(state)) };
  }),
  putObject: vi.fn(
    async (
      _bucket: string,
      _key: string,
      _data: Buffer | Uint8Array | Blob | ReadableStream | string,
      _contentType?: string,
      _metadata?: Record<string, string>
    ) => ({})
  )
});

let createCandidate = (
  input: Partial<{
    errorId: string;
    groupId: string;
    messageId: string;
    occurredAt: string;
    providerSlug: string;
    providerName: string;
    messageType: string;
    toolKey: string | null;
    toolNativeKey: string;
    toolName: string;
    methodOrToolKey: string | null;
  }> = {}
): ProviderTelemetryFailedMessageExportCandidate => {
  let occurredAt = new Date(input.occurredAt ?? '2026-06-18T00:10:00.000Z');
  let toolKey = input.toolKey === undefined ? 'users.info' : input.toolKey;
  let toolNativeKey = input.toolNativeKey ?? toolKey ?? 'unknown_tool';
  let toolName = input.toolName ?? 'Users Info';

  return {
    error: {
      id: input.errorId ?? 'serr_1',
      code: 'provider_error',
      group: {
        id: input.groupId ?? 'serg_1'
      }
    },
    message: {
      id: input.messageId ?? 'msg_1',
      type: input.messageType ?? 'tool_call',
      methodOrToolKey: input.methodOrToolKey ?? 'fallback_method',
      toolCall: toolKey
        ? {
            id: `tc_${input.messageId ?? '1'}`,
            toolKey,
            tool: {
              key: toolNativeKey,
              name: toolName
            }
          }
        : null
    },
    occurredAt,
    provider: {
      id: 'prv_1',
      name: input.providerName ?? 'Slack',
      slug: input.providerSlug ?? 'slack'
    },
    tool: toolKey
      ? {
          id: `tc_${input.messageId ?? '1'}`,
          key: toolKey,
          name: toolName
        }
      : null
  };
};

let parseJsonCall = (call: any[]) => JSON.parse(call[2]);

let createPresentedMessage = (candidate: ProviderTelemetryFailedMessageExportCandidate) => ({
  object: 'session.message',
  id: candidate.message.id,
  type: candidate.message.type,
  status: 'failed',
  source: 'model',
  input: {
    data: {
      email: 'alice@example.com',
      token: 'secret-token',
      query: 'https://api.example.com/callback?client_secret=top-secret&safe=yes',
      retryCount: 2,
      ok: false,
      missing: null
    }
  },
  output: {
    jsonrpc: '2.0',
    id: 1,
    error: {
      code: -32000,
      message: 'Tool call failed',
      data: {
        ok: false,
        code: 'PROVIDER_ERROR',
        message: 'Nested provider message',
        details: {
          Message: 'Case-insensitive message'
        }
      }
    }
  },
  toolCall: candidate.tool
    ? {
        id: candidate.tool.id,
        toolKey: candidate.tool.key,
        rationale: 'User asked for this tool',
        operation: 'call_tool',
        tool: {
          id: 'tool_1',
          key: candidate.tool.key,
          name: candidate.tool.name,
          providerId: candidate.provider?.id ?? null
        }
      }
    : null,
  error: {
    id: candidate.error.id,
    code: candidate.error.code,
    message: 'Top-level provider error',
    data: {
      authorization: 'Bearer abc123',
      code: 'PROVIDER_ERROR',
      object: 'provider.error',
      status: 500,
      message: 'Failed for bob@example.com',
      nested: {
        MESSAGE: 'Uppercase message key'
      }
    },
    groupId: candidate.error.group.id
  }
});

describe('runProviderTelemetryErrorGroupsExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when the export bucket is not configured', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    let listFailedMessages = vi.fn();

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: '',
      listFailedMessages
    });

    expect(storage.upsertBucket).not.toHaveBeenCalled();
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(listFailedMessages).not.toHaveBeenCalled();
    expect(result).toEqual({
      exportedKeys: [],
      state: null,
      exportedCount: 0
    });
  });

  it('uses the shared connection-utils storage target when storage is not injected', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    getProviderTelemetryErrorGroupsStorageTarget.mockReturnValueOnce({
      storage,
      bucketName: 'exports'
    });

    await runProviderTelemetryErrorGroupsExport({
      now,
      listFailedMessages: vi.fn(async () => ({
        items: [],
        nextWatermark: null,
        hasMore: false
      }))
    });

    expect(getProviderTelemetryErrorGroupsStorageTarget).toHaveBeenCalledWith(undefined);
    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
  });

  it('no-ops when the configured export bucket is missing', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    storage.upsertBucket.mockRejectedValueOnce({ statusCode: 404 });
    let listFailedMessages = vi.fn();

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(listFailedMessages).not.toHaveBeenCalled();
    expect(result).toEqual({
      exportedKeys: [],
      state: null,
      exportedCount: 0
    });
  });

  it('treats a missing v2 state object as a first run and exports a failed-message chunk', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    let candidate = createCandidate({
      providerName: 'Elasticsearch',
      providerSlug: 'elasticsearch',
      toolKey: 'elasticsearch_search_documents',
      toolNativeKey: 'search_documents',
      toolName: 'Search Documents'
    });
    let listFailedMessages = vi.fn(
      async (_input: ProviderTelemetryFailedMessagesExportListInput) => ({
        items: [candidate],
        nextWatermark: {
          occurred_at: '2026-06-18T00:10:00.000Z',
          id: 'serr_1'
        },
        hasMore: false
      })
    );

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages,
      presentMessage: async () => createPresentedMessage(candidate)
    });

    let expectedKey = getProviderTelemetryFailedMessagesExportChunkKey([candidate]);

    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: now
      },
      limit: 100,
      after: null
    });
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    expect(storage.putObject.mock.calls[0]![1]).toBe(expectedKey);
    expect(storage.putObject.mock.calls[0]![4]).toEqual({
      type: 'provider-telemetry-failed-message-export-chunk',
      itemCount: '1'
    });
    expect(storage.putObject.mock.calls[1]![1]).toBe(
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );

    let exportChunk = parseJsonCall(storage.putObject.mock.calls[0]!);
    expect(exportChunk).toMatchObject({
      object: 'admin.provider_error_group.failed_message_export_chunk',
      version: 1,
      generated_at: '2026-06-18T00:15:00.000Z',
      range: {
        from: '2026-06-11T00:15:00.000Z',
        to: '2026-06-18T00:15:00.000Z'
      },
      item_count: 1,
      items: [
        {
          occurred_at: '2026-06-18T00:10:00.000Z',
          error_group_id: 'serg_1',
          error_id: 'serr_1',
          message_id: 'msg_1',
          provider: {
            id: 'prv_1',
            name: 'Elasticsearch',
            slug: 'elasticsearch'
          },
          tool: {
            id: 'tc_1',
            key: 'elasticsearch_search_documents',
            name: 'Search Documents'
          }
        }
      ]
    });
    expect(exportChunk.items[0].payload).toEqual(
      anonymizeProviderTelemetryExportValue(createPresentedMessage(candidate))
    );

    let stateFile = parseJsonCall(storage.putObject.mock.calls[1]!);
    expect(stateFile).toEqual({
      version: 2,
      last_exported: {
        occurred_at: '2026-06-18T00:10:00.000Z',
        id: 'serr_1'
      },
      last_checked_at: '2026-06-18T00:15:00.000Z'
    });
    expect(result).toEqual({
      exportedKeys: [expectedKey],
      state: stateFile,
      exportedCount: 1
    });
  });

  it('exports each page as a chunk and counts exported messages', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    let first = createCandidate({
      errorId: 'serr_1',
      messageId: 'msg_1',
      occurredAt: '2026-06-18T00:10:00.000Z'
    });
    let second = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });
    let third = createCandidate({
      errorId: 'serr_3',
      messageId: 'msg_3',
      occurredAt: '2026-06-18T00:12:00.000Z'
    });
    let firstWatermark = {
      occurred_at: '2026-06-18T00:10:00.000Z',
      id: 'serr_1'
    };
    let listFailedMessages = vi.fn(
      async (input: ProviderTelemetryFailedMessagesExportListInput) =>
        input.after
          ? {
              items: [second, third],
              nextWatermark: {
                occurred_at: '2026-06-18T00:12:00.000Z',
                id: 'serr_3'
              },
              hasMore: false
            }
          : {
              items: [first],
              nextWatermark: firstWatermark,
              hasMore: true
            }
    );

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages,
      presentMessage: async message =>
        createPresentedMessage(
          [first, second, third].find(candidate => candidate.message.id === message.id)!
        )
    });

    expect(listFailedMessages).toHaveBeenNthCalledWith(1, {
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: now
      },
      limit: 100,
      after: null
    });
    expect(listFailedMessages).toHaveBeenNthCalledWith(2, {
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: now
      },
      limit: 100,
      after: firstWatermark
    });
    expect(storage.putObject).toHaveBeenCalledTimes(3);
    expect(result.exportedKeys).toEqual([
      getProviderTelemetryFailedMessagesExportChunkKey([first]),
      getProviderTelemetryFailedMessagesExportChunkKey([second, third])
    ]);
    expect(result.exportedCount).toBe(3);
    expect(result.state?.last_exported).toEqual({
      occurred_at: '2026-06-18T00:12:00.000Z',
      id: 'serr_3'
    });
  });

  it('resumes after the existing high-water mark', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let watermark = {
      occurred_at: '2026-06-18T00:00:00.000Z',
      id: 'serr_b'
    };
    let storage = createStorage({
      version: 2,
      last_exported: watermark,
      last_checked_at: '2026-06-18T00:00:00.000Z'
    });
    let listFailedMessages = vi.fn(
      async (_input: ProviderTelemetryFailedMessagesExportListInput) => ({
        items: [],
        nextWatermark: null,
        hasMore: false
      })
    );

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-18T00:00:00.000Z'),
        to: now
      },
      limit: 100,
      after: watermark
    });
  });

  it('uses last_checked_at as the next range start when no item was previously exported', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 2,
      last_exported: null,
      last_checked_at: '2026-06-18T00:00:00.000Z'
    });
    let listFailedMessages = vi.fn(
      async (_input: ProviderTelemetryFailedMessagesExportListInput) => ({
        items: [],
        nextWatermark: null,
        hasMore: false
      })
    );

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-18T00:00:00.000Z'),
        to: now
      },
      limit: 100,
      after: null
    });
  });

  it('updates only state when there are no grouped failed messages to export', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 2,
      last_exported: {
        occurred_at: '2026-06-18T00:00:00.000Z',
        id: 'serr_b'
      },
      last_checked_at: '2026-06-18T00:00:00.000Z'
    });
    let listFailedMessages = vi.fn(
      async (_input: ProviderTelemetryFailedMessagesExportListInput) => ({
        items: [],
        nextWatermark: null,
        hasMore: false
      })
    );

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.putObject.mock.calls[0]![1]).toBe(
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    expect(parseJsonCall(storage.putObject.mock.calls[0]!)).toEqual({
      version: 2,
      last_exported: {
        occurred_at: '2026-06-18T00:00:00.000Z',
        id: 'serr_b'
      },
      last_checked_at: '2026-06-18T00:15:00.000Z'
    });
    expect(result.exportedKeys).toEqual([]);
    expect(result.exportedCount).toBe(0);
  });
});

describe('anonymizeProviderTelemetryExportValue', () => {
  it('redacts payload strings while preserving safe diagnostic identifiers', () => {
    let date = new Date('2026-06-18T00:00:00.000Z');
    let anonymized = anonymizeProviderTelemetryExportValue({
      id: 'msg_1',
      messageId: 'msg_1',
      toolKey: 'users.info',
      nested: {
        email: 'person@example.com',
        text: 'Contact admin@example.com with Basic abc123',
        callbackUrl: 'https://example.com/callback?client_secret=secret-value&safe=yes',
        retryCount: 2,
        ok: true,
        missing: null,
        date,
        values: ['a', 1, false]
      },
      output: {
        error: {
          code: -32000,
          message: 'Output error message',
          data: {
            code: 'MCP_ERROR',
            Message: 'Case-insensitive message',
            values: ['visible', 2, false]
          }
        }
      },
      error: {
        id: 'serr_1',
        code: 'provider_error',
        message: 'Top-level error message',
        data: {
          authorization: 'Bearer abc123',
          object: 'provider.error',
          status: 500,
          message: 'Nested message',
          nested: {
            MESSAGE: 'Uppercase message'
          }
        }
      },
      toolCall: {
        id: 'tc_1',
        toolKey: 'users.info',
        rationale: 'User asked for it',
        operation: 'call_tool',
        tool: {
          id: 'tool_1',
          key: 'users.info',
          name: 'Users Info',
          providerId: 'prv_1'
        },
        nested: {
          operation: 'nested operation',
          detail: 'visible detail'
        }
      }
    }) as any;

    expect(anonymized).toEqual({
      id: '[string]',
      messageId: '[string]',
      toolKey: '[string]',
      nested: {
        email: '[string]',
        text: '[string]',
        callbackUrl: '[string]',
        retryCount: 2,
        ok: true,
        missing: null,
        date,
        values: ['[string]', 1, false]
      },
      output: {
        error: {
          code: -32000,
          data: {
            code: 'MCP_ERROR',
            values: ['[string]', 2, false]
          }
        }
      },
      error: {
        id: 'serr_1',
        code: 'provider_error',
        data: {
          authorization: '[string]',
          object: 'provider.error',
          status: 500,
          nested: {}
        }
      },
      toolCall: {
        id: 'tc_1',
        toolKey: 'users.info',
        tool: {
          id: 'tool_1',
          key: 'users.info',
          name: 'Users Info',
          providerId: 'prv_1'
        },
        nested: {
          detail: '[string]'
        }
      }
    });
  });

  it('keeps preserve exceptions scoped by path and key', () => {
    let anonymized = anonymizeProviderTelemetryExportValue({
      detail: 'ordinary detail',
      notToolCall: {
        rationale: 'ordinary rationale',
        operation: 'ordinary operation'
      },
      notError: {
        message: 'ordinary message',
        code: 'ordinary_code'
      },
      Error: {
        code: 'CASE_INSENSITIVE_ERROR',
        Message: 'removed message'
      },
      ToolCall: {
        toolKey: 'case.insensitive.tool',
        Operation: 'removed operation'
      }
    }) as any;

    expect(anonymized).toEqual({
      detail: '[string]',
      notToolCall: {
        rationale: '[string]',
        operation: '[string]'
      },
      notError: {
        message: '[string]',
        code: '[string]'
      },
      Error: {
        code: 'CASE_INSENSITIVE_ERROR'
      },
      ToolCall: {
        toolKey: 'case.insensitive.tool'
      }
    });
  });
});

describe('listProviderTelemetryFailedMessagesForExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries grouped errors through failed session messages and presents provider/tool metadata', async () => {
    let from = new Date('2026-06-18T00:00:00.000Z');
    let to = new Date('2026-06-18T01:00:00.000Z');
    let after = {
      occurred_at: '2026-06-18T00:15:00.000Z',
      id: 'serr_0'
    };
    let rawMessage = {
      oid: 10n,
      id: 'msg_1',
      type: 'tool_call',
      status: 'failed',
      methodOrToolKey: 'fallback_tool',
      providerRun: null,
      toolCall: null
    };
    db.sessionError.findMany.mockResolvedValue([
      {
        id: 'serr_1',
        code: 'provider_error',
        createdAt: new Date('2026-06-18T00:20:00.000Z'),
        group: { id: 'serg_1' },
        providerRun: {
          provider: {
            id: 'prv_1',
            name: 'Slack',
            slug: 'slack-provider',
            listing: {
              slug: 'slack'
            }
          }
        },
        sessionMessages: [rawMessage]
      }
    ]);
    enrichMessages.mockResolvedValue([
      {
        ...rawMessage,
        toolCall: {
          id: 'tc_1',
          toolKey: 'users.info',
          tool: {
            name: 'Users Info',
            provider: {
              id: 'prv_1',
              name: 'Slack',
              slug: 'slack-provider'
            }
          }
        }
      }
    ]);

    let result = await listProviderTelemetryFailedMessagesForExport({
      range: { from, to },
      limit: 25,
      after
    });

    expect(db.sessionError.findMany).toHaveBeenCalledTimes(1);
    let query = db.sessionError.findMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      AND: [
        { groupOid: { not: null } },
        { createdAt: { gte: from, lte: to } },
        { sessionMessages: { some: { status: 'failed' } } },
        {
          OR: [
            { createdAt: { gt: new Date('2026-06-18T00:15:00.000Z') } },
            {
              createdAt: new Date('2026-06-18T00:15:00.000Z'),
              id: { gt: 'serr_0' }
            }
          ]
        }
      ]
    });
    expect(query.include.sessionMessages.where).toEqual({ status: 'failed' });
    expect(query.include.sessionMessages.include.providerRun.include.provider.include).toEqual(
      {
        listing: true
      }
    );
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(query.take).toBe(26);

    expect(result).toMatchObject({
      hasMore: false,
      nextWatermark: {
        occurred_at: '2026-06-18T00:20:00.000Z',
        id: 'serr_1'
      },
      items: [
        {
          provider: {
            id: 'prv_1',
            name: 'Slack',
            slug: 'slack'
          },
          tool: {
            id: 'tc_1',
            key: 'users.info',
            name: 'Users Info'
          }
        }
      ]
    });
  });
});
