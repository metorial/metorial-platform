import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  deleteStream,
  encrypt,
  findEvents,
  findStreams,
  generateId,
  insertEvent,
  insertStream,
  updateStream
} = vi.hoisted(() => ({
  deleteStream: vi.fn(),
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
    update: updateStream
  },
  auditLogStreamEvent: {
    create: insertEvent
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
      delete: deleteStream,
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

import { auditLogStreamService } from './auditLogStream';
import { auditLogStreamEventService } from './auditLogStreamEvent';

let organization = {
  oid: 2n,
  id: 'org_1'
} as any;
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
        : { encryptedProviderData: data.encryptedProviderData })
    }));
    insertEvent.mockResolvedValue({});
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
    expect(result).toHaveProperty('encryptedProviderData');
  });

  it('updates a resolved stream and records disabling', async () => {
    updateStream.mockResolvedValueOnce({ ...auditLogStream, status: 'inactive' });

    let result = await auditLogStreamService.updateAuditLogStream({
      auditLogStream,
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
      auditLogStream,
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
        auditLogStream,
        input: { provider: 'splunk' }
      })
    ).rejects.toBeDefined();

    expect(updateStream).not.toHaveBeenCalled();
  });

  it('deletes a resolved stream', async () => {
    let result = await auditLogStreamService.deleteAuditLogStream({ auditLogStream });

    expect(deleteStream).toHaveBeenCalledWith({
      where: { oid: auditLogStream.oid }
    });
    expect(result).toBe(auditLogStream);
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
