import { beforeEach, describe, expect, it, vi } from 'vitest';

let { dbMock, connectionServiceMock, lockMock } = vi.hoisted(() => ({
  dbMock: {
    remoteOAuthConfig: {
      findUniqueOrThrow: vi.fn()
    },
    serverOAuthCredentials: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn()
    }
  },
  connectionServiceMock: {
    createConnection: vi.fn()
  },
  lockMock: {
    usingLock: vi.fn(async (_key: string, handler: () => Promise<unknown>) => handler())
  }
}));

vi.mock('../../db', () => ({ db: dbMock }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('@lowerdeck/lock', () => ({ createLock: () => lockMock }));
vi.mock('./remote', () => ({ remoteOAuthConnectionService: connectionServiceMock }));
vi.mock('./delegated', () => ({ delegatedOAuthConnectionService: {} }));
vi.mock('../secret', () => ({ secretService: {} }));

import { serverOAuthCredentialsService } from './serverOAuthCredentials';

let tenant = { oid: 1n, id: 'ten_test' } as any;
let server = {
  oid: 2n,
  id: 'ser_test',
  type: 'remote',
  currentVersionOid: null,
  remoteOauthConfigOid: null
} as any;
let config = { oid: 3n, serverOid: server.oid } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureDefaultRemoteServerOAuthCredentials', () => {
  it('reuses a preflight-created default credential', async () => {
    let existing = { oid: 4n, id: 'soc_existing', isDefault: true };
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValue(existing);

    let result = await serverOAuthCredentialsService.ensureDefaultRemoteServerOAuthCredentials({
      tenant,
      server,
      config,
      registrationMode: 'deferred'
    });

    expect(result).toBe(existing);
    expect(connectionServiceMock.createConnection).not.toHaveBeenCalled();
    expect(lockMock.usingLock).not.toHaveBeenCalled();
  });

  it('creates a deferred connection and marks its credential as default before deployment', async () => {
    let credentials = { oid: 5n, id: 'soc_new', isDefault: false };
    dbMock.serverOAuthCredentials.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    connectionServiceMock.createConnection.mockResolvedValue({
      serverOAuthCredentials: { oid: credentials.oid }
    });
    dbMock.serverOAuthCredentials.findUniqueOrThrow.mockResolvedValue(credentials);

    let result = await serverOAuthCredentialsService.ensureDefaultRemoteServerOAuthCredentials({
      tenant,
      server,
      config,
      registrationMode: 'deferred'
    });

    expect(connectionServiceMock.createConnection).toHaveBeenCalledWith({
      tenant,
      input: { config, registrationMode: 'deferred' }
    });
    expect(dbMock.serverOAuthCredentials.updateMany).toHaveBeenCalledWith({
      where: { oid: credentials.oid },
      data: { isDefault: true }
    });
    expect(result.isDefault).toBe(true);
  });
});

describe('ensureDefaultServerOAuthCredentials', () => {
  it('retains the deployed-version guard on the existing public flow', async () => {
    await expect(
      serverOAuthCredentialsService.ensureDefaultServerOAuthCredentials({ tenant, server })
    ).rejects.toThrow('Provider has not been deployed yet');
  });
});
