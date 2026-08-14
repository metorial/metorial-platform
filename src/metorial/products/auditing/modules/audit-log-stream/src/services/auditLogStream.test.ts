import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  deleteStream,
  dirtyTrackerUpsert,
  encrypt,
  findEvents,
  findStreams,
  generateId,
  insertEvent,
  insertStream,
  updateStream
} = vi.hoisted(() => ({
  deleteStream: vi.fn(),
  dirtyTrackerUpsert: vi.fn(),
  encrypt: vi.fn(),
  findEvents: vi.fn(),
  findStreams: vi.fn(),
  generateId: vi.fn(),
  insertEvent: vi.fn(),
  insertStream: vi.fn(),
  updateStream: vi.fn()
}));

let transactionDb = {
  auditLogStream: {
    create: insertStream,
    update: updateStream,
    delete: deleteStream
  },
  auditLogStreamEvent: {
    create: insertEvent
  },
  auditLogDirtyTracker: {
    upsert: dirtyTrackerUpsert
  }
};

vi.mock('../env', () => ({
  env: { secrets: { ENCRYPTION_SECRET: 'test-encryption-secret' } }
}));

vi.mock('@lowerdeck/encryption', () => ({
  Encryption: class {
    encrypt = encrypt;
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    auditLogStream: {
      findMany: findStreams
    },
    auditLogStreamEvent: {
      findMany: findEvents
    }
  },
  ID: {
    generateId
  },
  withTransaction: (callback: (db: typeof transactionDb) => unknown) => callback(transactionDb)
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

import { Fabric } from '@metorial/fabric';
import { auditLogStreamService } from './auditLogStream';
import { auditLogStreamEventService } from './auditLogStreamEvent';

let organization = {
  oid: 2n,
  id: 'org_1'
} as any;
let auditScope = {
  organizationOid: organization.oid,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};
let createdAt = new Date('2026-08-13T10:00:00.000Z');
let updatedAt = new Date('2026-08-13T10:05:00.000Z');
let datadogData = {
  apiKey: 'dd-secret',
  site: 'datadoghq.eu'
};
let auditLogStream = {
  oid: 10n,
  id: 'als_1',
  provider: 'datadog' as const,
  status: 'active' as const,
  accessStatus: 'ok' as const,
  isPausedDueToError: false,
  errorMessage: null,
  consecutiveErrorCount: 0,
  isStarted: false,
  organizationOid: organization.oid,
  providerDataRedacted: { site: datadogData.site },
  encryptedProviderData: `als_1:${JSON.stringify(datadogData)}`,
  lastEventId: null,
  lastAuditLogOid: null,
  createdAt,
  updatedAt
};

describe('auditLogStreamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findStreams.mockResolvedValue([auditLogStream]);
    insertStream.mockImplementation(async ({ data }) => ({
      ...auditLogStream,
      ...data
    }));
    updateStream.mockImplementation(async ({ data }) => ({
      ...auditLogStream,
      ...(data.provider === undefined ? {} : { provider: data.provider }),
      ...(data.status === undefined ? {} : { status: data.status }),
      ...(data.providerDataRedacted === undefined
        ? {}
        : { providerDataRedacted: data.providerDataRedacted }),
      ...(data.encryptedProviderData === undefined
        ? {}
        : { encryptedProviderData: data.encryptedProviderData }),
      ...(data.isPausedDueToError === undefined
        ? {}
        : { isPausedDueToError: data.isPausedDueToError }),
      ...(data.consecutiveErrorCount === undefined
        ? {}
        : { consecutiveErrorCount: data.consecutiveErrorCount })
    }));
    insertEvent.mockResolvedValue({});
    dirtyTrackerUpsert.mockResolvedValue({});
    deleteStream.mockResolvedValue(auditLogStream);
    generateId.mockImplementation(async type =>
      type === 'auditLogStream' ? 'als_1' : 'alse_1'
    );
    encrypt.mockImplementation(async ({ entityId, secret }) => `${entityId}:${secret}`);
  });

  it('lists streams for a resolved organization and returns raw records', async () => {
    let paginator = await auditLogStreamService.listAuditLogStreams({ organization });
    let result = await paginator.run({ limit: 20 });

    expect(findStreams).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationOid: organization.oid }
      })
    );
    expect(result.items).toEqual([auditLogStream]);
    expect(result.items[0]).toHaveProperty('encryptedProviderData');
  });

  it('creates a stream and lifecycle event from a resolved organization', async () => {
    let result = await auditLogStreamService.createAuditLogStream({
      organization,
      auditScope,
      input: {
        provider: 'datadog',
        providerData: datadogData
      }
    });

    expect(insertStream).toHaveBeenCalledWith({
      data: {
        id: 'als_1',
        provider: 'datadog',
        status: 'active',
        accessStatus: 'ok',
        organizationOid: organization.oid,
        providerDataRedacted: { site: datadogData.site },
        encryptedProviderData: `als_1:${JSON.stringify(datadogData)}`
      }
    });
    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'created',
        auditLogStreamOid: auditLogStream.oid
      }
    });
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith({
      where: { organizationOid: organization.oid },
      create: { organizationOid: organization.oid },
      update: { revision: { increment: 1 } }
    });
    expect(result).toHaveProperty('encryptedProviderData');
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.audit_log_stream.created:after',
      expect.objectContaining({
        organization,
        auditScope,
        auditLogStream: expect.objectContaining({ id: 'als_1', provider: 'datadog' })
      })
    );
  });

  it('updates a resolved stream and records disabling', async () => {
    updateStream.mockResolvedValueOnce({ ...auditLogStream, status: 'inactive' });

    let result = await auditLogStreamService.updateAuditLogStream({
      organization,
      auditLogStream,
      auditScope,
      input: { status: 'inactive' }
    });

    expect(updateStream).toHaveBeenCalledWith({
      where: { oid: auditLogStream.oid },
      data: {
        provider: undefined,
        status: 'inactive',
        providerDataRedacted: undefined,
        encryptedProviderData: undefined
      }
    });
    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'disabled',
        auditLogStreamOid: auditLogStream.oid
      }
    });
    expect(result.status).toBe('inactive');
  });

  it('persists sanitized provider data when replacing configuration', async () => {
    let providerData = {
      endpoint: 'https://splunk.example.com/services/collector',
      token: 'splunk-secret',
      index: 'audit'
    };

    await auditLogStreamService.updateAuditLogStream({
      organization,
      auditLogStream,
      auditScope,
      input: {
        provider: 'splunk',
        providerData
      }
    });

    expect(updateStream).toHaveBeenCalledWith({
      where: { oid: auditLogStream.oid },
      data: {
        provider: 'splunk',
        status: undefined,
        providerDataRedacted: {
          endpoint: providerData.endpoint,
          index: providerData.index
        },
        encryptedProviderData: `als_1:${JSON.stringify(providerData)}`
      }
    });
  });

  it('requires provider data when changing a resolved stream provider', async () => {
    await expect(
      auditLogStreamService.updateAuditLogStream({
        organization,
        auditLogStream,
        auditScope,
        input: { provider: 'splunk' }
      })
    ).rejects.toBeDefined();

    expect(updateStream).not.toHaveBeenCalled();
  });

  it('marks the organization dirty and records enabling when reactivating a stream', async () => {
    let inactiveStream = { ...auditLogStream, status: 'inactive' as const };
    updateStream.mockResolvedValueOnce({ ...inactiveStream, status: 'active' });

    await auditLogStreamService.updateAuditLogStream({
      organization,
      auditLogStream: inactiveStream,
      auditScope,
      input: { status: 'active' }
    });

    expect(insertEvent).toHaveBeenCalledWith({
      data: {
        id: 'alse_1',
        type: 'enabled',
        auditLogStreamOid: inactiveStream.oid
      }
    });
    expect(dirtyTrackerUpsert).toHaveBeenCalledWith({
      where: { organizationOid: organization.oid },
      create: { organizationOid: organization.oid },
      update: { revision: { increment: 1 } }
    });
  });

  it('resumes an error-paused stream and marks it dirty', async () => {
    let pausedStream = {
      ...auditLogStream,
      accessStatus: 'error' as const,
      errorMessage: 'failed',
      isPausedDueToError: true,
      consecutiveErrorCount: 100
    };
    updateStream.mockResolvedValueOnce({
      ...pausedStream,
      isPausedDueToError: false,
      consecutiveErrorCount: 0
    });

    let result = await auditLogStreamService.resumeAuditLogStream({
      organization,
      auditLogStream: pausedStream,
      auditScope
    });

    expect(updateStream).toHaveBeenCalledWith({
      where: { oid: pausedStream.oid },
      data: {
        isPausedDueToError: false,
        consecutiveErrorCount: 0
      }
    });
    expect(result.isPausedDueToError).toBe(false);
    expect(result.accessStatus).toBe('error');
    expect(dirtyTrackerUpsert).toHaveBeenCalled();
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.audit_log_stream.resumed:after',
      expect.objectContaining({
        organization,
        auditScope,
        previousAuditLogStream: pausedStream
      })
    );
  });

  it('rejects resuming a stream that is not error-paused', async () => {
    await expect(
      auditLogStreamService.resumeAuditLogStream({
        organization,
        auditLogStream,
        auditScope
      })
    ).rejects.toBeDefined();

    expect(updateStream).not.toHaveBeenCalled();
  });

  it('deletes a resolved stream', async () => {
    let result = await auditLogStreamService.deleteAuditLogStream({
      organization,
      auditLogStream,
      auditScope
    });

    expect(deleteStream).toHaveBeenCalledWith({
      where: { oid: auditLogStream.oid }
    });
    expect(result).toBe(auditLogStream);
    expect(Fabric.fire).toHaveBeenCalledWith(
      'organization.audit_log_stream.deleted:after',
      expect.objectContaining({
        organization,
        auditScope,
        auditLogStream
      })
    );
  });
});

describe('auditLogStreamEventService', () => {
  it('lists raw events for a resolved stream', async () => {
    let events = [
      {
        oid: 1n,
        id: 'alse_1',
        type: 'created',
        message: null,
        auditLogStreamOid: auditLogStream.oid,
        createdAt
      }
    ];
    findEvents.mockResolvedValue(events);

    let paginator = await auditLogStreamEventService.listAuditLogStreamEvents({
      auditLogStream
    });
    let result = await paginator.run({ limit: 20 });

    expect(findEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auditLogStreamOid: auditLogStream.oid }
      })
    );
    expect(result.items).toEqual(events);
  });
});
