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
      token: 'Bearer abcdefghijklmnopqrstuvwxyz012345',
      phone: '+1 202-555-0110',
      query: 'https://api.example.com/callback?client_secret=top-secret&safe=yes',
      retryCount: 2,
      ok: false,
      missing: null,
      createdAt: new Date('2026-06-18T00:09:00.000Z')
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
      authorization: 'Bearer abcdefghijklmnopqrstuvwxyz012345',
      code: 'PROVIDER_ERROR',
      object: 'provider.error',
      status: 500,
      message: 'Failed for bob@example.com',
      nested: {
        MESSAGE: 'Uppercase message key'
      }
    },
    groupId: candidate.error.group.id
  },
  createdAt: new Date('2026-06-18T00:10:00.000Z')
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
    let payload = exportChunk.items[0].payload;
    expect(payload).toMatchObject({
      object: 'session.message',
      id: 'msg_1',
      type: 'tool_call',
      status: 'failed',
      source: 'model',
      input: {
        data: {
          token: '[REDACTED]',
          phone: '[REDACTED]',
          retryCount: 2,
          ok: false,
          missing: null,
          createdAt: '2026-06-18T00:09:00.000Z'
        }
      },
      toolCall: {
        id: 'tc_1',
        toolKey: 'elasticsearch_search_documents',
        rationale: '[REDACTED]',
        operation: 'call_tool',
        tool: {
          id: 'tool_1',
          key: 'elasticsearch_search_documents',
          name: '[REDACTED]',
          providerId: 'prv_1'
        }
      },
      error: {
        id: 'serr_1',
        code: 'provider_error',
        message: '[REDACTED]',
        data: {
          authorization: '[REDACTED]',
          code: 'PROVIDER_ERROR',
          object: 'provider.error',
          status: 500
        },
        groupId: 'serg_1'
      },
      createdAt: '2026-06-18T00:10:00.000Z'
    });

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

  it('redacts a broad set of OpenRedaction-supported PII categories in export payloads', async () => {
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

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages,
      presentMessage: async () => ({
        object: 'session.message',
        id: candidate.message.id,
        status: 'failed',
        input: {
          samples: {
            personal: {
              name: 'John Smith',
              phone: '+1 202-555-0110',
              address: '123 Main Street, Springfield, IL 62704'
            },
            financial: {
              creditCard: '4111 1111 1111 1111',
              iban: 'IBAN GB82 WEST 1234 5698 7654 32',
              routingNumber: 'routing number 021000021',
              swiftBic: 'SWIFT BIC DEUTDEFF',
              bankAccount: 'bank account 12345678',
              vatNumber: 'VAT GB123456789'
            },
            government: {
              passport: 'Passport A1234567',
              taxId: 'Tax ID 12-3456789'
            },
            healthcare: {
              medicalRecord: 'MRN MR123456',
              nhsNumber: 'NHS 943 476 5919',
              deaNumber: 'DEA AB1234563',
              npiNumber: 'NPI 1234567893',
              providerLicense: 'Provider license AB123456'
            },
            digitalIdentity: {
              jwt: [
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
                's5x9IXdBaxnU7D6yH4bVq9U1xIr3W5y33C0w6eLLq3s'
              ].join('.'),
              bearer: 'Bearer abcdefghijklmnopqrstuvwxyz012345',
              macAddress: '00:1B:44:11:3A:B7',
              bitcoinAddress: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
              ethereumAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
            },
            education: {
              studentId: 'Student ID AB123456',
              teachingLicense: 'Teacher license EDU123456'
            },
            transportation: {
              vin: 'VIN 1HGCM82633A004352',
              fedexTracking: 'FedEx tracking 123456789012',
              upsTracking: 'UPS tracking 1Z999AA10123456784',
              licensePlate: 'Plate ABC1234'
            },
            insuranceAndLegal: {
              policyNumber: 'Policy AB12345678',
              claimId: 'Claim 1234567890',
              caseNumber: 'Case CV-2024-123456'
            },
            professionalAndProperty: {
              nursingLicense: 'RN-123456',
              cpaLicense: 'CPA-123456',
              parcelNumber: 'APN-123-456-789'
            },
            operationalMetadata: {
              providerSlug: 'slack',
              toolKey: 'users_info',
              statusCode: 500,
              retryable: false,
              tags: ['provider_error', 'tool_call']
            }
          },
          safeDiagnostics: {
            retryCount: 2,
            ok: false,
            missing: null
          }
        },
        createdAt: new Date('2026-06-18T00:10:00.000Z')
      })
    });

    let exportChunk = parseJsonCall(storage.putObject.mock.calls[0]!);
    let payload = exportChunk.items[0].payload;

    expect(payload.input.samples).toEqual({
      personal: {
        name: '[REDACTED]',
        phone: '[REDACTED]',
        address: '[REDACTED]'
      },
      financial: {
        creditCard: '[REDACTED]',
        iban: '[REDACTED]',
        routingNumber: '[REDACTED]',
        swiftBic: '[REDACTED]',
        bankAccount: '[REDACTED]',
        vatNumber: '[REDACTED]'
      },
      government: {
        passport: '[REDACTED]',
        taxId: '[REDACTED]'
      },
      healthcare: {
        medicalRecord: '[REDACTED]',
        nhsNumber: '[REDACTED]',
        deaNumber: '[REDACTED]',
        npiNumber: '[REDACTED]',
        providerLicense: '[REDACTED]'
      },
      digitalIdentity: {
        jwt: '[REDACTED]',
        bearer: '[REDACTED]',
        macAddress: '[REDACTED]',
        bitcoinAddress: '[REDACTED]',
        ethereumAddress: '[REDACTED]'
      },
      education: {
        studentId: '[REDACTED]',
        teachingLicense: '[REDACTED]'
      },
      transportation: {
        vin: '[REDACTED]',
        fedexTracking: '[REDACTED]',
        upsTracking: '[REDACTED]',
        licensePlate: '[REDACTED]'
      },
      insuranceAndLegal: {
        policyNumber: '[REDACTED]',
        claimId: '[REDACTED]',
        caseNumber: '[REDACTED]'
      },
      professionalAndProperty: {
        nursingLicense: '[REDACTED]',
        cpaLicense: '[REDACTED]',
        parcelNumber: '[REDACTED]'
      },
      operationalMetadata: {
        providerSlug: 'slack',
        toolKey: 'users_info',
        statusCode: 500,
        retryable: false,
        tags: ['provider_error', 'tool_call']
      }
    });
    expect(payload).toMatchObject({
      object: 'session.message',
      id: 'msg_1',
      status: 'failed',
      input: {
        safeDiagnostics: {
          retryCount: 2,
          ok: false,
          missing: null
        }
      },
      createdAt: '2026-06-18T00:10:00.000Z'
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
