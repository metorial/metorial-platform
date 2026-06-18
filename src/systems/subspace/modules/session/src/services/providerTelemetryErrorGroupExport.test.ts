import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enrichMessages } = vi.hoisted(() => ({
  db: {
    sessionError: {
      findMany: vi.fn()
    }
  },
  enrichMessages: vi.fn(async (messages: any[]) => messages)
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('./sessionMessage', () => ({
  sessionMessageService: {
    enrichMessages
  }
}));

import {
  PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY,
  anonymizeProviderTelemetryExportValue,
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
    messageType: string;
    toolKey: string;
    methodOrToolKey: string | null;
  }> = {}
): ProviderTelemetryFailedMessageExportCandidate => {
  let occurredAt = new Date(input.occurredAt ?? '2026-06-18T00:10:00.000Z');
  let toolKey = input.toolKey ?? 'users.info';

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
            id: 'tc_1',
            toolKey,
            tool: {
              name: 'Users Info'
            }
          }
        : null
    },
    occurredAt,
    provider: {
      id: 'prv_1',
      name: 'Slack',
      slug: input.providerSlug ?? 'slack'
    },
    tool: toolKey
      ? {
          id: 'tc_1',
          key: toolKey,
          name: 'Users Info'
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
  input: {
    data: {
      email: 'alice@example.com',
      token: 'secret-token',
      query: 'https://api.example.com/callback?client_secret=top-secret&safe=yes'
    }
  },
  toolCall: candidate.tool
    ? {
        id: candidate.tool.id,
        toolKey: candidate.tool.key,
        tool: {
          key: candidate.tool.key,
          name: candidate.tool.name
        }
      }
    : null,
  error: {
    id: candidate.error.id,
    code: candidate.error.code,
    data: {
      authorization: 'Bearer abc123',
      message: 'Failed for bob@example.com'
    }
  }
});

describe('runProviderTelemetryErrorGroupsExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a missing v2 state object as a first run and exports individual failed message files', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    let candidate = createCandidate();
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
      presentMessage: async message => createPresentedMessage(candidate)
    });

    let unixSeconds = Math.floor(candidate.occurredAt.getTime() / 1000);
    let expectedKey =
      `provider-telemetry/error-groups/failed-messages/2026/06/18/msg_1/` +
      `slack-tool_call-users.info-${unixSeconds}.json`;

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
    expect(storage.putObject.mock.calls[1]![1]).toBe(
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    expect(
      storage.putObject.mock.calls.some(call =>
        String(call[1]).includes('provider-telemetry/error-groups/runs/')
      )
    ).toBe(false);

    let exportFile = parseJsonCall(storage.putObject.mock.calls[0]!);
    expect(exportFile).toMatchObject({
      object: 'admin.provider_error_group.failed_message_export',
      version: 1,
      generated_at: '2026-06-18T00:15:00.000Z',
      occurred_at: '2026-06-18T00:10:00.000Z',
      error_group_id: 'serg_1',
      error_id: 'serr_1',
      message_id: 'msg_1',
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
    });
    expect(exportFile.payload.input.data.email).toBe('[redacted-email]');
    expect(exportFile.payload.input.data.token).toBe('[redacted]');
    expect(exportFile.payload.error.data.authorization).toBe('[redacted]');

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

  it('uses a one-hour overlap from the existing high-water mark', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 2,
      last_exported: {
        occurred_at: '2026-06-18T00:00:00.000Z',
        id: 'serr_b'
      },
      last_checked_at: '2026-06-18T00:00:00.000Z'
    });
    let candidate = createCandidate({
      errorId: 'serr_c',
      messageId: 'msg_c',
      occurredAt: '2026-06-18T00:05:00.000Z'
    });
    let listFailedMessages = vi.fn(
      async (_input: ProviderTelemetryFailedMessagesExportListInput) => ({
        items: [candidate],
        nextWatermark: {
          occurred_at: '2026-06-18T00:05:00.000Z',
          id: 'serr_c'
        },
        hasMore: false
      })
    );

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages,
      presentMessage: async () => createPresentedMessage(candidate)
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-17T23:00:00.000Z'),
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
  it('redacts credential-like keys, bearer values, emails, and secret URL params without removing useful ids', () => {
    let anonymized = anonymizeProviderTelemetryExportValue({
      id: 'msg_1',
      messageId: 'msg_1',
      toolKey: 'users.info',
      authorization: 'Bearer raw-token',
      nested: {
        email: 'person@example.com',
        text: 'Contact admin@example.com with Basic abc123',
        callbackUrl: 'https://example.com/callback?client_secret=secret-value&safe=yes',
        credentials: {
          access_token: 'token-value'
        },
        credentialId: 'cred_1'
      }
    }) as any;

    expect(anonymized.id).toBe('msg_1');
    expect(anonymized.messageId).toBe('msg_1');
    expect(anonymized.toolKey).toBe('users.info');
    expect(anonymized.authorization).toBe('[redacted]');
    expect(anonymized.nested.email).toBe('[redacted-email]');
    expect(anonymized.nested.text).toBe(
      `Contact ${'[redacted-email]'} with Basic ${'[redacted]'}`
    );
    expect(anonymized.nested.callbackUrl).toContain('safe=yes');
    expect(anonymized.nested.callbackUrl).not.toContain('secret-value');
    expect(anonymized.nested.credentials).toBe('[redacted]');
    expect(anonymized.nested.credentialId).toBe('cred_1');
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
