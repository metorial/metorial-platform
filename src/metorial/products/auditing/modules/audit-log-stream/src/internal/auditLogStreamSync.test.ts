import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  decrypt,
  deliver,
  dirtyUpsert,
  findOrganization,
  findRun,
  findStream,
  fire,
  generateId,
  getSystemActor,
  insertEvent,
  listBatch,
  updateRun,
  updateStream,
  upsertRun
} = vi.hoisted(() => ({
  decrypt: vi.fn(),
  deliver: vi.fn(),
  dirtyUpsert: vi.fn(),
  findOrganization: vi.fn(),
  findRun: vi.fn(),
  findStream: vi.fn(),
  fire: vi.fn(),
  generateId: vi.fn(),
  getSystemActor: vi.fn(),
  insertEvent: vi.fn(),
  listBatch: vi.fn(),
  updateRun: vi.fn(),
  updateStream: vi.fn(),
  upsertRun: vi.fn()
}));

let transactionDb = {
  auditLogStreamRun: {
    upsert: upsertRun,
    update: updateRun
  },
  auditLogStream: {
    update: updateStream
  },
  auditLogStreamEvent: {
    create: insertEvent
  },
  auditLogDirtyTracker: {
    upsert: dirtyUpsert
  }
};

vi.mock('@metorial/db', () => ({
  db: {
    auditLogStreamRun: {
      findUnique: findRun
    },
    auditLogStream: {
      findUnique: findStream
    },
    organization: {
      findUniqueOrThrow: findOrganization
    }
  },
  ID: {
    generateId
  },
  withTransaction: (callback: (db: typeof transactionDb) => unknown) => callback(transactionDb)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire }
}));

vi.mock('@metorial/audit-scope', () => ({
  createOrganizationActorAuditScope: vi.fn(() => ({
    organizationOid: 2n,
    organizationActorOid: 9n,
    actor: { type: 'org_actor', id: 'oac_system' },
    context: { ip: '0.0.0.0', ua: 'Metorial System' }
  }))
}));

vi.mock('@metorial/module-organization', () => ({
  organizationActorService: {
    getSystemActor
  }
}));

vi.mock('@metorial/module-audit-log', () => ({
  auditLogService: {
    listAuditLogsForStream: listBatch
  }
}));

vi.mock('../destinations', () => ({
  AuditLogDestinationError: class AuditLogDestinationError extends Error {
    constructor(
      message: string,
      readonly details: Record<string, unknown>
    ) {
      super(message);
    }
  },
  deliverAuditLogStreamEvents: deliver
}));

vi.mock('../lib/providerData', () => ({
  decryptAuditLogStreamProviderData: decrypt
}));

import {
  AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS,
  auditLogStreamSyncService
} from './auditLogStreamSync';
import { AuditLogDestinationError } from '../destinations';

let createdAt = new Date('2026-08-13T10:30:00.000Z');
let auditLog = {
  id: 'aud_1',
  resource: 'organization',
  action: 'update',
  organizationId: 'org_1',
  context: { ip: null, ua: null },
  recordedAt: new Date('2026-08-13T11:00:00.000Z')
} as any;
let stream = {
  oid: 10n,
  id: 'als_1',
  provider: 'datadog' as const,
  status: 'active' as const,
  accessStatus: 'ok' as const,
  isPausedDueToError: false,
  errorMessage: null,
  consecutiveErrorCount: 0,
  isStarted: false,
  organizationOid: 2n,
  providerDataRedacted: {},
  encryptedProviderData: 'encrypted',
  lastEventId: null,
  lastAuditLogOid: null,
  createdAt,
  updatedAt: createdAt
};
let job = {
  auditLogStreamId: stream.id,
  runId: 'alsr_1',
  batchIdentifier: 'alsb_1',
  batchNumber: 1,
  successfulBatchCount: 0
};

describe('auditLogStreamSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findRun.mockResolvedValue(null);
    findStream.mockResolvedValue(stream);
    listBatch.mockResolvedValue({
      items: [auditLog],
      lastAuditLogOid: 20n
    });
    decrypt.mockResolvedValue({ apiKey: 'secret', site: 'datadoghq.com' });
    deliver.mockResolvedValue(undefined);
    generateId.mockResolvedValue('alse_1');
    upsertRun.mockResolvedValue({});
    updateRun.mockResolvedValue({});
    updateStream.mockResolvedValue({});
    insertEvent.mockResolvedValue({});
    dirtyUpsert.mockResolvedValue({});
    findOrganization.mockResolvedValue({ oid: 2n, id: 'org_1' });
    getSystemActor.mockResolvedValue({ oid: 9n, id: 'oac_system' });
  });

  it('creates and completes a run while advancing the cursor after delivery', async () => {
    let result = await auditLogStreamSyncService.syncBatch(job);

    expect(upsertRun).toHaveBeenCalledWith({
      where: { id: 'alsr_1' },
      create: {
        id: 'alsr_1',
        status: 'running',
        batchIdentifier: 'alsb_1',
        batchNumber: 1,
        successfulBatchCount: 0,
        recordsSynced: 0,
        auditLogStreamOid: 10n
      },
      update: {}
    });
    expect(listBatch).toHaveBeenCalledWith({
      organizationOid: 2n,
      recordedAtGte: new Date('2026-08-13T00:00:00.000Z'),
      afterOid: null,
      limit: 100
    });
    expect(deliver).toHaveBeenCalledWith({
      provider: 'datadog',
      providerData: { apiKey: 'secret', site: 'datadoghq.com' },
      events: [auditLog]
    });
    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'started',
        auditLogStreamOid: 10n
      }
    });
    expect(updateRun).toHaveBeenCalledWith({
      where: { id: 'alsr_1' },
      data: expect.objectContaining({
        status: 'success',
        recordsSynced: 1,
        successfulBatchCount: 1
      })
    });
    expect(updateStream).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        lastAuditLogOid: 20n,
        lastEventId: 'aud_1',
        accessStatus: 'ok'
      })
    });
    expect(result).toEqual({
      status: 'success',
      recordsSynced: 1,
      successfulBatchCount: 1,
      shouldContinue: false
    });
  });

  it('records a failure without advancing the cursor and re-dirties the organization', async () => {
    deliver.mockRejectedValueOnce(new Error('HTTP 503'));

    let result = await auditLogStreamSyncService.syncBatch({
      ...job,
      batchNumber: 3,
      successfulBatchCount: 2
    });

    expect(updateRun).toHaveBeenCalledWith({
      where: { id: 'alsr_1' },
      data: expect.objectContaining({
        status: 'error',
        errorMessage: 'HTTP 503',
        recordsSynced: 0,
        successfulBatchCount: 2
      })
    });
    expect(updateStream).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        accessStatus: 'error',
        consecutiveErrorCount: 1
      })
    });
    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'error',
        message: 'HTTP 503',
        errorDetails: {
          provider: 'datadog',
          code: 'unknown_error',
          errorName: 'Error',
          httpStatusCode: null,
          httpStatusText: null,
          providerErrorCode: null,
          responseBody: null,
          batchIdentifier: 'alsb_1',
          batchNumber: 3,
          successfulBatchCount: 2,
          eventCount: 1,
          firstEventId: 'aud_1',
          lastEventId: 'aud_1'
        },
        auditLogStreamOid: 10n
      }
    });
    expect(dirtyUpsert).toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(updateStream).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastAuditLogOid: expect.anything() })
      })
    );
  });

  it('pauses and emits the paused event on the hundredth consecutive failure', async () => {
    findStream.mockResolvedValueOnce({
      ...stream,
      accessStatus: 'error',
      isStarted: true,
      consecutiveErrorCount: AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS - 1
    });
    deliver.mockRejectedValueOnce(
      new AuditLogDestinationError('still unavailable', {
        code: 'http_error',
        httpStatusCode: 503,
        httpStatusText: 'Unavailable',
        providerErrorCode: null,
        responseBody: '{"error":"overloaded"}'
      })
    );

    await auditLogStreamSyncService.syncBatch(job);

    expect(updateStream).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        consecutiveErrorCount: 100,
        isPausedDueToError: true
      })
    });
    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'error_paused',
        message: 'still unavailable',
        errorDetails: expect.objectContaining({
          provider: 'datadog',
          code: 'http_error',
          httpStatusCode: 503,
          httpStatusText: 'Unavailable',
          responseBody: '{"error":"overloaded"}',
          batchIdentifier: 'alsb_1',
          batchNumber: 1,
          eventCount: 1
        }),
        auditLogStreamOid: 10n
      }
    });
    expect(fire).toHaveBeenCalledWith(
      'organization.audit_log_stream.paused:after',
      expect.objectContaining({
        auditLogStream: expect.objectContaining({
          id: 'als_1',
          isPausedDueToError: true,
          consecutiveErrorCount: 100
        }),
        previousAuditLogStream: expect.objectContaining({
          isPausedDueToError: false
        })
      })
    );
    expect(dirtyUpsert).not.toHaveBeenCalled();
  });

  it('emits recovered and resets failures after a successful batch', async () => {
    findStream.mockResolvedValueOnce({
      ...stream,
      accessStatus: 'error',
      isStarted: true,
      consecutiveErrorCount: 4,
      errorMessage: 'previous error'
    });

    await auditLogStreamSyncService.syncBatch(job);

    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'recovered',
        auditLogStreamOid: 10n
      }
    });
    expect(updateStream).toHaveBeenLastCalledWith({
      where: { oid: 10n },
      data: expect.objectContaining({
        accessStatus: 'ok',
        consecutiveErrorCount: 0,
        errorMessage: null
      })
    });
  });
});
