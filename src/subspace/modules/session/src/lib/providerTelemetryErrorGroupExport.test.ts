import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, enrichMessages, getProviderTelemetryErrorGroupsStorageTarget, captureMessage } =
  vi.hoisted(() => ({
    db: {
      sessionError: {
        findMany: vi.fn()
      }
    },
    enrichMessages: vi.fn(async (messages: any[]) => messages),
    getProviderTelemetryErrorGroupsStorageTarget: vi.fn(),
    captureMessage: vi.fn()
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
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureMessage })
}));

import {
  PROVIDER_TELEMETRY_EXPORT_QUEUE_JOB_OPTIONS,
  PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY,
  PROVIDER_TELEMETRY_QUARANTINE_KEY_PREFIX,
  ProviderTelemetryExportInfraError,
  getProviderTelemetryFailedMessageQuarantineKey,
  getProviderTelemetryFailedMessagesExportChunkKey,
  listProviderTelemetryFailedMessagesForExport,
  runProviderTelemetryErrorGroupsExport,
  type ProviderTelemetryErrorGroupsExportState,
  type ProviderTelemetryFailedMessageExportCandidate,
  type ProviderTelemetryFailedMessagesExportList,
  type ProviderTelemetryFailedMessagesExportListInput,
  type ProviderTelemetryFailedMessagesExportPageError
} from './providerTelemetryErrorGroupExport';

let createStorage = (state?: ProviderTelemetryErrorGroupsExportState) => {
  let objects = new Map<string, string>();
  if (state !== undefined) {
    objects.set(PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY, JSON.stringify(state));
  }

  return {
    objects,
    upsertBucket: vi.fn(async (_bucket: string) => ({})),
    getObject: vi.fn(async (_bucket: string, key: string) => {
      let data = objects.get(key);
      if (data === undefined) throw { statusCode: 404 };
      return { data: Buffer.from(data) };
    }),
    putObject: vi.fn(
      async (
        _bucket: string,
        key: string,
        data: Buffer | Uint8Array | Blob | ReadableStream | string,
        _contentType?: string,
        _metadata?: Record<string, string>
      ) => {
        objects.set(
          key,
          typeof data === 'string' ? data : Buffer.from(data as Uint8Array).toString('utf8')
        );
        return {};
      }
    )
  };
};

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
  }> = {}
): ProviderTelemetryFailedMessageExportCandidate => {
  let occurredAt = new Date(input.occurredAt ?? '2026-06-18T00:10:00.000Z');
  let toolKey = input.toolKey === undefined ? 'users.info' : input.toolKey;
  let toolNativeKey = input.toolNativeKey ?? toolKey ?? 'unknown_tool';
  let toolName = input.toolName ?? 'Users Info';

  return {
    error: {
      id: input.errorId ?? 'serr_1',
      type: 'message_processing_provider_error',
      code: 'provider_error',
      group: {
        id: input.groupId ?? 'serg_1'
      }
    },
    message: {
      id: input.messageId ?? 'msg_1',
      type: input.messageType ?? 'tool_call',
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

let pageError = (
  candidates: ProviderTelemetryFailedMessageExportCandidate[],
  opts: { isReady?: boolean } = {}
): ProviderTelemetryFailedMessagesExportPageError => ({
  error: candidates[0]!.error,
  occurredAt: candidates[0]!.occurredAt,
  isReady: opts.isReady ?? true,
  candidates
});

let singlePage = (
  entries: ProviderTelemetryFailedMessagesExportPageError[],
  hasMore = false
) =>
  vi.fn(
    async (
      _input: ProviderTelemetryFailedMessagesExportListInput
    ): Promise<ProviderTelemetryFailedMessagesExportList> => ({
      errors: entries,
      hasMore
    })
  );

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
      retryCount: 2,
      ok: false
    }
  },
  error: {
    id: candidate.error.id,
    code: candidate.error.code,
    message: 'Top-level provider error',
    groupId: candidate.error.group.id
  },
  createdAt: candidate.occurredAt
});

let emptyResultShape = {
  exportedKeys: [],
  quarantinedKeys: [],
  state: null,
  exportedCount: 0,
  quarantinedCount: 0,
  deferredCount: 0
};

describe('runProviderTelemetryErrorGroupsExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when the export bucket is not configured', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
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
    expect(result).toEqual(emptyResultShape);
  });

  it('uses the shared connection-utils storage target when storage is not injected', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    getProviderTelemetryErrorGroupsStorageTarget.mockReturnValueOnce({
      storage,
      bucketName: 'exports'
    });

    await runProviderTelemetryErrorGroupsExport({
      now,
      listFailedMessages: singlePage([])
    });

    expect(getProviderTelemetryErrorGroupsStorageTarget).toHaveBeenCalledWith(undefined);
    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
  });

  it('no-ops when the configured export bucket is missing', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    storage.upsertBucket.mockRejectedValueOnce({ statusCode: 404 });
    let listFailedMessages = vi.fn();

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(listFailedMessages).not.toHaveBeenCalled();
    expect(result).toEqual(emptyResultShape);
  });

  it('treats a missing state object as a first run: 7-day lookback, lagged upper bound, chunk + state', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let candidate = createCandidate({
      providerName: 'Elasticsearch',
      providerSlug: 'elasticsearch',
      toolKey: 'elasticsearch_search_documents',
      toolNativeKey: 'search_documents',
      toolName: 'Search Documents'
    });
    let listFailedMessages = singlePage([pageError([candidate])]);

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
        to: new Date('2026-06-18T00:13:00.000Z')
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
        to: '2026-06-18T00:13:00.000Z'
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
    expect(payload.input.data.token).toBe('[REDACTED]');
    expect(payload.input.data.retryCount).toBe(2);

    let watermark = {
      occurred_at: '2026-06-18T00:10:00.000Z',
      id: 'serr_1'
    };
    let stateFile = parseJsonCall(storage.putObject.mock.calls[1]!);
    expect(stateFile).toEqual({
      version: 2,
      last_exported: watermark,
      last_checked_at: '2026-06-18T00:15:00.000Z',
      last_processed: watermark,
      last_run: {
        status: 'completed',
        exported_count: 1,
        quarantined_count: 0,
        deferred_count: 0
      }
    });
    expect(result).toEqual({
      exportedKeys: [expectedKey],
      quarantinedKeys: [],
      state: stateFile,
      exportedCount: 1,
      quarantinedCount: 0,
      deferredCount: 0
    });
  });

  it('redacts a broad set of OpenRedaction-supported PII categories in export payloads', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let candidate = createCandidate();

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([pageError([candidate])]),
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

  it('exports pages with a mid-run checkpoint and counts exported messages', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
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
    let listFailedMessages = vi.fn(
      async (
        input: ProviderTelemetryFailedMessagesExportListInput
      ): Promise<ProviderTelemetryFailedMessagesExportList> =>
        input.after
          ? { errors: [pageError([second]), pageError([third])], hasMore: false }
          : { errors: [pageError([first])], hasMore: true }
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
        to: new Date('2026-06-18T00:13:00.000Z')
      },
      limit: 100,
      after: null
    });
    expect(listFailedMessages).toHaveBeenNthCalledWith(2, {
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: new Date('2026-06-18T00:13:00.000Z')
      },
      limit: 100,
      after: {
        occurred_at: '2026-06-18T00:10:00.000Z',
        id: 'serr_1'
      }
    });

    // chunk 1, checkpoint state, chunk 2, final state
    expect(storage.putObject).toHaveBeenCalledTimes(4);
    let checkpoint = parseJsonCall(storage.putObject.mock.calls[1]!);
    expect(storage.putObject.mock.calls[1]![1]).toBe(
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    expect(checkpoint.last_run.status).toBe('running');
    expect(checkpoint.last_processed).toEqual({
      occurred_at: '2026-06-18T00:10:00.000Z',
      id: 'serr_1'
    });

    expect(result.exportedKeys).toEqual([
      getProviderTelemetryFailedMessagesExportChunkKey([first]),
      getProviderTelemetryFailedMessagesExportChunkKey([second, third])
    ]);
    expect(result.exportedCount).toBe(3);
    expect(result.state?.last_exported).toEqual({
      occurred_at: '2026-06-18T00:12:00.000Z',
      id: 'serr_3'
    });
    expect(result.state?.last_run).toEqual({
      status: 'completed',
      exported_count: 3,
      quarantined_count: 0,
      deferred_count: 0
    });
  });

  it('resumes after a legacy last_exported watermark', async () => {
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
    let listFailedMessages = singlePage([]);

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-18T00:00:00.000Z'),
        to: new Date('2026-06-18T00:13:00.000Z')
      },
      limit: 100,
      after: watermark
    });
  });

  it('prefers last_processed over last_exported when resuming', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let exportedWatermark = {
      occurred_at: '2026-06-18T00:00:00.000Z',
      id: 'serr_b'
    };
    let processedWatermark = {
      occurred_at: '2026-06-18T00:05:00.000Z',
      id: 'serr_c'
    };
    let storage = createStorage({
      version: 2,
      last_exported: exportedWatermark,
      last_checked_at: '2026-06-18T00:00:00.000Z',
      last_processed: processedWatermark
    });
    let listFailedMessages = singlePage([]);

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-18T00:05:00.000Z'),
        to: new Date('2026-06-18T00:13:00.000Z')
      },
      limit: 100,
      after: processedWatermark
    });
  });

  it('falls back to the 7-day lookback and ignores last_checked_at when no watermark exists', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 2,
      last_exported: null,
      last_checked_at: '2026-06-18T00:00:00.000Z'
    });
    let listFailedMessages = singlePage([]);

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages
    });

    expect(listFailedMessages).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: new Date('2026-06-18T00:13:00.000Z')
      },
      limit: 100,
      after: null
    });
  });

  it('updates only state when there is nothing to export', async () => {
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

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([])
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.putObject.mock.calls[0]![1]).toBe(
      PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    expect(parseJsonCall(storage.putObject.mock.calls[0]!)).toEqual({
      version: 2,
      last_exported: watermark,
      last_checked_at: '2026-06-18T00:15:00.000Z',
      last_processed: watermark,
      last_run: {
        status: 'completed',
        exported_count: 0,
        quarantined_count: 0,
        deferred_count: 0
      }
    });
    expect(result.exportedKeys).toEqual([]);
    expect(result.exportedCount).toBe(0);
  });

  it('quarantines a poison message and keeps exporting later records', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let first = createCandidate({
      errorId: 'serr_1',
      messageId: 'msg_1',
      occurredAt: '2026-06-18T00:10:00.000Z'
    });
    let poison = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });
    let third = createCandidate({
      errorId: 'serr_3',
      messageId: 'msg_3',
      occurredAt: '2026-06-18T00:12:00.000Z'
    });

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([
        pageError([first]),
        pageError([poison]),
        pageError([third])
      ]),
      presentMessage: async message => {
        if (message.id === 'msg_2') {
          throw new TypeError('Cannot read properties of undefined (reading data)');
        }
        return createPresentedMessage(
          [first, third].find(candidate => candidate.message.id === message.id)!
        );
      }
    });

    let expectedChunkKey = getProviderTelemetryFailedMessagesExportChunkKey([first, third]);
    let expectedQuarantineKey = getProviderTelemetryFailedMessageQuarantineKey({
      occurred_at: '2026-06-18T00:11:00.000Z',
      error_id: 'serr_2',
      message_id: 'msg_2',
      stage: 'present'
    });

    expect(result.exportedKeys).toEqual([expectedChunkKey]);
    expect(result.quarantinedKeys).toEqual([expectedQuarantineKey]);
    expect(result.exportedCount).toBe(2);
    expect(result.quarantinedCount).toBe(1);
    expect(result.state?.last_processed).toEqual({
      occurred_at: '2026-06-18T00:12:00.000Z',
      id: 'serr_3'
    });
    expect(result.state?.last_exported).toEqual({
      occurred_at: '2026-06-18T00:12:00.000Z',
      id: 'serr_3'
    });

    let exportChunk = JSON.parse(storage.objects.get(expectedChunkKey)!);
    expect(exportChunk.items.map((item: any) => item.message_id)).toEqual(['msg_1', 'msg_3']);

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({
      level: 'warning',
      extra: {
        stage: 'present',
        reason: 'presentation_failed',
        errorId: 'serr_2',
        messageId: 'msg_2'
      }
    });
  });

  it('writes quarantine records without payloads, raw error text, or a .json suffix', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let poison = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([pageError([poison])]),
      presentMessage: async () => {
        throw new TypeError('secret-user-data@example.com leaked into an error');
      }
    });

    let quarantineKey = getProviderTelemetryFailedMessageQuarantineKey({
      occurred_at: '2026-06-18T00:11:00.000Z',
      error_id: 'serr_2',
      message_id: 'msg_2',
      stage: 'present'
    });

    expect(quarantineKey.startsWith(PROVIDER_TELEMETRY_QUARANTINE_KEY_PREFIX)).toBe(true);
    expect(quarantineKey.endsWith('.json')).toBe(false);
    expect(quarantineKey.endsWith('.jsonl')).toBe(true);

    let raw = storage.objects.get(quarantineKey)!;
    expect(raw).toBeDefined();
    expect(raw).not.toContain('secret-user-data');
    expect(raw).not.toContain('example.com');

    let record = JSON.parse(raw);
    expect(Object.keys(record).sort()).toEqual(
      [
        'object',
        'version',
        'stage',
        'reason',
        'error_id',
        'message_id',
        'occurred_at',
        'fingerprint',
        'quarantined_at'
      ].sort()
    );
    expect(record).toMatchObject({
      object: 'provider_telemetry.failed_message_export_quarantine',
      version: 1,
      stage: 'present',
      reason: 'presentation_failed',
      error_id: 'serr_2',
      message_id: 'msg_2',
      occurred_at: '2026-06-18T00:11:00.000Z',
      quarantined_at: '2026-06-18T00:15:00.000Z'
    });
    expect(record.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('quarantines a message whose payload cannot be redacted', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let poison = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([pageError([poison])]),
      // BigInt payloads cannot be JSON-serialized, so redaction fails
      presentMessage: async () => ({ big: 1n })
    });

    expect(result.quarantinedCount).toBe(1);
    let record = JSON.parse(storage.objects.get(result.quarantinedKeys[0]!)!);
    expect(record.stage).toBe('redact');
    expect(record.reason).toBe('redaction_failed');
    expect(result.state?.last_processed).toEqual({
      occurred_at: '2026-06-18T00:11:00.000Z',
      id: 'serr_2'
    });
    expect(result.state?.last_exported).toBeNull();
  });

  it('fails the run without touching state when preparation hits an infrastructure error', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let candidate = createCandidate();

    await expect(
      runProviderTelemetryErrorGroupsExport({
        now,
        storage,
        bucketName: 'exports',
        listFailedMessages: singlePage([pageError([candidate])]),
        presentMessage: async () => {
          throw new ProviderTelemetryExportInfraError('storage read failed');
        }
      })
    ).rejects.toThrow('storage read failed');

    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('defers at the first recent ungrouped error and never advances past it', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let ready = createCandidate({
      errorId: 'serr_1',
      messageId: 'msg_1',
      occurredAt: '2026-06-18T00:01:00.000Z'
    });
    // 10 minutes old: inside the readiness grace period
    let ungrouped = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:05:00.000Z'
    });
    let later = createCandidate({
      errorId: 'serr_3',
      messageId: 'msg_3',
      occurredAt: '2026-06-18T00:12:00.000Z'
    });
    let listFailedMessages = singlePage(
      [pageError([ready]), pageError([ungrouped], { isReady: false }), pageError([later])],
      true
    );

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages,
      presentMessage: async () => createPresentedMessage(ready)
    });

    // a deferred run stops paging entirely
    expect(listFailedMessages).toHaveBeenCalledTimes(1);
    expect(result.exportedCount).toBe(1);
    expect(result.quarantinedCount).toBe(0);
    expect(result.deferredCount).toBe(2);
    expect(result.state?.last_processed).toEqual({
      occurred_at: '2026-06-18T00:01:00.000Z',
      id: 'serr_1'
    });
    expect(result.state?.last_run).toEqual({
      status: 'deferred',
      exported_count: 1,
      quarantined_count: 0,
      deferred_count: 2
    });
  });

  it('quarantines an ungrouped error older than the grace period and continues', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    // more than 4 hours old: past the readiness grace period
    let stale = createCandidate({
      errorId: 'serr_1',
      messageId: 'msg_1',
      occurredAt: '2026-06-17T19:00:00.000Z'
    });
    let ready = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:10:00.000Z'
    });

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([
        pageError([stale], { isReady: false }),
        pageError([ready])
      ]),
      presentMessage: async () => createPresentedMessage(ready)
    });

    expect(result.exportedCount).toBe(1);
    expect(result.quarantinedCount).toBe(1);
    expect(result.deferredCount).toBe(0);
    expect(result.state?.last_processed).toEqual({
      occurred_at: '2026-06-18T00:10:00.000Z',
      id: 'serr_2'
    });

    let record = JSON.parse(storage.objects.get(result.quarantinedKeys[0]!)!);
    expect(record).toMatchObject({
      stage: 'readiness',
      reason: 'not_grouped_within_grace_period',
      error_id: 'serr_1',
      message_id: null,
      message_ids: ['msg_1']
    });
  });

  it('reuses an existing chunk object instead of rewriting it', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let candidate = createCandidate();
    let expectedKey = getProviderTelemetryFailedMessagesExportChunkKey([candidate]);
    storage.objects.set(expectedKey, JSON.stringify({ existing: true }));

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([pageError([candidate])]),
      presentMessage: async () => createPresentedMessage(candidate)
    });

    let chunkWrites = storage.putObject.mock.calls.filter(call => call[1] === expectedKey);
    expect(chunkWrites).toHaveLength(0);
    expect(storage.objects.get(expectedKey)).toBe(JSON.stringify({ existing: true }));
    expect(result.exportedKeys).toEqual([expectedKey]);
    expect(result.exportedCount).toBe(1);
    expect(result.state?.last_exported).toEqual({
      occurred_at: '2026-06-18T00:10:00.000Z',
      id: 'serr_1'
    });
  });

  it('reuses an existing quarantine object instead of rewriting it', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let poison = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });
    let quarantineKey = getProviderTelemetryFailedMessageQuarantineKey({
      occurred_at: '2026-06-18T00:11:00.000Z',
      error_id: 'serr_2',
      message_id: 'msg_2',
      stage: 'present'
    });
    storage.objects.set(quarantineKey, 'existing');

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listFailedMessages: singlePage([pageError([poison])]),
      presentMessage: async () => {
        throw new TypeError('poison');
      }
    });

    let quarantineWrites = storage.putObject.mock.calls.filter(
      call => call[1] === quarantineKey
    );
    expect(quarantineWrites).toHaveLength(0);
    expect(storage.objects.get(quarantineKey)).toBe('existing');
    expect(result.quarantinedKeys).toEqual([quarantineKey]);
    expect(result.quarantinedCount).toBe(1);
  });

  it('leaves state untouched when a storage write fails', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage();
    let candidate = createCandidate();
    storage.putObject.mockRejectedValueOnce(new Error('s3 unavailable'));

    await expect(
      runProviderTelemetryErrorGroupsExport({
        now,
        storage,
        bucketName: 'exports',
        listFailedMessages: singlePage([pageError([candidate])]),
        presentMessage: async () => createPresentedMessage(candidate)
      })
    ).rejects.toThrow('s3 unavailable');

    let stateWrites = storage.putObject.mock.calls.filter(
      call => call[1] === PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY
    );
    expect(stateWrites).toHaveLength(0);
    expect(storage.objects.has(PROVIDER_TELEMETRY_FAILED_MESSAGES_STATE_KEY)).toBe(false);
  });
});

describe('getProviderTelemetryFailedMessagesExportChunkKey', () => {
  it('produces identical keys for identical member sets', () => {
    let a = createCandidate({ errorId: 'serr_1', messageId: 'msg_1' });
    let b = createCandidate({ errorId: 'serr_2', messageId: 'msg_2' });

    expect(getProviderTelemetryFailedMessagesExportChunkKey([a, b])).toBe(
      getProviderTelemetryFailedMessagesExportChunkKey([a, b])
    );
  });

  it('produces different keys when the middle of the set changes', () => {
    let a = createCandidate({
      errorId: 'serr_1',
      messageId: 'msg_1',
      occurredAt: '2026-06-18T00:10:00.000Z'
    });
    let b = createCandidate({
      errorId: 'serr_2',
      messageId: 'msg_2',
      occurredAt: '2026-06-18T00:11:00.000Z'
    });
    let c = createCandidate({
      errorId: 'serr_3',
      messageId: 'msg_3',
      occurredAt: '2026-06-18T00:12:00.000Z'
    });

    // same first/last members, different middle
    expect(getProviderTelemetryFailedMessagesExportChunkKey([a, b, c])).not.toBe(
      getProviderTelemetryFailedMessagesExportChunkKey([a, c])
    );
  });

  it('keeps the export key prefix and .json suffix', () => {
    let key = getProviderTelemetryFailedMessagesExportChunkKey([createCandidate()]);
    expect(key.startsWith('provider-telemetry/failed-messages-')).toBe(true);
    expect(key.endsWith('.json')).toBe(true);
  });
});

describe('queue policy', () => {
  it('retries three times and removes terminally failed jobs', () => {
    expect(PROVIDER_TELEMETRY_EXPORT_QUEUE_JOB_OPTIONS).toEqual({
      attempts: 3,
      removeOnFail: true
    });
  });
});

describe('listProviderTelemetryFailedMessagesForExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans all session errors, marking ungrouped ones as not ready', async () => {
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
      providerRun: null,
      toolCall: null
    };
    let ungroupedMessage = {
      oid: 11n,
      id: 'msg_2',
      type: 'tool_call',
      status: 'failed',
      providerRun: null,
      toolCall: null
    };
    db.sessionError.findMany.mockResolvedValue([
      {
        id: 'serr_1',
        code: 'provider_error',
        createdAt: new Date('2026-06-18T00:20:00.000Z'),
        groupOid: 5n,
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
      },
      {
        id: 'serr_2',
        code: 'provider_error',
        createdAt: new Date('2026-06-18T00:25:00.000Z'),
        groupOid: null,
        group: null,
        providerRun: null,
        sessionMessages: [ungroupedMessage]
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
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect(query.take).toBe(26);

    // only messages of ready errors are enriched
    expect(enrichMessages).toHaveBeenCalledTimes(1);
    expect(enrichMessages.mock.calls[0]![0]).toEqual([rawMessage]);

    expect(result.hasMore).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({
      isReady: true,
      occurredAt: new Date('2026-06-18T00:20:00.000Z'),
      candidates: [
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
    expect(result.errors[1]).toMatchObject({
      isReady: false,
      occurredAt: new Date('2026-06-18T00:25:00.000Z')
    });
    expect(result.errors[1]!.candidates[0]!.message.id).toBe('msg_2');
  });
});
